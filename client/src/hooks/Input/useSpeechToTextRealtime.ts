import { useCallback, useEffect, useRef, useState } from 'react';
import { useRecoilValue } from 'recoil';
import type { RealtimeCallRequest, RealtimeCallResponse } from 'librechat-data-provider';
import { useToastContext } from '@librechat/client';
import { useRealtimeSessionMutation } from '~/data-provider';
import store from '~/store';
import { logger } from '~/utils';
import type { RealtimeSessionConfig, SpeechToTextOptions } from './types';

type RealtimeSessionDescriptor = RealtimeSessionConfig;

interface AudioGraph {
  context: AudioContext;
  processor: ScriptProcessorNode;
  source: MediaStreamAudioSourceNode;
  sink: GainNode;
}

const DEFAULT_SAMPLE_RATE = 24000;
const DEFAULT_ENCODING = 'pcm16';
const PCM_SCALE = 0x7fff;

const isWebSocketOpen = (socket: WebSocket | null) => socket?.readyState === WebSocket.OPEN;

const isChannelOpen = (channel: RTCDataChannel | null) => channel?.readyState === 'open';

const encodePCM16 = (pcm16: Int16Array) => {
  const view = new Uint8Array(pcm16.buffer);
  let binary = '';
  for (let i = 0; i < view.byteLength; i += 1) {
    binary += String.fromCharCode(view[i]);
  }
  return btoa(binary);
};

const floatTo16BitPCM = (input: Float32Array) => {
  const pcm16 = new Int16Array(input.length);
  for (let i = 0; i < input.length; i += 1) {
    const s = Math.max(-1, Math.min(1, input[i]));
    pcm16[i] = s < 0 ? s * PCM_SCALE : s * PCM_SCALE;
  }
  return pcm16;
};

const getSampleRate = (descriptor?: RealtimeSessionDescriptor | null) =>
  descriptor?.inputAudioFormat?.sampleRate ?? DEFAULT_SAMPLE_RATE;

const getEncoding = (descriptor?: RealtimeSessionDescriptor | null) =>
  descriptor?.inputAudioFormat?.encoding ?? DEFAULT_ENCODING;

const createSessionProtocols = (descriptor: RealtimeSessionDescriptor) => {
  const protocols = ['realtime'];
  const secret = descriptor.session?.client_secret?.value;
  if (secret) {
    protocols.push(`openai-insecure-api-key.${secret}`);
  }
  if (descriptor.session?.id) {
    protocols.push(`openai-insecure-session-id.${descriptor.session.id}`);
  }
  return protocols;
};

const buildRealtimeUrl = (descriptor: RealtimeSessionDescriptor) => {
  const url = new URL(descriptor.url);
  if (descriptor.model) {
    url.searchParams.set('model', descriptor.model);
  }
  return url.toString();
};

const useSpeechToTextRealtime = (
  setText: (text: string) => void,
  onTranscriptionComplete: (text: string) => void,
  options?: SpeechToTextOptions,
) => {
  const { showToast } = useToastContext();
  const realtimeSessionMutation = useRealtimeSessionMutation();

  const realtimeDefaults = useRecoilValue(store.realtimeSTTOptions);
  const autoSendText = useRecoilValue(store.autoSendText);
  const speechToTextEnabled = useRecoilValue(store.speechToText);

  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const audioGraphRef = useRef<AudioGraph | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const transcriptsRef = useRef('');
  const finalizedRef = useRef(false);
  const isActiveRef = useRef(false);
  const hasRequestedResponseRef = useRef(false);
  const hasCommittedAudioRef = useRef(false);
  const hasDetectedAudioRef = useRef(false);
  const pendingResponseRequestRef = useRef(false);
  const mountedRef = useRef(true);
  const currentDescriptorRef = useRef<RealtimeSessionDescriptor | null>(null);
  const optionsRef = useRef<SpeechToTextOptions | undefined>(options);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const buildDescriptorFromDefaults = useCallback((): RealtimeSessionDescriptor => {
    const defaults = (realtimeDefaults ?? {}) as RealtimeSessionConfig;
    const include = Array.isArray(defaults.include)
      ? defaults.include.filter((value) => typeof value === 'string' && value.trim().length > 0)
      : [];

    if (defaults.transport && defaults.transport !== 'webrtc') {
      logger.warn?.('Realtime websocket transport is not supported; defaulting to WebRTC');
    }

    const sessionConfig = defaults.session ? JSON.parse(JSON.stringify(defaults.session)) : undefined;
    const audioConfig = defaults.audio ? JSON.parse(JSON.stringify(defaults.audio)) : undefined;

    return {
      url: '',
      transport: 'webrtc',
      stream: typeof defaults.stream === 'boolean' ? defaults.stream : true,
      inputAudioFormat: {
        encoding: defaults.inputAudioFormat?.encoding ?? DEFAULT_ENCODING,
        sampleRate: defaults.inputAudioFormat?.sampleRate ?? DEFAULT_SAMPLE_RATE,
        channels: defaults.inputAudioFormat?.channels ?? 1,
      },
      model: typeof defaults.model === 'string' ? defaults.model : '',
      session: sessionConfig ?? undefined,
      audio: audioConfig,
      include: include.length > 0 ? include : undefined,
      ffmpegPath: defaults.ffmpegPath,
    };
  }, [realtimeDefaults]);

  const fetchSessionDescriptor = useCallback(() => {
    const override = optionsRef.current?.realtimeSessionFetcher;
    if (override) {
      return override();
    }

    return Promise.resolve(buildDescriptorFromDefaults());
  }, [buildDescriptorFromDefaults]);

  const initiateRealtimeCall = useCallback(
    (payload: RealtimeCallRequest): Promise<RealtimeCallResponse> => {
      const override = optionsRef.current?.realtimeCallInvoker;
      if (override) {
        return override(payload);
      }

      return realtimeSessionMutation.mutateAsync(payload);
    },
    [realtimeSessionMutation],
  );

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cleanupAudioGraph = useCallback(() => {
    const graph = audioGraphRef.current;
    if (!graph) {
      return;
    }

    graph.processor.disconnect();
    graph.sink.disconnect();
    graph.source.disconnect();

    graph.context.suspend().catch(() => undefined);
    graph.context.close().catch(() => undefined);
    audioGraphRef.current = null;
  }, []);

  const stopMediaStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.onmute = null;
        track.onunmute = null;
        track.stop();
      });
      streamRef.current = null;
    }
  }, []);

  const closeWebSocket = useCallback(() => {
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch (error) {
        logger.warn?.('Failed to close realtime websocket cleanly', error);
      }
      wsRef.current = null;
    }
  }, []);

  const closePeerConnection = useCallback(() => {
    if (dataChannelRef.current) {
      try {
        dataChannelRef.current.close();
      } catch (error) {
        logger.warn?.('Failed to close realtime data channel', error);
      }
      dataChannelRef.current = null;
    }

    if (pcRef.current) {
      try {
        pcRef.current.close();
      } catch (error) {
        logger.warn?.('Failed to close realtime peer connection', error);
      }
      pcRef.current = null;
    }
  }, []);

  const cleanup = useCallback(() => {
    cleanupAudioGraph();
    closeWebSocket();
    closePeerConnection();
    stopMediaStream();
    currentDescriptorRef.current = null;
    isActiveRef.current = false;
    hasRequestedResponseRef.current = false;
    hasCommittedAudioRef.current = false;
    hasDetectedAudioRef.current = false;
    pendingResponseRequestRef.current = false;
  }, [cleanupAudioGraph, closePeerConnection, closeWebSocket, stopMediaStream]);

  const sendJsonMessage = useCallback((payload: Record<string, unknown>) => {
    const message = JSON.stringify(payload);
    const socket = wsRef.current;
    if (isWebSocketOpen(socket)) {
      socket?.send(message);
      return true;
    }

    const channel = dataChannelRef.current;
    if (isChannelOpen(channel)) {
      channel?.send(message);
      return true;
    }

    return false;
  }, []);

  const buildCallPayload = useCallback(
    (descriptor: RealtimeSessionDescriptor, sdpOffer: string): RealtimeCallRequest => {
      const payload: RealtimeCallRequest = { sdpOffer };
      const sessionConfig = descriptor.session ?? {};
      const resolvedModel = sessionConfig.model ?? descriptor.model;

      if (typeof sessionConfig.mode === 'string' && sessionConfig.mode.trim().length > 0) {
        payload.mode = sessionConfig.mode;
      }

      if (resolvedModel) {
        payload.model = resolvedModel;
      }

      if (typeof sessionConfig.voice === 'string' && sessionConfig.voice.trim().length > 0) {
        payload.voice = sessionConfig.voice;
      }

      if (
        typeof sessionConfig.instructions === 'string' &&
        sessionConfig.instructions.trim().length > 0
      ) {
        payload.instructions = sessionConfig.instructions;
      }

      if (Array.isArray(descriptor.include) && descriptor.include.length > 0) {
        const includeValues = descriptor.include
          .map((value) => (typeof value === 'string' ? value.trim() : ''))
          .filter((value) => value.length > 0);

        if (includeValues.length > 0) {
          payload.include = [...new Set(includeValues)];
        }
      }

      const audioInput = descriptor.audio?.input;
      if (audioInput?.turnDetection) {
        payload.turnDetection = JSON.parse(JSON.stringify(audioInput.turnDetection));
      }

      if (audioInput && 'noiseReduction' in audioInput && audioInput.noiseReduction !== undefined) {
        payload.noiseReduction = JSON.parse(JSON.stringify(audioInput.noiseReduction));
      }

      return payload;
    },
    [],
  );

  const beginRealtimeResponse = useCallback(() => {
    if (hasRequestedResponseRef.current) {
      pendingResponseRequestRef.current = false;
      return;
    }

    if (!hasDetectedAudioRef.current) {
      pendingResponseRequestRef.current = true;
      return;
    }

    const descriptor = currentDescriptorRef.current;
    const includeModalities = Array.isArray(descriptor?.include)
      ? descriptor.include.filter((value) => typeof value === 'string' && value.trim().length > 0)
      : [];

    let requestedModalities: string[];
    if (includeModalities.length) {
      requestedModalities = [...new Set(includeModalities)];
    } else if (descriptor?.session?.speechToSpeech) {
      requestedModalities = ['text', 'audio'];
    } else {
      requestedModalities = ['text'];
    }

    const didSend = sendJsonMessage({
      type: 'response.create',
      response: { modalities: requestedModalities },
    });
    if (didSend) {
      hasRequestedResponseRef.current = true;
      pendingResponseRequestRef.current = false;
    } else {
      pendingResponseRequestRef.current = true;
    }
  }, [sendJsonMessage]);

  const finalizeTranscription = useCallback(
    (text: string) => {
      if (finalizedRef.current) {
        return;
      }

      finalizedRef.current = true;
      transcriptsRef.current = text;

      if (mountedRef.current) {
        setText(text);
        setIsLoading(false);
      }

      const trimmed = text.trim();
      if (!trimmed) {
        return;
      }

      const currentOptions = optionsRef.current;
      const autoSendOnSuccess = currentOptions?.autoSendOnSuccess ?? false;
      const delayOverride = currentOptions?.autoSendDelayOverride;
      const overrideSpecified = delayOverride !== undefined && delayOverride !== null;
      const delaySource = overrideSpecified ? delayOverride : autoSendText;
      const shouldAutoSend =
        autoSendOnSuccess || (speechToTextEnabled && (delaySource ?? -1) > -1);

      if (!shouldAutoSend) {
        return;
      }

      const delaySeconds = overrideSpecified
        ? delayOverride ?? 0
        : autoSendText > -1
          ? autoSendText
          : 0;

      const delay = delaySeconds > 0 ? delaySeconds * 1000 : 0;

      const dispatchCompletion = () => onTranscriptionComplete(text);

      if (delay > 0) {
        setTimeout(dispatchCompletion, delay);
      } else {
        dispatchCompletion();
      }
    },
    [autoSendText, onTranscriptionComplete, setText, speechToTextEnabled],
  );

  const resetState = useCallback(() => {
    transcriptsRef.current = '';
    finalizedRef.current = false;
    if (mountedRef.current) {
      setIsLoading(false);
      setIsListening(false);
    }
  }, []);

  const handleRealtimeEvent = useCallback(
    (data: unknown) => {
      if (!data || typeof data !== 'object') {
        return;
      }

      const event = data as { type?: string; delta?: string; output?: { text?: string }; text?: string } &
        Record<string, unknown>;

      switch (event.type) {
        case 'response.output_text.delta': {
          const delta = typeof event.delta === 'string' ? event.delta : event.text ?? '';
          if (delta && !hasDetectedAudioRef.current) {
            hasDetectedAudioRef.current = true;
          }
          transcriptsRef.current = `${transcriptsRef.current}${delta}`;
          setText(transcriptsRef.current);
          break;
        }
        case 'response.output_text.done':
        case 'response.completed':
        case 'response.finished': {
          if (!hasDetectedAudioRef.current) {
            hasRequestedResponseRef.current = false;
            if (pendingResponseRequestRef.current) {
              beginRealtimeResponse();
            }
            break;
          }
          finalizeTranscription(transcriptsRef.current);
          cleanup();
          break;
        }
        case 'response.error': {
          const message = (event as { error?: { message?: string } }).error?.message;
          if (message) {
            showToast({ message, status: 'error' });
          }
          break;
        }
        default:
          break;
      }
    },
    [beginRealtimeResponse, cleanup, finalizeTranscription, setText, showToast],
  );

  const handleMessageEvent = useCallback(
    (event: MessageEvent<string>) => {
      try {
        const parsed = JSON.parse(event.data);
        handleRealtimeEvent(parsed);
      } catch (error) {
        logger.warn?.('Failed to parse realtime transcription event', error);
      }
    },
    [handleRealtimeEvent],
  );

  const setupAudioGraph = useCallback(
    async (descriptor: RealtimeSessionDescriptor) => {
      if (!streamRef.current) {
        return;
      }

      const options = optionsRef.current;
      const factory = options?.audioContextFactory;
      const sampleRate = getSampleRate(descriptor);
      const audioContextCtor =
        factory ??
        ((contextOptions?: AudioContextOptions) =>
          new (window.AudioContext || (window as any).webkitAudioContext)(contextOptions));

      const context = audioContextCtor({ sampleRate });
      const source = context.createMediaStreamSource(streamRef.current);
      const processor = context.createScriptProcessor(4096, 1, 1);
      const gain = context.createGain();
      gain.gain.value = 0;

      processor.onaudioprocess = (event) => {
        if (!isActiveRef.current) {
          return;
        }

        const channelData = event.inputBuffer.getChannelData(0);
        const pcm16 = floatTo16BitPCM(channelData);

        if (getEncoding(descriptor) !== 'pcm16') {
          return;
        }

        const base64 = encodePCM16(pcm16);
        const didSend = sendJsonMessage({ type: 'input_audio_buffer.append', audio: base64 });
        if (didSend) {
          hasCommittedAudioRef.current = true;
          hasDetectedAudioRef.current = true;
          sendJsonMessage({ type: 'input_audio_buffer.commit' });
          beginRealtimeResponse();
        }
      };

      source.connect(processor);
      processor.connect(gain);
      gain.connect(context.destination);

      audioGraphRef.current = {
        context,
        processor,
        source,
        sink: gain,
      };
    },
    [beginRealtimeResponse, sendJsonMessage],
  );

  const connectWebSocket = useCallback(
    async (descriptor: RealtimeSessionDescriptor) => {
      const options = optionsRef.current;
      const factory = options?.websocketFactory;
      const url = buildRealtimeUrl(descriptor);
      const protocols = createSessionProtocols(descriptor);
      const socket = factory ? factory(url, protocols) : new WebSocket(url, protocols);

      wsRef.current = socket;

      socket.onopen = () => {
        currentDescriptorRef.current = descriptor;
        isActiveRef.current = true;
        setupAudioGraph(descriptor).catch((error) => {
          logger.error?.('Failed to initialize realtime audio graph', error);
          showToast({ message: 'Failed to access microphone audio', status: 'error' });
        });
        if (mountedRef.current) {
          setIsLoading(false);
          setIsListening(true);
        }
      };

      socket.onmessage = (event) => handleMessageEvent(event as MessageEvent<string>);

      socket.onerror = () => {
        showToast({ message: 'Realtime speech connection error', status: 'error' });
      };

      socket.onclose = () => {
        if (mountedRef.current) {
          setIsListening(false);
          setIsLoading(false);
        }
      };
    },
    [handleMessageEvent, setupAudioGraph, showToast],
  );

  const connectPeerConnection = useCallback(
    async (descriptor: RealtimeSessionDescriptor) => {
      const options = optionsRef.current;
      const factory = options?.peerConnectionFactory;
      const peerConnection = factory ? factory() : new RTCPeerConnection();
      pcRef.current = peerConnection;

      const dataChannel = peerConnection.createDataChannel('oai-events');
      dataChannelRef.current = dataChannel;
      dataChannel.onmessage = (event) => handleMessageEvent(event as MessageEvent<string>);
      dataChannel.onopen = () => {
        if (pendingResponseRequestRef.current || hasDetectedAudioRef.current) {
          beginRealtimeResponse();
        }
        if (mountedRef.current) {
          setIsLoading(false);
          setIsListening(true);
        }
      };

      peerConnection.onconnectionstatechange = () => {
        if (['disconnected', 'failed', 'closed'].includes(peerConnection.connectionState)) {
          cleanup();
        }
      };

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => {
          peerConnection.addTrack(track, streamRef.current as MediaStream);
        });
      }

      const offer = await peerConnection.createOffer({ offerToReceiveAudio: true });
      await peerConnection.setLocalDescription(offer);

      const sdpOffer = offer.sdp ?? '';
      if (!sdpOffer) {
        throw new Error('Failed to create SDP offer for realtime call');
      }

      const payload = buildCallPayload(descriptor, sdpOffer);
      const response = await initiateRealtimeCall(payload);

      const answer = response?.sdpAnswer;
      if (!answer) {
        throw new Error('Realtime call did not return an SDP answer');
      }

      await peerConnection.setRemoteDescription({ type: 'answer', sdp: answer });

      currentDescriptorRef.current = descriptor;
      isActiveRef.current = true;
      if (pendingResponseRequestRef.current) {
        beginRealtimeResponse();
      }
    },
    [beginRealtimeResponse, buildCallPayload, cleanup, handleMessageEvent, initiateRealtimeCall],
  );

  const establishRealtimeConnection = useCallback(
    async (descriptor: RealtimeSessionDescriptor) => {
      if (descriptor.transport === 'webrtc') {
        await connectPeerConnection(descriptor);
        return;
      }

      await connectWebSocket(descriptor);
    },
    [connectPeerConnection, connectWebSocket],
  );

  const startRecording = useCallback(async () => {
    if (isLoading || isListening) {
      return;
    }

    resetState();
    setIsLoading(true);
    hasRequestedResponseRef.current = false;
    hasCommittedAudioRef.current = false;
    hasDetectedAudioRef.current = false;
    pendingResponseRequestRef.current = false;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;
    } catch (error) {
      setIsLoading(false);
      showToast({ message: 'Microphone permission denied', status: 'error' });
      return;
    }

    try {
      const descriptor = await fetchSessionDescriptor();
      const resolved: RealtimeSessionDescriptor = {
        ...descriptor,
        inputAudioFormat: {
          encoding: descriptor.inputAudioFormat?.encoding ?? realtimeDefaults.inputAudioFormat.encoding,
          sampleRate: descriptor.inputAudioFormat?.sampleRate ?? realtimeDefaults.inputAudioFormat.sampleRate,
          channels: descriptor.inputAudioFormat?.channels ?? realtimeDefaults.inputAudioFormat.channels,
        },
        transport: descriptor.transport ?? realtimeDefaults.transport ?? 'webrtc',
        stream: typeof descriptor.stream === 'boolean' ? descriptor.stream : realtimeDefaults.stream,
      };

      currentDescriptorRef.current = resolved;

      if (resolved.transport === 'webrtc') {
        pendingResponseRequestRef.current = true;
        streamRef.current?.getAudioTracks().forEach((track) => {
          track.onunmute = () => {
            hasDetectedAudioRef.current = true;
            beginRealtimeResponse();
            track.onunmute = null;
          };
        });
      }

      await establishRealtimeConnection(resolved);
    } catch (error) {
      logger.error?.('Failed to start realtime transcription session', error);
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'Failed to start realtime transcription';
      showToast({ message, status: 'error' });
      setIsLoading(false);
      cleanup();
    }
  }, [
    beginRealtimeResponse,
    cleanup,
    establishRealtimeConnection,
    fetchSessionDescriptor,
    isListening,
    isLoading,
    realtimeDefaults.inputAudioFormat.channels,
    realtimeDefaults.inputAudioFormat.encoding,
    realtimeDefaults.inputAudioFormat.sampleRate,
    realtimeDefaults.stream,
    realtimeDefaults.transport,
    resetState,
    showToast,
  ]);

  const stopRecording = useCallback(() => {
    if (!isActiveRef.current) {
      cleanup();
      resetState();
      return;
    }

    isActiveRef.current = false;
    if (mountedRef.current) {
      setIsListening(false);
      setIsLoading(true);
    }

    if (currentDescriptorRef.current?.transport !== 'webrtc') {
      sendJsonMessage({ type: 'input_audio_buffer.commit' });
      if (hasCommittedAudioRef.current || hasRequestedResponseRef.current) {
        sendJsonMessage({ type: 'response.cancel' });
      }
    }

    if (!hasDetectedAudioRef.current) {
      cleanup();
      resetState();
      return;
    }

    finalizeTranscription(transcriptsRef.current);
    cleanup();
  }, [cleanup, finalizeTranscription, resetState, sendJsonMessage]);

  return {
    isListening,
    isLoading,
    startRecording,
    stopRecording,
  };
};

export default useSpeechToTextRealtime;

export { floatTo16BitPCM, encodePCM16 };
