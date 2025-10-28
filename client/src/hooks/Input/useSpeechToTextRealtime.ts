import { useCallback, useEffect, useRef, useState } from 'react';
import { useRecoilValue } from 'recoil';
import type {
  RealtimeAudioConfig,
  RealtimeAudioInputConfig,
  RealtimeAudioOutputConfig,
  RealtimeCallOverrides,
  RealtimeCallRequest,
  RealtimeCallResponse,
  RealtimeSessionOverrides,
} from 'librechat-data-provider';
import { useToastContext } from '@librechat/client';
import { useRealtimeSessionMutation } from '~/data-provider';
import store from '~/store';
import { DEFAULT_REALTIME_STT_OPTIONS } from '~/store/settings';
import { logger } from '~/utils';
import type { RealtimeRecorderStatus, SpeechToTextOptions } from './types';

const cloneConfig = <T>(value: T): T => {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'object') {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (error) {
      logger.warn?.('Failed to clone realtime config value', error);
    }
  }

  return value;
};

const sanitizeInclude = (...values: unknown[]): string[] | undefined => {
  const entries: string[] = [];

  values.forEach((value) => {
    if (!value) {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((entry) => {
        if (typeof entry !== 'string') {
          return;
        }
        const trimmed = entry.trim();
        if (trimmed.length > 0) {
          entries.push(trimmed);
        }
      });
      return;
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        entries.push(trimmed);
      }
    }
  });

  if (!entries.length) {
    return undefined;
  }

  return Array.from(new Set(entries));
};

const stopTracks = (stream: MediaStream | null) => {
  if (!stream) {
    return;
  }

  stream.getTracks().forEach((track) => {
    try {
      track.stop();
    } catch (error) {
      logger.warn?.('Failed to stop realtime media track', error);
    }
  });
};

type RealtimeCallConfig = RealtimeCallOverrides;

const isString = (value: unknown): value is string => typeof value === 'string';

const ensureAudioConfig = (session: RealtimeSessionOverrides) => {
  session.audio ??= {};
  return session.audio;
};

const ensureAudioInputConfig = (session: RealtimeSessionOverrides) => {
  const audio = ensureAudioConfig(session);
  audio.input ??= {};
  return audio.input;
};

const ensureAudioOutputConfig = (session: RealtimeSessionOverrides) => {
  const audio = ensureAudioConfig(session);
  audio.output ??= {};
  return audio.output;
};

const mergeAudioInputConfig = (
  target: RealtimeAudioInputConfig | undefined,
  source: RealtimeAudioInputConfig | undefined,
): RealtimeAudioInputConfig | undefined => {
  if (!source) {
    return target;
  }

  const next: RealtimeAudioInputConfig = target ? cloneConfig(target) : {};

  if (source.format) {
    next.format = { ...(next.format ?? {}), ...cloneConfig(source.format) };
  }

  if (source.noiseReduction !== undefined) {
    next.noiseReduction = cloneConfig(source.noiseReduction);
  }

  if (source.turnDetection !== undefined) {
    next.turnDetection = cloneConfig(source.turnDetection);
  }

  if (source.transcriptionDefaults !== undefined) {
    next.transcriptionDefaults = cloneConfig(source.transcriptionDefaults);
  }

  Object.entries(source).forEach(([key, value]) => {
    if (key === 'format' || key === 'noiseReduction' || key === 'turnDetection' || key === 'transcriptionDefaults') {
      return;
    }

    if (value === undefined) {
      return;
    }

    (next as Record<string, unknown>)[key] = cloneConfig(value);
  });

  return Object.keys(next).length ? next : undefined;
};

const mergeAudioOutputConfig = (
  target: RealtimeAudioOutputConfig | undefined,
  source: RealtimeAudioOutputConfig | undefined,
): RealtimeAudioOutputConfig | undefined => {
  if (!source) {
    return target;
  }

  const next: RealtimeAudioOutputConfig = target ? cloneConfig(target) : {};

  if (source.voice !== undefined) {
    next.voice = cloneConfig(source.voice);
  }

  if (source.voices !== undefined) {
    next.voices = cloneConfig(source.voices);
  }

  if (source.format) {
    next.format = { ...(next.format ?? {}), ...cloneConfig(source.format) };
  }

  Object.entries(source).forEach(([key, value]) => {
    if (key === 'voice' || key === 'voices' || key === 'format') {
      return;
    }

    if (value === undefined) {
      return;
    }

    (next as Record<string, unknown>)[key] = cloneConfig(value);
  });

  return Object.keys(next).length ? next : undefined;
};

const mergeAudioConfig = (
  target: RealtimeAudioConfig | undefined,
  source: RealtimeAudioConfig | undefined,
): RealtimeAudioConfig | undefined => {
  if (!source) {
    return target;
  }

  const next: RealtimeAudioConfig = target ? cloneConfig(target) : {};

  const input = mergeAudioInputConfig(next.input, source.input);
  if (input) {
    next.input = input;
  } else {
    delete next.input;
  }

  const output = mergeAudioOutputConfig(next.output, source.output);
  if (output) {
    next.output = output;
  } else {
    delete next.output;
  }

  Object.entries(source).forEach(([key, value]) => {
    if (key === 'input' || key === 'output') {
      return;
    }

    if (value === undefined) {
      return;
    }

    (next as Record<string, unknown>)[key] = cloneConfig(value);
  });

  return Object.keys(next).length ? next : undefined;
};

const mergeSessionOverrides = (
  target: RealtimeSessionOverrides,
  source?: RealtimeSessionOverrides,
): RealtimeSessionOverrides => {
  if (!source) {
    return target;
  }

  if (typeof source.type === 'string') {
    target.type = source.type;
  }

  if (typeof source.model === 'string') {
    target.model = source.model;
  }

  if (typeof source.instructions === 'string') {
    target.instructions = source.instructions;
  }

  if (typeof source.speechToSpeech === 'boolean') {
    target.speechToSpeech = source.speechToSpeech;
  }

  const speechToSpeechAlias = (source as Record<string, unknown>).speech_to_speech;
  if (typeof speechToSpeechAlias === 'boolean') {
    target.speechToSpeech = speechToSpeechAlias;
  }

  if (typeof source.textOutput === 'boolean') {
    target.textOutput = source.textOutput;
  }

  if (typeof source.audioOutput === 'boolean') {
    target.audioOutput = source.audioOutput;
  }

  const include = sanitizeInclude(source.include);
  if (include) {
    target.include = include;
  }

  if (source.audio) {
    target.audio = mergeAudioConfig(target.audio, source.audio);
  }

  Object.entries(source).forEach(([key, value]) => {
    if (
      key === 'type' ||
      key === 'model' ||
      key === 'instructions' ||
      key === 'speechToSpeech' ||
      key === 'speech_to_speech' ||
      key === 'textOutput' ||
      key === 'audioOutput' ||
      key === 'include' ||
      key === 'audio'
    ) {
      return;
    }

    if (value === undefined) {
      return;
    }

    (target as Record<string, unknown>)[key] = cloneConfig(value);
  });

  return target;
};

const applyCallOverrides = (
  target: RealtimeCallConfig,
  overrides: Partial<RealtimeCallOverrides>,
) => {
  Object.entries(overrides).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }

    if (key === 'include') {
      const overrideInclude = sanitizeInclude(value);
      if (overrideInclude) {
        target.include = overrideInclude;
      } else {
        delete target.include;
      }
      return;
    }

    if (key === 'session' && typeof value === 'object') {
      target.session ??= {};
      mergeSessionOverrides(target.session, value as RealtimeSessionOverrides);
      return;
    }

    if (key === 'model' || key === 'instructions' || key === 'type') {
      target.session ??= {};
      (target.session as Record<string, unknown>)[key] = cloneConfig(value);
      return;
    }

    if (key === 'voice') {
      target.session ??= {};
      ensureAudioOutputConfig(target.session).voice = cloneConfig(value);
      return;
    }

    if (key === 'turnDetection') {
      target.session ??= {};
      ensureAudioInputConfig(target.session).turnDetection = cloneConfig(value);
      return;
    }

    if (key === 'noiseReduction') {
      target.session ??= {};
      ensureAudioInputConfig(target.session).noiseReduction = cloneConfig(value);
      return;
    }

    if (key === 'audio' && typeof value === 'object') {
      target.session ??= {};
      target.session.audio = mergeAudioConfig(target.session.audio, value as RealtimeAudioConfig);
      return;
    }

    if (key === 'transcription' && typeof value === 'object') {
      target.session ??= {};
      ensureAudioInputConfig(target.session).transcription = cloneConfig(value);
      return;
    }

    (target as Record<string, unknown>)[key] = cloneConfig(value);
  });
};

const extractNestedText = (value: unknown, keys: string[] = ['text']): string => {
  if (isString(value)) {
    return value;
  }

  if (value && typeof value === 'object') {
    for (const key of keys) {
      if (key in (value as Record<string, unknown>)) {
        const textValue = (value as Record<string, unknown>)[key];
        if (isString(textValue)) {
          return textValue;
        }
      }
    }
  }

  return '';
};

const extractDeltaText = (event: { delta?: unknown; text?: unknown }): string => {
  const directDelta = extractNestedText(event.delta);
  if (directDelta) {
    return directDelta;
  }

  return extractNestedText(event.text);
};

const extractCompletedText = (event: { transcription?: unknown; text?: unknown }): string => {
  const transcriptionText = extractNestedText(event.transcription);
  if (transcriptionText) {
    return transcriptionText;
  }

  return extractNestedText(event.text);
};

const extractErrorMessage = (event: { error?: unknown }): string => {
  return extractNestedText(event.error, ['message', 'text']);
};

const useSpeechToTextRealtime = (
  setText: (text: string) => void,
  onTranscriptionComplete: (text: string) => void,
  options?: SpeechToTextOptions
) => {
  const { showToast } = useToastContext();
  const realtimeSessionMutation = useRealtimeSessionMutation();

  const realtimeDefaults = useRecoilValue(store.realtimeSTTOptions) ?? DEFAULT_REALTIME_STT_OPTIONS;
  const autoSendText = useRecoilValue(store.autoSendText);
  const speechToTextEnabled = useRecoilValue(store.speechToText);

  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<RealtimeRecorderStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const transcriptsRef = useRef('');
  const finalizedRef = useRef(false);
  const mountedRef = useRef(true);
  const optionsRef = useRef<SpeechToTextOptions | undefined>(options);
  const abortedRef = useRef(false);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const updateStatus = useCallback(
    (nextStatus: RealtimeRecorderStatus) => {
      if (!mountedRef.current) {
        return;
      }

      setStatus(nextStatus);
      optionsRef.current?.onStatusChange?.(nextStatus);
    },
    [],
  );

  const reportError = useCallback((message: string | null) => {
    if (!mountedRef.current) {
      return;
    }

    setError(message);
    optionsRef.current?.onError?.(message);
  }, []);

  const cleanup = useCallback(() => {
    const channel = dataChannelRef.current;
    if (channel) {
      channel.onmessage = null;
      channel.onopen = null;
      channel.onclose = null;
      try {
        if (channel.readyState !== 'closed') {
          channel.close();
        }
      } catch (closeError) {
        logger.warn?.('Failed to close realtime data channel', closeError);
      }
      dataChannelRef.current = null;
    }

    const peerConnection = pcRef.current;
    if (peerConnection) {
      try {
        peerConnection.onconnectionstatechange = null;
        peerConnection.ontrack = null;
        peerConnection.close();
      } catch (closeError) {
        logger.warn?.('Failed to close realtime peer connection', closeError);
      }
      pcRef.current = null;
    }

    stopTracks(streamRef.current);
    streamRef.current = null;
  }, []);

  useEffect(
    () => () => {
      mountedRef.current = false;
      cleanup();
    },
    [cleanup],
  );

  const resolveCallConfig = useCallback((): RealtimeCallConfig => {
    const defaults = realtimeDefaults ?? DEFAULT_REALTIME_STT_OPTIONS;
    const currentOptions = optionsRef.current;

    const config: RealtimeCallConfig = {};
    const session: RealtimeSessionOverrides = mergeSessionOverrides({}, cloneConfig(defaults.session ?? {}));

    const normalizeModeToType = (mode?: string) => {
      if (typeof mode !== 'string') {
        return;
      }

      const trimmed = mode.trim().toLowerCase();
      if (!trimmed) {
        return;
      }

      if (trimmed === 'speech_to_text' || trimmed === 'transcription') {
        session.type = 'transcription';
        delete session.speechToSpeech;
        delete (session as Record<string, unknown>).speech_to_speech;
        return;
      }

      session.type = 'realtime';
      if (trimmed === 'speech_to_speech') {
        session.speechToSpeech = true;
      }
    };

    if (currentOptions?.type) {
      session.type = currentOptions.type;
    } else {
      normalizeModeToType(currentOptions?.mode);
    }

    if (!session.type) {
      session.type = defaults.session?.type ?? 'transcription';
    }

    const resolvedModel = currentOptions?.model ?? session.model ?? defaults.model;
    if (resolvedModel) {
      session.model = resolvedModel;
    }

    if (currentOptions?.instructions) {
      session.instructions = currentOptions.instructions;
    }

    if (currentOptions?.voice) {
      ensureAudioOutputConfig(session).voice = cloneConfig(currentOptions.voice);
    }

    if (currentOptions?.turnDetection) {
      ensureAudioInputConfig(session).turnDetection = cloneConfig(currentOptions.turnDetection);
    }

    if (currentOptions?.noiseReduction !== undefined) {
      ensureAudioInputConfig(session).noiseReduction = cloneConfig(currentOptions.noiseReduction);
    }

    const defaultInclude = sanitizeInclude(defaults.include);
    if (defaultInclude) {
      config.include = defaultInclude;
    }

    if (currentOptions?.include) {
      const overrideInclude = sanitizeInclude(currentOptions.include);
      if (overrideInclude) {
        config.include = overrideInclude;
      }
    }

    config.session = session;

    const overrides = currentOptions?.callOverrides;
    if (overrides) {
      applyCallOverrides(config, overrides);
    }

    const mergedSession = config.session ?? session;
    const sessionType = mergedSession.type ?? defaults.session?.type ?? 'transcription';
    mergedSession.type = sessionType;

    const defaultTextOutput =
      typeof defaults.session?.textOutput === 'boolean'
        ? defaults.session.textOutput
        : sessionType === 'transcription';

    if (typeof mergedSession.textOutput !== 'boolean') {
      mergedSession.textOutput = defaultTextOutput;
    }

    const resolveDefaultAudioOutput = () => {
      if (typeof defaults.session?.audioOutput === 'boolean') {
        return defaults.session.audioOutput;
      }

      const defaultAudioConfig = defaults.session?.audio?.output;
      if (defaultAudioConfig && typeof defaultAudioConfig.enabled === 'boolean') {
        return defaultAudioConfig.enabled;
      }

      if (defaults.session?.speechToSpeech === true) {
        return true;
      }

      return false;
    };

    const determineAudioOutput = (): boolean => {
      if (sessionType === 'transcription') {
        return false;
      }

      if (typeof mergedSession.audioOutput === 'boolean') {
        return mergedSession.audioOutput;
      }

      const audioConfig = mergedSession.audio?.output;
      if (audioConfig && typeof audioConfig.enabled === 'boolean') {
        return audioConfig.enabled;
      }

      if (mergedSession.speechToSpeech === true || mergedSession.speech_to_speech === true) {
        return true;
      }

      return resolveDefaultAudioOutput();
    };

    const audioOutputEnabled = determineAudioOutput();
    mergedSession.audioOutput = audioOutputEnabled;

    if (audioOutputEnabled) {
      ensureAudioOutputConfig(mergedSession).enabled = true;
    } else if (mergedSession.audio?.output) {
      ensureAudioOutputConfig(mergedSession).enabled = false;
    }

    if (!audioOutputEnabled) {
      delete mergedSession.speechToSpeech;
      delete mergedSession.speech_to_speech;
    }

    const includeValues = sanitizeInclude(config.include, mergedSession.include);
    const filteredInclude = includeValues?.filter((entry) => {
      const normalized = entry.toLowerCase();
      return normalized !== 'audio' && normalized !== 'text';
    });

    if (filteredInclude && filteredInclude.length > 0) {
      config.include = filteredInclude;
    } else {
      delete config.include;
    }

    if ('include' in mergedSession) {
      delete (mergedSession as Record<string, unknown>).include;
    }

    if ('modalities' in mergedSession) {
      delete (mergedSession as Record<string, unknown>).modalities;
    }

    if ('output_modalities' in mergedSession) {
      delete (mergedSession as Record<string, unknown>).output_modalities;
    }

    config.session = mergedSession;

    return config;
  }, [realtimeDefaults]);

  const buildCallPayload = useCallback(
    (sdpOffer: string): RealtimeCallRequest => {
      const config = resolveCallConfig();
      const payload: RealtimeCallRequest = { sdpOffer };

      Object.entries(config).forEach(([key, value]) => {
        if (value === undefined) {
          return;
        }
        (payload as Record<string, unknown>)[key] = value;
      });

      return payload;
    },
    [resolveCallConfig],
  );

  const shouldReceiveAudio = useCallback(() => {
    const config = resolveCallConfig();
    const session = config.session ?? {};
    if (session.audioOutput === true) {
      return true;
    }

    const audioOutput = session.audio?.output;
    if (audioOutput && audioOutput.enabled === true) {
      return true;
    }

    if (session.speechToSpeech === true || session.speech_to_speech === true) {
      return true;
    }

    const defaults = realtimeDefaults ?? DEFAULT_REALTIME_STT_OPTIONS;
    if (defaults.session?.audioOutput || defaults.session?.audio?.output?.enabled) {
      return true;
    }

    return false;
  }, [resolveCallConfig, realtimeDefaults]);

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

  const finalizeTranscription = useCallback(
    (text: string) => {
      if (finalizedRef.current) {
        cleanup();
        return;
      }

      finalizedRef.current = true;
      transcriptsRef.current = text;

      const trimmed = text.trim();
      const nextStatus: RealtimeRecorderStatus = trimmed.length > 0 ? 'completed' : 'idle';

      if (mountedRef.current) {
        setText(text);
        setIsListening(false);
        setIsLoading(false);
        updateStatus(nextStatus);
      }

      reportError(null);

      if (!trimmed) {
        cleanup();
        return;
      }

      const currentOptions = optionsRef.current;
      const autoSendOnSuccess = currentOptions?.autoSendOnSuccess ?? false;
      const delayOverride = currentOptions?.autoSendDelayOverride;
      const overrideSpecified = delayOverride !== undefined && delayOverride !== null;
      const delaySource = overrideSpecified ? delayOverride : autoSendText;
      const shouldAutoSend =
        autoSendOnSuccess || (speechToTextEnabled && (delaySource ?? -1) > -1);

      if (shouldAutoSend) {
        const delaySeconds = (() => {
          if (overrideSpecified) {
            return (delayOverride ?? 0) as number;
          }

          if (autoSendText > -1) {
            return autoSendText;
          }

          return 0;
        })();

        const delay = delaySeconds > 0 ? delaySeconds * 1000 : 0;
        const dispatchCompletion = () => onTranscriptionComplete(text);
        if (delay > 0) {
          setTimeout(dispatchCompletion, delay);
        } else {
          dispatchCompletion();
        }
      }

      cleanup();
    },
    [
      autoSendText,
      cleanup,
      onTranscriptionComplete,
      reportError,
      setText,
      speechToTextEnabled,
      updateStatus,
    ],
  );

  const handleRealtimeEvent = useCallback(
    (event: unknown) => {
      if (!event || typeof event !== 'object') {
        return;
      }

      const typed = event as { type?: string; [key: string]: unknown };
      const { type } = typed;
      if (typeof type !== 'string') {
        return;
      }

      switch (type) {
        case 'conversation.item.input_audio_transcription.delta': {
          const deltaValue = extractDeltaText({
            delta: typed.delta,
            text: typed.text,
          });

          if (!deltaValue) {
            return;
          }

          transcriptsRef.current = `${transcriptsRef.current}${deltaValue}`;
          setText(transcriptsRef.current);
          updateStatus('processing');
          break;
        }
        case 'conversation.item.input_audio_transcription.completed': {
          const completedText = extractCompletedText({
            transcription: typed.transcription,
            text: typed.text,
          }) || transcriptsRef.current;
          finalizeTranscription(completedText);
          break;
        }
        case 'response.completed':
        case 'response.finished': {
          finalizeTranscription(transcriptsRef.current);
          break;
        }
        case 'response.error': {
          const message = extractErrorMessage({ error: typed.error });
          if (message) {
            showToast({ message, status: 'error' });
            reportError(message);
            updateStatus('error');
          }
          break;
        }
        default: {
          if (type.startsWith('response.output_audio.')) {
            optionsRef.current?.onSpeechOutputDelta?.(event);
          } else if (type.startsWith('response.speech.')) {
            optionsRef.current?.onSpeechOutputDelta?.(event);
            if (type.endsWith('.completed')) {
              optionsRef.current?.onSpeechOutputCompleted?.(event);
            }
          } else if (type === 'response.output_audio.completed') {
            optionsRef.current?.onSpeechOutputCompleted?.(event);
          }
          break;
        }
      }
    },
    [finalizeTranscription, reportError, setText, showToast, updateStatus],
  );

  const handleMessageEvent = useCallback(
    (event: MessageEvent<string>) => {
      try {
        const parsed = JSON.parse(event.data);
        handleRealtimeEvent(parsed);
      } catch (parseError) {
        logger.warn?.('Failed to parse realtime transcription event', parseError);
      }
    },
    [handleRealtimeEvent],
  );

  const negotiatePeerConnection = useCallback(async () => {
    if (abortedRef.current) {
      cleanup();
      return;
    }

    const stream = streamRef.current;
    if (!stream) {
      throw new Error('Missing audio stream for realtime transcription');
    }

    const factory = optionsRef.current?.peerConnectionFactory;
    const peerConnection = factory ? factory() : new RTCPeerConnection();
    pcRef.current = peerConnection;

    updateStatus('negotiating');

    const dataChannel = peerConnection.createDataChannel('oai-events');
    dataChannelRef.current = dataChannel;

    dataChannel.onmessage = (event) => handleMessageEvent(event as MessageEvent<string>);
    dataChannel.onopen = () => {
      if (!mountedRef.current || abortedRef.current) {
        dataChannel.close();
        return;
      }
      setIsLoading(false);
      setIsListening(true);
      updateStatus('connected');
    };
    dataChannel.onclose = () => {
      cleanup();
      if (mountedRef.current) {
        setIsLoading(false);
        setIsListening(false);
      }
      updateStatus('idle');
    };

    peerConnection.onconnectionstatechange = () => {
      if (!pcRef.current) {
        return;
      }

      if (['failed', 'disconnected', 'closed'].includes(peerConnection.connectionState)) {
        cleanup();
        if (mountedRef.current) {
          setIsLoading(false);
          setIsListening(false);
        }
        updateStatus('error');
      }
    };

    const receiveAudio = shouldReceiveAudio();
    stream.getTracks().forEach((track) => {
      peerConnection.addTrack(track, stream);
    });

    if (abortedRef.current) {
      cleanup();
      return;
    }

    const offer = await peerConnection.createOffer({
      offerToReceiveAudio: receiveAudio,
      offerToReceiveVideo: false,
    });
    await peerConnection.setLocalDescription(offer);

    if (abortedRef.current) {
      cleanup();
      return;
    }

    const sdpOffer = offer.sdp ?? '';
    if (!sdpOffer) {
      throw new Error('Failed to create SDP offer for realtime call');
    }

    const payload = buildCallPayload(sdpOffer);
    if (abortedRef.current) {
      cleanup();
      return;
    }

    const response = await initiateRealtimeCall(payload);
    if (abortedRef.current) {
      cleanup();
      return;
    }

    const answer = response?.sdpAnswer;
    if (!answer) {
      throw new Error('Realtime call did not return an SDP answer');
    }

    await peerConnection.setRemoteDescription({ type: 'answer', sdp: answer });
    if (abortedRef.current) {
      cleanup();
    }
  }, [
    buildCallPayload,
    cleanup,
    handleMessageEvent,
    initiateRealtimeCall,
    shouldReceiveAudio,
    updateStatus,
  ]);

  const startRecording = useCallback(async () => {
    if (isLoading || isListening) {
      return;
    }

    abortedRef.current = false;
    transcriptsRef.current = '';
    finalizedRef.current = false;

    if (mountedRef.current) {
      setIsListening(false);
      setIsLoading(true);
    }

    updateStatus('acquiring_media');
    reportError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;
    } catch (mediaError) {
      const message = 'Microphone permission denied';
      showToast({ message, status: 'error' });
      reportError(message);
      updateStatus('error');
      if (mountedRef.current) {
        setIsLoading(false);
      }
      logger.warn?.('Failed to acquire microphone for realtime transcription', mediaError);
      return;
    }

    try {
      await negotiatePeerConnection();
    } catch (errorCause) {
      logger.error?.('Failed to start realtime transcription session', errorCause);
      const message =
        errorCause instanceof Error && errorCause.message
          ? errorCause.message
          : 'Failed to start realtime transcription';
      showToast({ message, status: 'error' });
      reportError(message);
      updateStatus('error');
      if (mountedRef.current) {
        setIsLoading(false);
        setIsListening(false);
      }
      cleanup();
    }
  }, [
    cleanup,
    isListening,
    isLoading,
    negotiatePeerConnection,
    reportError,
    showToast,
    updateStatus,
  ]);

  const stopRecording = useCallback(() => {
    abortedRef.current = true;

    if (!pcRef.current && !streamRef.current) {
      cleanup();
      updateStatus('idle');
      if (mountedRef.current) {
        setIsListening(false);
        setIsLoading(false);
      }
      return;
    }

    if (!finalizedRef.current && transcriptsRef.current) {
      finalizeTranscription(transcriptsRef.current);
      return;
    }

    cleanup();
    if (mountedRef.current) {
      setIsListening(false);
      setIsLoading(false);
    }
    updateStatus(finalizedRef.current ? 'completed' : 'idle');
  }, [cleanup, finalizeTranscription, updateStatus]);

  return {
    isListening,
    isLoading,
    status,
    error,
    startRecording,
    stopRecording,
  };
};

export default useSpeechToTextRealtime;
