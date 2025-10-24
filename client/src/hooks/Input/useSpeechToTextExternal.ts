import axios from 'axios';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRecoilState } from 'recoil';
import { useToastContext } from '@librechat/client';
import useGetAudioSettings from './useGetAudioSettings';
import store from '~/store';

import type { SpeechToTextOptions } from './types';

const useSpeechToTextExternal = (
  setText: (text: string) => void,
  onTranscriptionComplete: (text: string) => void,
  options?: SpeechToTextOptions,
) => {
  const { showToast } = useToastContext();
  const { speechToTextEndpoint } = useGetAudioSettings();
  const isExternalSTTEnabled = speechToTextEndpoint === 'external';

  const audioStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioMimeTypeRef = useRef<string>(getBestSupportedMimeType());
  const autoSendTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [permission, setPermission] = useState<boolean | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [autoSendText] = useRecoilState(store.autoSendText);
  const [languageSTT] = useRecoilState<string>(store.languageSTT);
  const [speechToText] = useRecoilState<boolean>(store.speechToText);

  const {
    autoSendOnSuccess = false,
    enableHotkeys = true,
    autoSendDelayOverride,
  } = options ?? {};

  const clearAutoSendTimeout = useCallback(() => {
    if (autoSendTimeoutRef.current) {
      clearTimeout(autoSendTimeoutRef.current);
      autoSendTimeoutRef.current = null;
    }
  }, []);

  const stopMediaTracks = useCallback(() => {
    if (!audioStreamRef.current) {
      return;
    }

    audioStreamRef.current.getTracks().forEach((track) => track.stop());
    audioStreamRef.current = null;
  }, []);

  const cleanupRecorder = useCallback(() => {
    if (!mediaRecorderRef.current) {
      return;
    }

    mediaRecorderRef.current.ondataavailable = null;
    mediaRecorderRef.current.onstop = null;
    mediaRecorderRef.current = null;
  }, []);

  const requestStream = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      showToast({
        message: 'Microphone access is not supported in this environment',
        status: 'error',
      });
      return null;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      setPermission(true);
      return stream;
    } catch (error) {
      console.error('Microphone permission denied', error);
      setPermission(false);
      showToast({
        message: 'Microphone permission not granted',
        status: 'error',
      });
      return null;
    }
  }, [showToast]);

  const handleTranscriptionSuccess = useCallback(
    (transcript: string) => {
      setText(transcript);

      const trimmed = transcript.trim();
      if (!trimmed) {
        return;
      }

      clearAutoSendTimeout();

      const effectiveDelaySeconds = autoSendDelayOverride ?? autoSendText;
      const hasConfiguredDelay = effectiveDelaySeconds > -1;
      const shouldAutoSend = autoSendOnSuccess || (speechToText && hasConfiguredDelay);

      if (!shouldAutoSend) {
        return;
      }

      const delaySeconds = hasConfiguredDelay ? effectiveDelaySeconds : 0;
      const delay = delaySeconds > 0 ? delaySeconds * 1000 : 0;

      const sendTranscription = () => {
        onTranscriptionComplete(trimmed);
      };

      if (delay > 0) {
        autoSendTimeoutRef.current = setTimeout(sendTranscription, delay);
      } else {
        sendTranscription();
      }
    },
    [
      autoSendDelayOverride,
      autoSendOnSuccess,
      autoSendText,
      clearAutoSendTimeout,
      onTranscriptionComplete,
      setText,
      speechToText,
    ],
  );

  const sendTranscription = useCallback(
    async (audioBlob: Blob) => {
      setIsLoading(true);

      try {
        const formData = new FormData();
        const mimeType = audioMimeTypeRef.current;
        const fileExtension = getFileExtension(mimeType);

        formData.append('audio', audioBlob, `audio.${fileExtension}`);
        if (languageSTT) {
          formData.append('language', languageSTT);
        }

        const { data } = await axios.post<{ text?: string }>('/api/speech/stt', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          withCredentials: true,
        });

        if (data?.text) {
          handleTranscriptionSuccess(data.text);
        } else {
          showToast({
            message: 'No transcription was returned',
            status: 'warning',
          });
        }
      } catch (error) {
        console.error('Error processing audio for transcription', error);
        const message =
          error instanceof Error && error.message
            ? error.message
            : 'An error occurred while processing the audio';

        showToast({
          message,
          status: 'error',
        });
      } finally {
        setIsLoading(false);
      }
    },
    [handleTranscriptionSuccess, languageSTT, showToast],
  );

  const processRecording = useCallback(async () => {
    cleanupRecorder();
    stopMediaTracks();
    setIsListening(false);

    const chunks = audioChunksRef.current;
    audioChunksRef.current = [];

    if (!chunks.length) {
      showToast({ message: 'The audio was too short', status: 'warning' });
      return;
    }

    const mimeType = audioMimeTypeRef.current;
    const audioBlob = new Blob(chunks, { type: mimeType });

    if (audioBlob.size === 0) {
      showToast({ message: 'The audio was too short', status: 'warning' });
      return;
    }

    clearAutoSendTimeout();
    await sendTranscription(audioBlob);
  }, [
    cleanupRecorder,
    clearAutoSendTimeout,
    sendTranscription,
    showToast,
    stopMediaTracks,
  ]);

  const startRecording = useCallback(async () => {
    if (!isExternalSTTEnabled) {
      return;
    }

    if (
      typeof window === 'undefined' ||
      typeof window.MediaRecorder === 'undefined' ||
      typeof MediaRecorder === 'undefined'
    ) {
      showToast({
        message: 'MediaRecorder is not supported in this browser',
        status: 'error',
      });
      return;
    }

    if (isListening || isLoading) {
      showToast({ message: 'A recording is already in progress', status: 'warning' });
      return;
    }

    const stream = await requestStream();
    if (!stream) {
      return;
    }

    audioStreamRef.current = stream;
    audioChunksRef.current = [];

    const mimeType = getBestSupportedMimeType();
    audioMimeTypeRef.current = mimeType;

    try {
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        void processRecording();
      };

      recorder.start();
      setIsListening(true);
    } catch (error) {
      console.error('Error starting MediaRecorder', error);
      showToast({
        message: 'Unable to start recording',
        status: 'error',
      });
      cleanupRecorder();
      stopMediaTracks();
    }
  }, [
    cleanupRecorder,
    isExternalSTTEnabled,
    isListening,
    isLoading,
    processRecording,
    requestStream,
    showToast,
    stopMediaTracks,
  ]);

  const stopRecording = useCallback(() => {
    if (!isListening) {
      return;
    }

    const recorder = mediaRecorderRef.current;

    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    } else {
      cleanupRecorder();
      stopMediaTracks();
      setIsListening(false);
    }
  }, [cleanupRecorder, isListening, stopMediaTracks]);

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
    (e: KeyboardEvent) => {
      if (!isExternalSTTEnabled || !enableHotkeys) {
        return;
      }

      if (e.shiftKey && e.altKey && e.code === 'KeyL') {
        if (permission === false) {
          void requestStream();
          e.preventDefault();
          return;
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
      enableHotkeys,
      isExternalSTTEnabled,
      isListening,
      permission,
      requestStream,
      startRecording,
      stopRecording,
    ],
  );

  useEffect(() => {
    if (!enableHotkeys || !isExternalSTTEnabled) {
      return undefined;
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [enableHotkeys, handleKeyDown, isExternalSTTEnabled]);

  useEffect(() => {
    return () => {
      clearAutoSendTimeout();
      cleanupRecorder();
      stopMediaTracks();
    };
  }, [cleanupRecorder, clearAutoSendTimeout, stopMediaTracks]);

  return {
    isListening,
    externalStopRecording,
    externalStartRecording,
    isLoading,
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
    if (ua.includes('safari') && !ua.includes('chrome')) {
      return 'audio/mp4';
    }

    if (ua.includes('firefox')) {
      return 'audio/ogg';
    }
  }

  return 'audio/webm';
}

function getFileExtension(mimeType: string) {
  if (mimeType.includes('mp4')) {
    return 'm4a';
  }

  if (mimeType.includes('ogg')) {
    return 'ogg';
  }

  if (mimeType.includes('wav')) {
    return 'wav';
  }

  return 'webm';
}

export default useSpeechToTextExternal;
