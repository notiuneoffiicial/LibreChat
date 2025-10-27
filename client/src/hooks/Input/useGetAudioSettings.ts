import { useMemo } from 'react';
import { useRecoilValue } from 'recoil';
import store from '~/store';
import { DEFAULT_REALTIME_STT_OPTIONS } from '~/store/settings';

const useGetAudioSettings = () => {
  const engineSTT = useRecoilValue<string>(store.engineSTT);
  const engineTTS = useRecoilValue<string>(store.engineTTS);
  const speechToTextEnabled = useRecoilValue(store.speechToText);
  const textToSpeechEnabled = useRecoilValue(store.textToSpeech);
  const realtimeOptions =
    useRecoilValue(store.realtimeSTTOptions) ?? DEFAULT_REALTIME_STT_OPTIONS;

  const speechToTextEndpoint = engineSTT;
  const textToSpeechEndpoint = engineTTS;

  return useMemo(
    () => ({
      speechToTextEndpoint,
      textToSpeechEndpoint,
      speechToTextEnabled,
      textToSpeechEnabled,
      realtime: realtimeOptions ?? DEFAULT_REALTIME_STT_OPTIONS,
    }),
    [
      speechToTextEndpoint,
      textToSpeechEndpoint,
      speechToTextEnabled,
      textToSpeechEnabled,
      realtimeOptions,
    ],
  );
};

export default useGetAudioSettings;
