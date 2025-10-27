import { useMemo } from 'react';
import useSpeechToTextBrowser from './useSpeechToTextBrowser';
import useSpeechToTextExternal from './useSpeechToTextExternal';
import useSpeechToTextRealtime from './useSpeechToTextRealtime';
import useGetAudioSettings from './useGetAudioSettings';
import { DEFAULT_REALTIME_STT_OPTIONS } from '~/store/settings';

import type { SpeechToTextOptions } from './types';

const useSpeechToText = (
  setText: (text: string) => void,
  onTranscriptionComplete: (text: string) => void,
  options?: SpeechToTextOptions,
): {
  isLoading?: boolean;
  isListening?: boolean;
  stopRecording: () => void | (() => Promise<void>);
  startRecording: () => void | (() => Promise<void>);
} => {
  const { speechToTextEndpoint, realtime } = useGetAudioSettings();
  const externalSpeechToText = speechToTextEndpoint === 'external';
  const realtimeSpeechToText = speechToTextEndpoint === 'realtime';

  const realtimeOptions = useMemo(() => {
    const defaults = realtime ?? DEFAULT_REALTIME_STT_OPTIONS;
    const base: SpeechToTextOptions = { ...(options ?? {}) };
    const session = defaults.session ?? {};
    const include = Array.isArray(defaults.include) ? defaults.include : undefined;
    const audioInput = defaults.audio?.input ?? {};

    if (base.mode === undefined && session.mode) {
      base.mode = session.mode;
    }

    if (base.model === undefined) {
      base.model = session.model ?? defaults.model;
    }

    if (base.voice === undefined && session.voice) {
      base.voice = session.voice;
    }

    if (base.instructions === undefined && session.instructions) {
      base.instructions = session.instructions;
    }

    if (base.include === undefined && include) {
      base.include = include;
    }

    if (base.turnDetection === undefined && audioInput.turnDetection) {
      base.turnDetection = audioInput.turnDetection;
    }

    if (base.noiseReduction === undefined && audioInput.noiseReduction !== undefined) {
      base.noiseReduction = audioInput.noiseReduction;
    }

    return base;
  }, [options, realtime]);

  const {
    isListening: speechIsListeningBrowser,
    isLoading: speechIsLoadingBrowser,
    startRecording: startSpeechRecordingBrowser,
    stopRecording: stopSpeechRecordingBrowser,
  } = useSpeechToTextBrowser(setText, onTranscriptionComplete, options);

  const {
    isListening: speechIsListeningExternal,
    isLoading: speechIsLoadingExternal,
    externalStartRecording: startSpeechRecordingExternal,
    externalStopRecording: stopSpeechRecordingExternal,
  } = useSpeechToTextExternal(setText, onTranscriptionComplete, options);

  const {
    isListening: speechIsListeningRealtime,
    isLoading: speechIsLoadingRealtime,
    startRecording: startSpeechRecordingRealtime,
    stopRecording: stopSpeechRecordingRealtime,
  } = useSpeechToTextRealtime(setText, onTranscriptionComplete, realtimeOptions);

  const isListening = realtimeSpeechToText
    ? speechIsListeningRealtime
    : externalSpeechToText
      ? speechIsListeningExternal
      : speechIsListeningBrowser;
  const isLoading = realtimeSpeechToText
    ? speechIsLoadingRealtime
    : externalSpeechToText
      ? speechIsLoadingExternal
      : speechIsLoadingBrowser;

  const startRecording = realtimeSpeechToText
    ? startSpeechRecordingRealtime
    : externalSpeechToText
      ? startSpeechRecordingExternal
      : startSpeechRecordingBrowser;
  const stopRecording = realtimeSpeechToText
    ? stopSpeechRecordingRealtime
    : externalSpeechToText
      ? stopSpeechRecordingExternal
      : stopSpeechRecordingBrowser;

  return {
    isLoading,
    isListening,
    stopRecording,
    startRecording,
  };
};

export default useSpeechToText;
