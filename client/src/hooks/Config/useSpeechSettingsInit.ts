import { useEffect, useRef } from 'react';
import { SetterOrUpdater, useSetRecoilState } from 'recoil';
import { useGetCustomConfigSpeechQuery } from 'librechat-data-provider/react-query';
import { logger } from '~/utils';
import store from '~/store';

type RealtimeSettings = {
  model?: string;
  transport: 'websocket' | 'webrtc';
  stream: boolean;
  inputAudioFormat: {
    encoding: string;
    sampleRate: number;
    channels: number;
  };
  ffmpegPath?: string;
};

type RealtimeSettingsUpdate = Partial<RealtimeSettings> & {
  inputAudioFormat?: Partial<RealtimeSettings['inputAudioFormat']>;
};

/**
 * Initializes speech-related Recoil values from the server-side custom
 * configuration on first load (only when the user is authenticated)
 */
export default function useSpeechSettingsInit(isAuthenticated: boolean) {
  const { data } = useGetCustomConfigSpeechQuery({ enabled: isAuthenticated });

  const setters = useRef({
    advancedMode: useSetRecoilState(store.advancedMode),
    speechToText: useSetRecoilState(store.speechToText),
    textToSpeech: useSetRecoilState(store.textToSpeech),
    cacheTTS: useSetRecoilState(store.cacheTTS),
    engineSTT: useSetRecoilState(store.engineSTT),
    languageSTT: useSetRecoilState(store.languageSTT),
    autoTranscribeAudio: useSetRecoilState(store.autoTranscribeAudio),
    decibelValue: useSetRecoilState(store.decibelValue),
    autoSendText: useSetRecoilState(store.autoSendText),
    engineTTS: useSetRecoilState(store.engineTTS),
    voice: useSetRecoilState(store.voice),
    cloudBrowserVoices: useSetRecoilState(store.cloudBrowserVoices),
    languageTTS: useSetRecoilState(store.languageTTS),
    automaticPlayback: useSetRecoilState(store.automaticPlayback),
    playbackRate: useSetRecoilState(store.playbackRate),
    realtime: useSetRecoilState(store.realtimeSTTOptions),
  }).current;

  const storageKeyOverrides = useRef<Record<string, string>>({
    realtime: 'realtimeSTTOptions',
  }).current;

  useEffect(() => {
    const migrationFlagKey = 'speechEngineExternalMigration';

    if (localStorage.getItem(migrationFlagKey) === 'true') {
      return;
    }

    const migrateEngineSetting = (
      key: 'engineSTT' | 'engineTTS',
      setter: SetterOrUpdater<string>,
    ) => {
      const storedValue = localStorage.getItem(key);

      if (storedValue === null) {
        return;
      }

      try {
        const parsedValue = JSON.parse(storedValue);

        if (parsedValue !== 'external') {
          logger.log(`Migrating ${key} speech engine to 'external'`);
          setter('external');
        }
      } catch (error) {
        logger.warn(
          `Failed to parse stored ${key} value. Resetting to 'external'.`,
          error,
        );
        setter('external');
      }
    };

    migrateEngineSetting('engineSTT', setters.engineSTT);
    migrateEngineSetting('engineTTS', setters.engineTTS);
    localStorage.setItem(migrationFlagKey, 'true');
  }, [setters]);

  useEffect(() => {
    if (!isAuthenticated || !data || data.message === 'not_found') return;

    logger.log('Initializing speech settings from config:', data);

    Object.entries(data).forEach(([key, value]) => {
      if (key === 'sttExternal' || key === 'ttsExternal') return;

      const storageKey = storageKeyOverrides[key] ?? key;

      if (localStorage.getItem(storageKey) !== null) return;

      const setter = setters[key as keyof typeof setters];
      if (setter) {
        logger.log(`Setting default speech setting: ${key} = ${value}`);
        if (key === 'realtime' && typeof value === 'object' && value !== null) {
          const realtimeValue = value as RealtimeSettingsUpdate;

          setter((previous: RealtimeSettings) => ({
            ...previous,
            ...realtimeValue,
            inputAudioFormat: {
              ...previous.inputAudioFormat,
              ...(realtimeValue.inputAudioFormat ?? {}),
            },
          }));
          return;
        }

        setter(value as any);
      }
    });
  }, [isAuthenticated, data, setters]);
}
