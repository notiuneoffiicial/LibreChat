import { atom } from 'recoil';
import { SettingsViews, LocalStorageKeys } from 'librechat-data-provider';
import { atomWithLocalStorage } from '~/store/utils';
import type { TOptionSettings } from '~/common';

export type RealtimeSTTTurnDetectionConfig = {
  type?: 'server_vad' | 'semantic';
  serverVad?: {
    enabled?: boolean;
    threshold?: number;
    silenceDurationMs?: number;
    minSpeechDurationMs?: number;
    prefixPaddingMs?: number;
    postfixPaddingMs?: number;
    [key: string]: unknown;
  };
  semantic?: {
    enabled?: boolean;
    minDecisionIntervalMs?: number;
    speechProbThreshold?: number;
    activationThreshold?: number;
    deactivationThreshold?: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export type RealtimeSTTTranscriptionDefaults = {
  model?: string;
  language?: string;
  prompt?: string;
  temperature?: number;
  responseFormat?: string;
  diarization?: boolean;
  enableWordTimestamps?: boolean;
  timestampGranularities?: string[];
  [key: string]: unknown;
};

export type RealtimeSTTNoiseReduction =
  | string
  | ({
      type?: string;
      preset?: string;
      enabled?: boolean;
      [key: string]: unknown;
    } & Record<string, unknown>);

export type RealtimeSTTAudioInputOptions = {
  format?: {
    encoding?: string;
    sampleRate?: number;
    channels?: number;
  };
  noiseReduction?: RealtimeSTTNoiseReduction;
  transcriptionDefaults?: RealtimeSTTTranscriptionDefaults;
  turnDetection?: RealtimeSTTTurnDetectionConfig;
  [key: string]: unknown;
};

export type RealtimeSTTAudioOptions = {
  input?: RealtimeSTTAudioInputOptions;
  [key: string]: unknown;
};

export type RealtimeSTTSessionDefaults = {
  mode?: string;
  model?: string;
  voice?: string;
  voices?: string[];
  speechToSpeech?: boolean;
  instructions?: string;
  instructionTemplates?: Record<string, string>;
  [key: string]: unknown;
};

export type RealtimeSTTOptions = {
  model?: string;
  transport: 'websocket' | 'webrtc';
  stream: boolean;
  inputAudioFormat: {
    encoding: string;
    sampleRate: number;
    channels: number;
  };
  ffmpegPath?: string;
  session?: RealtimeSTTSessionDefaults;
  audio?: RealtimeSTTAudioOptions;
  include?: string[];
};

export const DEFAULT_REALTIME_STT_OPTIONS: RealtimeSTTOptions = {
  model: '',
  transport: 'websocket',
  stream: true,
  inputAudioFormat: {
    encoding: 'pcm16',
    sampleRate: 24000,
    channels: 1,
  },
  audio: {
    input: {
      format: {
        encoding: 'pcm16',
        sampleRate: 24000,
        channels: 1,
      },
    },
  },
  include: [],
};

// Static atoms without localStorage
const staticAtoms = {
  abortScroll: atom<boolean>({ key: 'abortScroll', default: false }),
  showFiles: atom<boolean>({ key: 'showFiles', default: false }),
  optionSettings: atom<TOptionSettings>({ key: 'optionSettings', default: {} }),
  showPluginStoreDialog: atom<boolean>({ key: 'showPluginStoreDialog', default: false }),
  showAgentSettings: atom<boolean>({ key: 'showAgentSettings', default: false }),
  currentSettingsView: atom<SettingsViews>({
    key: 'currentSettingsView',
    default: SettingsViews.default,
  }),
  showPopover: atom<boolean>({ key: 'showPopover', default: false }),
};

const localStorageAtoms = {
  // General settings
  autoScroll: atomWithLocalStorage('autoScroll', false),
  hideSidePanel: atomWithLocalStorage('hideSidePanel', false),
  fontSize: atomWithLocalStorage('fontSize', 'text-base'),
  enableUserMsgMarkdown: atomWithLocalStorage<boolean>(
    LocalStorageKeys.ENABLE_USER_MSG_MARKDOWN,
    true,
  ),

  // Chat settings
  enterToSend: atomWithLocalStorage('enterToSend', true),
  maximizeChatSpace: atomWithLocalStorage('maximizeChatSpace', false),
  chatDirection: atomWithLocalStorage('chatDirection', 'LTR'),
  showCode: atomWithLocalStorage(LocalStorageKeys.SHOW_ANALYSIS_CODE, true),
  saveDrafts: atomWithLocalStorage('saveDrafts', true),
  showScrollButton: atomWithLocalStorage('showScrollButton', true),
  latexParsing: atomWithLocalStorage('latexParsing', true),
  forkSetting: atomWithLocalStorage('forkSetting', ''),
  splitAtTarget: atomWithLocalStorage('splitAtTarget', false),
  rememberDefaultFork: atomWithLocalStorage(LocalStorageKeys.REMEMBER_FORK_OPTION, false),
  showThinking: atomWithLocalStorage('showThinking', false),
  saveBadgesState: atomWithLocalStorage('saveBadgesState', false),

  // Beta features settings
  modularChat: atomWithLocalStorage('modularChat', true),
  centerFormOnLanding: atomWithLocalStorage('centerFormOnLanding', true),
  showFooter: atomWithLocalStorage('showFooter', true),

  // Commands settings
  plusCommand: atomWithLocalStorage('plusCommand', true),
  slashCommand: atomWithLocalStorage('slashCommand', true),

  // Speech settings
  advancedMode: atomWithLocalStorage('advancedMode', false),

  speechToText: atomWithLocalStorage('speechToText', true),
  engineSTT: atomWithLocalStorage('engineSTT', 'external'),
  languageSTT: atomWithLocalStorage('languageSTT', ''),
  autoTranscribeAudio: atomWithLocalStorage('autoTranscribeAudio', false),
  decibelValue: atomWithLocalStorage('decibelValue', -45),
  autoSendText: atomWithLocalStorage('autoSendText', -1),
  realtimeSTTOptions: atomWithLocalStorage<RealtimeSTTOptions>(
    'realtimeSTTOptions',
    DEFAULT_REALTIME_STT_OPTIONS,
  ),

  textToSpeech: atomWithLocalStorage('textToSpeech', true),
  engineTTS: atomWithLocalStorage('engineTTS', 'external'),
  voice: atomWithLocalStorage<string | undefined>('voice', undefined),
  cloudBrowserVoices: atomWithLocalStorage('cloudBrowserVoices', false),
  languageTTS: atomWithLocalStorage('languageTTS', ''),
  automaticPlayback: atomWithLocalStorage('automaticPlayback', false),
  playbackRate: atomWithLocalStorage<number | null>('playbackRate', null),
  cacheTTS: atomWithLocalStorage('cacheTTS', true),

  // Account settings
  UsernameDisplay: atomWithLocalStorage('UsernameDisplay', true),
};

export default { ...staticAtoms, ...localStorageAtoms };
