import { EToolResources } from './assistants';

export enum FileSources {
  local = 'local',
  firebase = 'firebase',
  azure = 'azure',
  azure_blob = 'azure_blob',
  openai = 'openai',
  s3 = 's3',
  vectordb = 'vectordb',
  execute_code = 'execute_code',
  mistral_ocr = 'mistral_ocr',
  azure_mistral_ocr = 'azure_mistral_ocr',
  vertexai_mistral_ocr = 'vertexai_mistral_ocr',
  text = 'text',
}

export const checkOpenAIStorage = (source: string) =>
  source === FileSources.openai || source === FileSources.azure;

export enum FileContext {
  avatar = 'avatar',
  unknown = 'unknown',
  agents = 'agents',
  assistants = 'assistants',
  execute_code = 'execute_code',
  image_generation = 'image_generation',
  assistants_output = 'assistants_output',
  message_attachment = 'message_attachment',
  filename = 'filename',
  updatedAt = 'updatedAt',
  source = 'source',
  filterSource = 'filterSource',
  context = 'context',
  bytes = 'bytes',
}

export type EndpointFileConfig = {
  disabled?: boolean;
  fileLimit?: number;
  fileSizeLimit?: number;
  totalSizeLimit?: number;
  supportedMimeTypes?: RegExp[];
};

export type FileConfig = {
  endpoints: {
    [key: string]: EndpointFileConfig;
  };
  fileTokenLimit?: number;
  serverFileSizeLimit?: number;
  avatarSizeLimit?: number;
  clientImageResize?: {
    enabled?: boolean;
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
  };
  ocr?: {
    supportedMimeTypes?: RegExp[];
  };
  text?: {
    supportedMimeTypes?: RegExp[];
  };
  stt?: {
    supportedMimeTypes?: RegExp[];
  };
  checkType?: (fileType: string, supportedTypes: RegExp[]) => boolean;
};

export type FileConfigInput = {
  endpoints?: {
    [key: string]: EndpointFileConfig;
  };
  serverFileSizeLimit?: number;
  avatarSizeLimit?: number;
  clientImageResize?: {
    enabled?: boolean;
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
  };
  ocr?: {
    supportedMimeTypes?: string[];
  };
  text?: {
    supportedMimeTypes?: string[];
  };
  stt?: {
    supportedMimeTypes?: string[];
  };
  checkType?: (fileType: string, supportedTypes: RegExp[]) => boolean;
};

export type TFile = {
  _id?: string;
  __v?: number;
  user: string;
  conversationId?: string;
  message?: string;
  file_id: string;
  temp_file_id?: string;
  bytes: number;
  embedded: boolean;
  filename: string;
  filepath: string;
  object: 'file';
  type: string;
  usage: number;
  context?: FileContext;
  source?: FileSources;
  filterSource?: FileSources;
  width?: number;
  height?: number;
  expiresAt?: string | Date;
  preview?: string;
  metadata?: { fileIdentifier?: string };
  createdAt?: string | Date;
  updatedAt?: string | Date;
};

export type TFileUpload = TFile & {
  temp_file_id: string;
};

export type AvatarUploadResponse = {
  url: string;
};

export type SpeechToTextResponse = {
  text: string;
};

export type VoiceResponse = string[];

export type RealtimeSessionClientSecret = {
  value: string;
  expires_at?: string;
  [key: string]: unknown;
};

export type RealtimeSession = {
  id: string;
  client_secret: RealtimeSessionClientSecret;
  expires_at?: string;
  [key: string]: unknown;
};

export type RealtimeSessionDefaults = {
  type?: string;
  model?: string;
  speechToSpeech?: boolean;
  instructions?: string;
  modalities?: string[];
  include?: string[];
  voice?: string;
  voices?: string[];
  audio?: RealtimeAudioConfig;
  [key: string]: unknown;
};

export type RealtimeTurnDetectionConfig = {
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

export type RealtimeTranscriptionDefaults = {
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

export type RealtimeNoiseReduction =
  | string
  | ({
      type?: string;
      preset?: string;
      enabled?: boolean;
      [key: string]: unknown;
    } & Record<string, unknown>);

export type RealtimeAudioFormat = {
  encoding?: string | { codec?: string; [key: string]: unknown };
  rate?: number;
  sampleRate?: number;
  channels?: number;
  [key: string]: unknown;
};

export type RealtimeAudioInputConfig = {
  format?: RealtimeAudioFormat;
  noiseReduction?: RealtimeNoiseReduction;
  noise_reduction?: RealtimeNoiseReduction;
  transcriptionDefaults?: RealtimeTranscriptionDefaults;
  transcription?: RealtimeTranscriptionDefaults;
  turnDetection?: RealtimeTurnDetectionConfig;
  turn_detection?: RealtimeTurnDetectionConfig;
  [key: string]: unknown;
};

export type RealtimeAudioOutputConfig = {
  voice?: string;
  voices?: string[];
  format?: RealtimeAudioFormat;
  [key: string]: unknown;
};

export type RealtimeAudioConfig = {
  input?: RealtimeAudioInputConfig;
  output?: RealtimeAudioOutputConfig;
  [key: string]: unknown;
};

export type RealtimeSessionOverrides = {
  type?: string;
  model?: string;
  instructions?: string;
  modalities?: string[];
  include?: string[];
  speechToSpeech?: boolean;
  speech_to_speech?: boolean;
  audio?: RealtimeAudioConfig;
  [key: string]: unknown;
};

export type RealtimeCallOverrides = {
  session?: RealtimeSessionOverrides;
  include?: string[];
  type?: string;
  model?: string;
  voice?: string;
  instructions?: string;
  audio?: RealtimeAudioConfig;
  turnDetection?: RealtimeTurnDetectionConfig;
  noiseReduction?: RealtimeNoiseReduction;
  transcription?: RealtimeTranscriptionDefaults;
  [key: string]: unknown;
};

export type RealtimeCallRequest = {
  sdpOffer: string;
  session?: RealtimeSessionOverrides;
  include?: string[];
  transcription?: RealtimeTranscriptionDefaults;
  [key: string]: unknown;
};

export type RealtimeCallResponse = {
  sdpAnswer: string;
  expiresAt?: number | string;
};

export type UploadMutationOptions = {
  onSuccess?: (data: TFileUpload, variables: FormData, context?: unknown) => void;
  onMutate?: (variables: FormData) => void | Promise<unknown>;
  onError?: (error: unknown, variables: FormData, context?: unknown) => void;
};

export type UploadAvatarOptions = {
  onSuccess?: (data: AvatarUploadResponse, variables: FormData, context?: unknown) => void;
  onMutate?: (variables: FormData) => void | Promise<unknown>;
  onError?: (error: unknown, variables: FormData, context?: unknown) => void;
};

export type SpeechToTextOptions = {
  onSuccess?: (data: SpeechToTextResponse, variables: FormData, context?: unknown) => void;
  onMutate?: (variables: FormData) => void | Promise<unknown>;
  onError?: (error: unknown, variables: FormData, context?: unknown) => void;
};

export type TextToSpeechOptions = {
  onSuccess?: (data: ArrayBuffer, variables: FormData, context?: unknown) => void;
  onMutate?: (variables: FormData) => void | Promise<unknown>;
  onError?: (error: unknown, variables: FormData, context?: unknown) => void;
};

export type VoiceOptions = {
  onSuccess?: (data: VoiceResponse, variables: unknown, context?: unknown) => void;
  onMutate?: () => void | Promise<unknown>;
  onError?: (error: unknown, variables: unknown, context?: unknown) => void;
};

export type DeleteFilesResponse = {
  message: string;
  result: Record<string, unknown>;
};

export type BatchFile = {
  file_id: string;
  filepath: string;
  embedded: boolean;
  source: FileSources;
  temp_file_id?: string;
};

export type DeleteFilesBody = {
  files: BatchFile[];
  agent_id?: string;
  assistant_id?: string;
  tool_resource?: EToolResources;
};

export type DeleteMutationOptions = {
  onSuccess?: (data: DeleteFilesResponse, variables: DeleteFilesBody, context?: unknown) => void;
  onMutate?: (variables: DeleteFilesBody) => void | Promise<unknown>;
  onError?: (error: unknown, variables: DeleteFilesBody, context?: unknown) => void;
};
