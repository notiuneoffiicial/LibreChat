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
