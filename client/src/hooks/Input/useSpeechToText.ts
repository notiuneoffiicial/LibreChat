import useSpeechToTextBrowser from './useSpeechToTextBrowser';
import useSpeechToTextExternal from './useSpeechToTextExternal';
import useSpeechToTextRealtime from './useSpeechToTextRealtime';
import useGetAudioSettings from './useGetAudioSettings';

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
  const { speechToTextEndpoint } = useGetAudioSettings();
  const externalSpeechToText = speechToTextEndpoint === 'external';
  const realtimeSpeechToText = speechToTextEndpoint === 'realtime';

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
  } = useSpeechToTextRealtime(setText, onTranscriptionComplete, options);

  const pickSpeechValue = <T,>(realtimeValue: T, externalValue: T, browserValue: T): T => {
    if (realtimeSpeechToText) {
      return realtimeValue;
    }

    if (externalSpeechToText) {
      return externalValue;
    }

    return browserValue;
  };

  const isListening = pickSpeechValue(
    speechIsListeningRealtime,
    speechIsListeningExternal,
    speechIsListeningBrowser,
  );
  const isLoading = pickSpeechValue(
    speechIsLoadingRealtime,
    speechIsLoadingExternal,
    speechIsLoadingBrowser,
  );

  const startRecording = pickSpeechValue(
    startSpeechRecordingRealtime,
    startSpeechRecordingExternal,
    startSpeechRecordingBrowser,
  );
  const stopRecording = pickSpeechValue(
    stopSpeechRecordingRealtime,
    stopSpeechRecordingExternal,
    stopSpeechRecordingBrowser,
  );

  return {
    isLoading,
    isListening,
    stopRecording,
    startRecording,
  };
};

export default useSpeechToText;
