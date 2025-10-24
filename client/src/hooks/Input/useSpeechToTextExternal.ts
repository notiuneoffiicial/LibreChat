import { useState, useEffect, useRef } from 'react';
import { useRecoilState } from 'recoil';
import { useToastContext } from '@librechat/client';
import { useSpeechToTextMutation } from '~/data-provider';
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
  const audioStream = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const dataHandlerRef = useRef<((event: BlobEvent) => void) | null>(null);

  const [permission, setPermission] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [isRequestBeingMade, setIsRequestBeingMade] = useState(false);
  const [audioMimeType, setAudioMimeType] = useState<string>(() => getBestSupportedMimeType());
  const audioMimeTypeRef = useRef<string>(audioMimeType);
  const { autoSendOnSuccess = false, enableHotkeys = true } = options ?? {};

  const [autoSendText] = useRecoilState(store.autoSendText);
  const [languageSTT] = useRecoilState<string>(store.languageSTT);
  const [speechToText] = useRecoilState<boolean>(store.speechToText);

  const { mutate: processAudio, isLoading: isProcessing } = useSpeechToTextMutation({
    onSuccess: (data) => {
      const extractedText = data.text ?? '';
      setText(extractedText);
      setIsRequestBeingMade(false);

      const trimmedText = extractedText.trim();
      if (!trimmedText) {
        return;
      }

      const shouldAutoSend = autoSendOnSuccess || (speechToText && autoSendText > -1);

      if (!shouldAutoSend) {
        return;
      }

      const delaySeconds = autoSendText > -1 ? autoSendText : 0;
      const delay = delaySeconds > 0 ? delaySeconds * 1000 : 0;

      if (delay > 0) {
        setTimeout(() => {
          onTranscriptionComplete(extractedText);
        }, delay);
      } else {
        onTranscriptionComplete(extractedText);
      }
    },
    onError: () => {
      showToast({
        message: 'An error occurred while processing the audio, maybe the audio was too short',
        status: 'error',
      });
      setIsRequestBeingMade(false);
    },
  });

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

  const getFileExtension = (mimeType: string) => {
    if (mimeType.includes('mp4')) {
      return 'm4a';
    } else if (mimeType.includes('ogg')) {
      return 'ogg';
    } else if (mimeType.includes('wav')) {
      return 'wav';
    } else {
      return 'webm';
    }
  };

  const stopMediaTracks = () => {
    if (audioStream.current) {
      audioStream.current.getTracks().forEach((track) => track.stop());
      audioStream.current = null;
    }
  };

  const cleanupRecorder = () => {
    const recorder = mediaRecorderRef.current;

    if (!recorder) {
      return;
    }

    if (dataHandlerRef.current) {
      recorder.removeEventListener('dataavailable', dataHandlerRef.current);
      dataHandlerRef.current = null;
    }

    recorder.removeEventListener('stop', handleStop);
    mediaRecorderRef.current = null;
  };

  const getMicrophonePermission = async () => {
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
  };

  const handleStop = () => {
    const mimeType = audioMimeTypeRef.current;

    if (audioChunks.length > 0) {
      const audioBlob = new Blob(audioChunks, { type: mimeType });
      const fileExtension = getFileExtension(mimeType);

      setAudioChunks([]);

      const formData = new FormData();
      formData.append('audio', audioBlob, `audio.${fileExtension}`);
      if (languageSTT) {
        formData.append('language', languageSTT);
      }
      setIsRequestBeingMade(true);
      cleanupRecorder();
      processAudio(formData);
    } else {
      showToast({ message: 'The audio was too short', status: 'warning' });
    }

    stopMediaTracks();
  };

  const startRecording = async () => {
    if (isRequestBeingMade) {
      showToast({ message: 'A request is already being made. Please wait.', status: 'warning' });
      return;
    }

    if (!audioStream.current) {
      await getMicrophonePermission();
    }

    if (audioStream.current) {
      try {
        setAudioChunks([]);
        const bestMimeType = getBestSupportedMimeType();
        audioMimeTypeRef.current = bestMimeType;
        setAudioMimeType(bestMimeType);

        const recorder = new MediaRecorder(audioStream.current, {
          mimeType: bestMimeType,
        });
        const handleDataAvailable = (event: BlobEvent) => {
          audioChunks.push(event.data);
        };

        dataHandlerRef.current = handleDataAvailable;
        recorder.addEventListener('dataavailable', handleDataAvailable);
        recorder.addEventListener('stop', handleStop);
        recorder.start(100);
        mediaRecorderRef.current = recorder;
        setIsListening(true);
      } catch (error) {
        showToast({ message: `Error starting recording: ${error}`, status: 'error' });
      }
    } else {
      showToast({ message: 'Microphone permission not granted', status: 'error' });
    }
  };

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;

    if (recorder && recorder.state === 'recording') {
      recorder.stop();
    } else {
      cleanupRecorder();
    }

    stopMediaTracks();
    setIsListening(false);
  };

  const externalStartRecording = () => {
    if (isListening) {
      showToast({ message: 'Already listening. Please stop recording first.', status: 'warning' });
      return;
    }

    startRecording();
  };

  const externalStopRecording = () => {
    stopRecording();
  };

  const handleKeyDown = async (e: KeyboardEvent) => {
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
        startRecording();
      }

      e.preventDefault();
    }
  };

  useEffect(() => {
    if (!enableHotkeys) {
      return undefined;
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enableHotkeys, isListening]);

  useEffect(() => {
    return () => {
      cleanupRecorder();
      stopMediaTracks();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    isListening,
    externalStopRecording,
    externalStartRecording,
    isLoading: isProcessing,
  };
};

export default useSpeechToTextExternal;
