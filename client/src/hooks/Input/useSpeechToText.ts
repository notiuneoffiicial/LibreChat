import { useMemo } from 'react';
import useSpeechToTextBrowser from './useSpeechToTextBrowser';
import useSpeechToTextExternal from './useSpeechToTextExternal';
import useSpeechToTextRealtime from './useSpeechToTextRealtime';
import useGetAudioSettings from './useGetAudioSettings';
import { DEFAULT_REALTIME_STT_OPTIONS } from '~/store/settings';

import type { SpeechToTextOptions } from './types';

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
    const audioInput = session.audio?.input ?? {};
    const audioOutput = session.audio?.output ?? {};

    if (base.type === undefined && session.type) {
      base.type = session.type;
    }

    if (base.mode === undefined && session.type) {
      base.mode = session.type === 'transcription' ? 'speech_to_text' : 'conversation';
    }

    if (base.model === undefined) {
      base.model = session.model ?? defaults.model;
    }

    if (base.voice === undefined && audioOutput?.voice) {
      base.voice = audioOutput.voice;
    }

    if (base.instructions === undefined && session.instructions) {
      base.instructions = session.instructions;
    }

    if (base.include === undefined) {
      const sanitizedInclude = sanitizeInclude(include, session.include);
      if (sanitizedInclude) {
        base.include = sanitizedInclude;
      }
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
