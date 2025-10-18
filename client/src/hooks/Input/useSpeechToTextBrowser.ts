import { useCallback, useEffect, useRef, useMemo } from 'react';
import { useRecoilState } from 'recoil';
import { useToastContext } from '@librechat/client';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import useGetAudioSettings from './useGetAudioSettings';
import store from '~/store';

import type { SpeechToTextOptions } from './types';

const useSpeechToTextBrowser = (
  setText: (text: string) => void,
  onTranscriptionComplete: (text: string) => void,
  options?: SpeechToTextOptions,
) => {
  const { showToast } = useToastContext();
  const { speechToTextEndpoint } = useGetAudioSettings();
  const isBrowserSTTEnabled = speechToTextEndpoint === 'browser';

  const lastTranscript = useRef<string | null>(null);
  const lastInterim = useRef<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>();
  const [autoSendText] = useRecoilState(store.autoSendText);
  const [languageSTT] = useRecoilState<string>(store.languageSTT);
  const [autoTranscribeAudio] = useRecoilState<boolean>(store.autoTranscribeAudio);
  const { autoSendOnSuccess = false, enableHotkeys = true } = options ?? {};

  const {
    listening,
    finalTranscript,
    resetTranscript,
    interimTranscript,
    isMicrophoneAvailable,
    browserSupportsSpeechRecognition,
  } = useSpeechRecognition();
  const isListening = useMemo(() => listening, [listening]);

  useEffect(() => {
    if (interimTranscript == null || interimTranscript === '') {
      return;
    }

    if (lastInterim.current === interimTranscript) {
      return;
    }

    setText(interimTranscript);
    lastInterim.current = interimTranscript;
  }, [setText, interimTranscript]);

  useEffect(() => {
    if (finalTranscript == null || finalTranscript === '') {
      return;
    }

    if (lastTranscript.current === finalTranscript) {
      return;
    }

    setText(finalTranscript);
    lastTranscript.current = finalTranscript;
    const trimmedTranscript = finalTranscript.trim();
    if (!trimmedTranscript) {
      return;
    }

    const shouldAutoSend = autoSendOnSuccess || autoSendText > -1;

    if (!shouldAutoSend) {
      return;
    }

    const delaySeconds = autoSendText > -1 ? autoSendText : 0;
    const delay = delaySeconds > 0 ? delaySeconds * 1000 : 0;

    const sendTranscript = () => {
      onTranscriptionComplete(trimmedTranscript);
      resetTranscript();
    };

    if (delay > 0) {
      timeoutRef.current = setTimeout(sendTranscript, delay);
    } else {
      sendTranscript();
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [
    setText,
    onTranscriptionComplete,
    resetTranscript,
    finalTranscript,
    autoSendText,
    autoSendOnSuccess,
  ]);

  const startListening = useCallback(() => {
    if (!browserSupportsSpeechRecognition) {
      showToast({
        message: 'Browser does not support SpeechRecognition',
        status: 'error',
      });
      return;
    }

    if (!isMicrophoneAvailable) {
      showToast({
        message: 'Microphone is not available',
        status: 'error',
      });
      return;
    }

    if (isListening) {
      return;
    }

    SpeechRecognition.startListening({
      language: languageSTT,
      continuous: autoTranscribeAudio,
    });
  }, [
    autoTranscribeAudio,
    browserSupportsSpeechRecognition,
    isListening,
    isMicrophoneAvailable,
    languageSTT,
    showToast,
  ]);

  const stopListening = useCallback(() => {
    if (!isListening) {
      return;
    }

    SpeechRecognition.stopListening();
  }, [isListening]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
      return;
    }

    startListening();
  }, [isListening, startListening, stopListening]);

  useEffect(() => {
    if (!enableHotkeys) {
      return undefined;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.shiftKey && e.altKey && e.code === 'KeyL' && !isBrowserSTTEnabled) {
        toggleListening();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enableHotkeys, isBrowserSTTEnabled, toggleListening]);

  return {
    isListening,
    isLoading: false,
    startRecording: startListening,
    stopRecording: stopListening,
  };
};

export default useSpeechToTextBrowser;
