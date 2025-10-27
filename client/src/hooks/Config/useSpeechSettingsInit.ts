import { useEffect, useRef } from 'react';
import { SetterOrUpdater, useSetRecoilState } from 'recoil';
import { useGetCustomConfigSpeechQuery } from 'librechat-data-provider/react-query';
import { logger } from '~/utils';
import store from '~/store';
import {
  DEFAULT_REALTIME_STT_OPTIONS,
  type RealtimeSTTOptions,
  type RealtimeSTTAudioOptions,
  type RealtimeSTTSessionDefaults,
} from '~/store/settings';

type RealtimeAudioUpdate = Partial<RealtimeSTTAudioOptions> & {
  input?: Partial<NonNullable<RealtimeSTTAudioOptions['input']>> & {
    format?: Partial<RealtimeSTTOptions['inputAudioFormat']>;
  };
};

type RealtimeSettingsUpdate = Partial<
  Omit<RealtimeSTTOptions, 'inputAudioFormat' | 'audio' | 'session'>
> & {
  inputAudioFormat?: Partial<RealtimeSTTOptions['inputAudioFormat']>;
  session?: Partial<RealtimeSTTSessionDefaults>;
  audio?: RealtimeAudioUpdate;
};

const mergeRealtimeDefaults = (
  previous: RealtimeSTTOptions | undefined,
  update: RealtimeSettingsUpdate,
): RealtimeSTTOptions => {
  const base: RealtimeSTTOptions = {
    ...DEFAULT_REALTIME_STT_OPTIONS,
    ...(previous ?? {}),
    ...update,
    inputAudioFormat: {
      ...DEFAULT_REALTIME_STT_OPTIONS.inputAudioFormat,
      ...(previous?.inputAudioFormat ?? {}),
      ...(update.inputAudioFormat ?? {}),
    },
  };

  const mergedSession = {
    ...(DEFAULT_REALTIME_STT_OPTIONS.session ?? {}),
    ...(previous?.session ?? {}),
    ...(update.session ?? {}),
  };

  base.session = Object.keys(mergedSession).length ? mergedSession : undefined;

  const mergedAudioInputFormat = {
    ...(DEFAULT_REALTIME_STT_OPTIONS.audio?.input?.format ?? {}),
    ...(previous?.audio?.input?.format ?? {}),
    ...(update.audio?.input?.format ?? {}),
  };

  const mergedAudioInput = {
    ...(DEFAULT_REALTIME_STT_OPTIONS.audio?.input ?? {}),
    ...(previous?.audio?.input ?? {}),
    ...(update.audio?.input ?? {}),
  };

  if (Object.keys(mergedAudioInputFormat).length) {
    mergedAudioInput.format = mergedAudioInputFormat;
  }

  const mergedAudio = {
    ...(DEFAULT_REALTIME_STT_OPTIONS.audio ?? {}),
    ...(previous?.audio ?? {}),
    ...(update.audio ?? {}),
  };

  if (Object.keys(mergedAudioInput).length) {
    mergedAudio.input = mergedAudioInput;
  }

  base.audio = Object.keys(mergedAudio).length ? mergedAudio : undefined;
  const includeSource =
    update.include ?? previous?.include ?? DEFAULT_REALTIME_STT_OPTIONS.include;
  base.include = includeSource ? [...includeSource] : includeSource;

  return base;
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
      const setter = setters[key as keyof typeof setters];
      if (!setter) {
        return;
      }

      const hasStoredValue = localStorage.getItem(storageKey) !== null;

      if (key === 'realtime' && typeof value === 'object' && value !== null) {
        const realtimeValue = value as RealtimeSettingsUpdate;
        logger.log('Merging realtime speech defaults with config overrides:', realtimeValue);
        setter((previous) => mergeRealtimeDefaults(previous, realtimeValue));
        return;
      }

      if (hasStoredValue) {
        return;
      }

      logger.log(`Setting default speech setting: ${key} = ${value}`);
      setter(value as any);
    });
  }, [isAuthenticated, data, setters]);
}
