import axios from 'axios';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRecoilState } from 'recoil';
import { useToastContext } from '@librechat/client';
import useGetAudioSettings from './useGetAudioSettings';
import store from '~/store';

import type { SpeechToTextOptions } from './types';

type STTStreamEvent =
  | { event: 'delta'; text?: string }
  | { event: 'done'; text?: string }
  | { event: 'error'; message?: string };

const INTERIM_THROTTLE_MS = 750;

const useSpeechToTextExternal = (
  setText: (text: string) => void,
  onTranscriptionComplete: (text: string) => void,
  options?: SpeechToTextOptions,
) => {
  const { showToast } = useToastContext();
  const { speechToTextEndpoint } = useGetAudioSettings();
  const isExternalSTTEnabled = speechToTextEndpoint === 'external';
  const audioStream = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const dataHandlerRef = useRef<((event: BlobEvent) => void) | null>(null);
  const stopListenerRef = useRef<(() => void) | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  const interimControllerRef = useRef<AbortController | null>(null);
  const interimTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const totalSizeRef = useRef(0);
  const lastSentSizeRef = useRef(0);
  const isRequestBeingMadeRef = useRef(false);

  const [permission, setPermission] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isRequestBeingMade, setIsRequestBeingMade] = useState(false);
  const [audioMimeType, setAudioMimeType] = useState<string>(() => getBestSupportedMimeType());
  const audioMimeTypeRef = useRef<string>(audioMimeType);
  const [isStreaming, setIsStreaming] = useState(false);
  const { autoSendOnSuccess = false, enableHotkeys = true, autoSendDelayOverride } = options ?? {};

  const [autoSendText] = useRecoilState(store.autoSendText);
  const [languageSTT] = useRecoilState<string>(store.languageSTT);
  const [speechToText] = useRecoilState<boolean>(store.speechToText);

  const updateRequestBeingMade = useCallback(
    (value: boolean) => {
      isRequestBeingMadeRef.current = value;
      setIsRequestBeingMade(value);
    },
    [setIsRequestBeingMade],
  );

  const stopMediaTracks = useCallback(() => {
    if (audioStream.current) {
      audioStream.current.getTracks().forEach((track) => track.stop());
      audioStream.current = null;
    }
  }, []);

  const cleanupRecorder = useCallback(() => {
    const recorder = mediaRecorderRef.current;

    if (!recorder) {
      return;
    }

    if (dataHandlerRef.current) {
      recorder.removeEventListener('dataavailable', dataHandlerRef.current);
      dataHandlerRef.current = null;
    }

    if (stopListenerRef.current) {
      recorder.removeEventListener('stop', stopListenerRef.current);
      stopListenerRef.current = null;
    }
    mediaRecorderRef.current = null;
  }, []);

  const getMicrophonePermission = useCallback(async () => {
    try {
      const streamData = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      setPermission(true);
      audioStream.current = streamData ?? null;
    } catch {
      setPermission(false);
    }
  }, []);

  const processStreamEvent = useCallback(
    (event: STTStreamEvent, state: { aggregated: string; finalText: string }) => {
      if (event.event === 'delta') {
        if (event.text) {
          state.aggregated += event.text;
          setText(state.aggregated);
        }
        return state;
      }

      if (event.event === 'done') {
        if (typeof event.text === 'string') {
          state.aggregated = event.text;
        }
        state.finalText = state.aggregated;
        setText(state.aggregated);
        return state;
      }

      if (event.event === 'error') {
        throw new Error(event.message || 'An error occurred while streaming the transcription');
      }

      return state;
    },
    [setText],
  );

  const streamTranscription = useCallback(
    async (formData: FormData, signal: AbortSignal) => {
      const headers: HeadersInit = {};
      const authHeader = axios.defaults.headers.common?.Authorization;
      const acceptLanguageHeader = axios.defaults.headers.common?.['Accept-Language'];

      if (authHeader) {
        headers.Authorization = authHeader;
      }

      if (acceptLanguageHeader) {
        headers['Accept-Language'] = acceptLanguageHeader;
      }

      const response = await fetch('/api/speech/stt?stream=true', {
        method: 'POST',
        body: formData,
        credentials: 'include',
        signal,
        headers,
      });

      if (!response.ok) {
        throw new Error(`STT request failed with status ${response.status}`);
      }

      if (!response.body) {
        throw new Error('STT stream response had no body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      const state = { aggregated: '', finalText: '' };
      let buffer = '';

      const flushBuffer = (chunk: string, flush = false) => {
        buffer += chunk;
        let newlineIndex = buffer.indexOf('\n');

        while (newlineIndex !== -1) {
          const line = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 1);

          if (line) {
            try {
              const payload = JSON.parse(line) as STTStreamEvent;
              processStreamEvent(payload, state);
            } catch (error) {
              console.error('Failed to parse STT stream chunk', line, error);
            }
          }

          newlineIndex = buffer.indexOf('\n');
        }

        if (!flush) {
          return;
        }

        const trimmed = buffer.trim();
        buffer = '';

        if (!trimmed) {
          return;
        }

        try {
          const payload = JSON.parse(trimmed) as STTStreamEvent;
          processStreamEvent(payload, state);
        } catch (error) {
          console.error('Failed to parse STT stream chunk', trimmed, error);
        }
      };

      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) {
            flushBuffer(decoder.decode(), true);
            break;
          }

          flushBuffer(decoder.decode(value, { stream: true }));
        }
      } finally {
        reader.releaseLock();
      }

      return (state.finalText || state.aggregated).trim();
    },
    [processStreamEvent],
  );

  const sendInterimTranscription = useCallback(async () => {
    if (
      !audioChunksRef.current.length ||
      !speechToText ||
      !isListening ||
      isRequestBeingMadeRef.current
    ) {
      return;
    }

    const totalSize = totalSizeRef.current;
    if (totalSize === 0 || totalSize === lastSentSizeRef.current) {
      return;
    }

    lastSentSizeRef.current = totalSize;

    try {
      interimControllerRef.current?.abort();
      const controller = new AbortController();
      interimControllerRef.current = controller;

      const mimeType = audioMimeTypeRef.current;
      const fileExtension = getFileExtension(mimeType);
      const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });

      const formData = new FormData();
      formData.append('audio', audioBlob, `audio.${fileExtension}`);
      if (languageSTT) {
        formData.append('language', languageSTT);
      }

      const interimText = await streamTranscription(formData, controller.signal);
      const trimmed = interimText.trim();
      if (trimmed) {
        setText(trimmed);
      }
    } catch (error) {
      if ((error as DOMException)?.name === 'AbortError') {
        return;
      }
      console.error('Interim transcription error:', error);
    }
  }, [isListening, languageSTT, setText, speechToText, streamTranscription]);

  const scheduleInterimTranscription = useCallback(() => {
    if (
      !speechToText ||
      !isListening ||
      isRequestBeingMadeRef.current ||
      interimTimeoutRef.current != null
    ) {
      return;
    }

    interimTimeoutRef.current = setTimeout(() => {
      interimTimeoutRef.current = null;
      void sendInterimTranscription();
    }, INTERIM_THROTTLE_MS);
  }, [isListening, sendInterimTranscription, speechToText]);

  const processAudioStream = useCallback(
    async (formData: FormData) => {
      updateRequestBeingMade(true);
      setIsStreaming(true);
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const finalText = await streamTranscription(formData, controller.signal);
        const trimmedText = finalText.trim();

        if (!trimmedText) {
          return;
        }

        const effectiveDelaySeconds = autoSendDelayOverride ?? autoSendText;
        const hasConfiguredDelay = effectiveDelaySeconds > -1;
        const shouldAutoSend = autoSendOnSuccess || (speechToText && hasConfiguredDelay);

        if (!shouldAutoSend) {
          return;
        }

        const delaySeconds = hasConfiguredDelay ? effectiveDelaySeconds : 0;
        const delay = delaySeconds > 0 ? delaySeconds * 1000 : 0;

        if (delay > 0) {
          setTimeout(() => {
            onTranscriptionComplete(trimmedText);
          }, delay);
        } else {
          onTranscriptionComplete(trimmedText);
        }
      } catch (error) {
        if ((error as DOMException)?.name === 'AbortError') {
          return;
        }

        showToast({
          message: 'An error occurred while processing the audio, maybe the audio was too short',
          status: 'error',
        });
      } finally {
        abortControllerRef.current = null;
        setIsStreaming(false);
        updateRequestBeingMade(false);
        interimControllerRef.current?.abort();
        lastSentSizeRef.current = 0;
        totalSizeRef.current = 0;
      }
    },
    [
      autoSendOnSuccess,
      autoSendDelayOverride,
      autoSendText,
      onTranscriptionComplete,
      showToast,
      speechToText,
      streamTranscription,
      updateRequestBeingMade,
    ],
  );

  const handleStop = useCallback(() => {
    const mimeType = audioMimeTypeRef.current;

    if (audioChunksRef.current.length > 0) {
      const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
      const fileExtension = getFileExtension(mimeType);

      audioChunksRef.current = [];

      if (interimTimeoutRef.current) {
        clearTimeout(interimTimeoutRef.current);
        interimTimeoutRef.current = null;
      }
      interimControllerRef.current?.abort();
      lastSentSizeRef.current = 0;

      const formData = new FormData();
      formData.append('audio', audioBlob, `audio.${fileExtension}`);
      if (languageSTT) {
        formData.append('language', languageSTT);
      }
      setIsRequestBeingMade(true);
      cleanupRecorder();
      void processAudioStream(formData);
    } else {
      showToast({ message: 'The audio was too short', status: 'warning' });
      cleanupRecorder();
      updateRequestBeingMade(false);
      if (interimTimeoutRef.current) {
        clearTimeout(interimTimeoutRef.current);
        interimTimeoutRef.current = null;
      }
      interimControllerRef.current?.abort();
      lastSentSizeRef.current = 0;
      totalSizeRef.current = 0;
    }

    stopMediaTracks();
  }, [
    cleanupRecorder,
    languageSTT,
    processAudioStream,
    showToast,
    stopMediaTracks,
    updateRequestBeingMade,
  ]);

  const handleStopRef = useRef(handleStop);
  handleStopRef.current = handleStop;

  const startRecording = useCallback(async () => {
    if (isRequestBeingMade) {
      showToast({ message: 'A request is already being made. Please wait.', status: 'warning' });
      return;
    }

    if (!audioStream.current) {
      await getMicrophonePermission();
    }

    if (audioStream.current) {
      try {
        audioChunksRef.current = [];
        const bestMimeType = getBestSupportedMimeType();
        audioMimeTypeRef.current = bestMimeType;
        setAudioMimeType(bestMimeType);

        audioChunksRef.current = [];
        totalSizeRef.current = 0;
        lastSentSizeRef.current = 0;

        const recorder = new MediaRecorder(audioStream.current, {
          mimeType: bestMimeType,
        });
        const handleDataAvailable = (event: BlobEvent) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
            totalSizeRef.current += event.data.size;
            scheduleInterimTranscription();
          }
        };

        dataHandlerRef.current = handleDataAvailable;
        recorder.addEventListener('dataavailable', handleDataAvailable);
        const stopListener = () => handleStopRef.current();
        stopListenerRef.current = stopListener;
        recorder.addEventListener('stop', stopListener);
        recorder.start(250);
        mediaRecorderRef.current = recorder;
        setIsListening(true);
      } catch (error) {
        showToast({ message: `Error starting recording: ${error}`, status: 'error' });
      }
    } else {
      showToast({ message: 'Microphone permission not granted', status: 'error' });
    }
  }, [getMicrophonePermission, isRequestBeingMade, scheduleInterimTranscription, showToast]);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;

    if (recorder && recorder.state === 'recording') {
      recorder.stop();
    } else {
      cleanupRecorder();
    }

    stopMediaTracks();
    setIsListening(false);
    if (interimTimeoutRef.current) {
      clearTimeout(interimTimeoutRef.current);
      interimTimeoutRef.current = null;
    }
    interimControllerRef.current?.abort();
  }, [cleanupRecorder, stopMediaTracks]);

  const externalStartRecording = useCallback(() => {
    if (isListening) {
      showToast({ message: 'Already listening. Please stop recording first.', status: 'warning' });
      return;
    }

    void startRecording();
  }, [isListening, showToast, startRecording]);

  const externalStopRecording = useCallback(() => {
    stopRecording();
  }, [stopRecording]);

  const handleKeyDown = useCallback(
    async (e: KeyboardEvent) => {
      if (e.shiftKey && e.altKey && e.code === 'KeyL' && isExternalSTTEnabled) {
        if (!window.MediaRecorder) {
          showToast({ message: 'MediaRecorder is not supported in this browser', status: 'error' });
          return;
        }

        if (permission === false) {
          await getMicrophonePermission();
        }

        if (isListening) {
          stopRecording();
        } else {
          void startRecording();
        }

        e.preventDefault();
      }
    },
    [
      getMicrophonePermission,
      isExternalSTTEnabled,
      isListening,
      permission,
      showToast,
      startRecording,
      stopRecording,
    ],
  );

  useEffect(() => {
    if (!enableHotkeys) {
      return undefined;
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [enableHotkeys, handleKeyDown]);

  useEffect(() => {
    return () => {
      cleanupRecorder();
      stopMediaTracks();
      abortControllerRef.current?.abort();
      interimControllerRef.current?.abort();
      if (interimTimeoutRef.current) {
        clearTimeout(interimTimeoutRef.current);
      }
    };
  }, [cleanupRecorder, stopMediaTracks]);

  return {
    isListening,
    externalStopRecording,
    externalStartRecording,
    isLoading: isStreaming,
  };
};

function getBestSupportedMimeType() {
  const types = [
    'audio/webm',
    'audio/webm;codecs=opus',
    'audio/mp4',
    'audio/ogg;codecs=opus',
    'audio/ogg',
    'audio/wav',
  ];

  for (const type of types) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }

  if (typeof navigator !== 'undefined') {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.indexOf('safari') !== -1 && ua.indexOf('chrome') === -1) {
      return 'audio/mp4';
    } else if (ua.indexOf('firefox') !== -1) {
      return 'audio/ogg';
    }
  }

  return 'audio/webm';
}

function getFileExtension(mimeType: string) {
  if (mimeType.includes('mp4')) {
    return 'm4a';
  } else if (mimeType.includes('ogg')) {
    return 'ogg';
  } else if (mimeType.includes('wav')) {
    return 'wav';
  }
  return 'webm';
}

export default useSpeechToTextExternal;
