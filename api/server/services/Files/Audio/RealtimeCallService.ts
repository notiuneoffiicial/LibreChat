import axios, { AxiosInstance } from 'axios';
import FormData from 'form-data';
import { logger } from '@librechat/data-schemas';
import { extractEnvVariable } from 'librechat-data-provider';
import { getAppConfig } from '~/server/services/Config';

export const REALTIME_CALLS_ENDPOINT = 'https://api.openai.com/v1/realtime/calls';

export class RealtimeCallError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status = 500, code?: string) {
    super(message);
    this.name = 'RealtimeCallError';
    this.status = status;
    this.code = code;
  }
}

export interface RealtimeCallOverrides {
  sdpOffer: string;
  mode?: string;
  model?: string;
  voice?: string;
  instructions?: string;
  include?: string[];
  vad?: Record<string, unknown>;
  noiseReduction?: string;
}

export interface RealtimeCallResponse {
  sdpAnswer: string;
  expiresAt?: number | string;
}

interface RealtimeSessionConfig {
  mode?: string;
  model?: string;
  voice?: string;
  voices?: string[];
  instructions?: string;
  speechToSpeech?: boolean;
  instructionTemplates?: Record<string, string>;
}

interface RealtimeAudioInputFormat {
  encoding?: string | { codec?: string; [key: string]: unknown };
  sampleRate?: number;
  channels?: number;
  [key: string]: unknown;
}

interface RealtimeAudioInputConfig {
  format?: RealtimeAudioInputFormat;
  noiseReduction?: string;
  transcriptionDefaults?: Record<string, unknown>;
  turnDetection?: Record<string, unknown>;
}

interface RealtimeAudioConfig {
  input?: RealtimeAudioInputConfig;
}

interface RealtimeConfig {
  apiKey?: string;
  model?: string;
  transport?: string;
  stream?: boolean;
  url?: string;
  session?: RealtimeSessionConfig;
  audio?: RealtimeAudioConfig;
  include?: string[];
}

export class RealtimeCallService {
  private httpClient: AxiosInstance;

  constructor(options?: { httpClient?: AxiosInstance }) {
    this.httpClient = options?.httpClient ?? axios;
  }

  static create(options?: { httpClient?: AxiosInstance }) {
    return new RealtimeCallService(options);
  }

  async createCall(req: any, overrides: RealtimeCallOverrides): Promise<RealtimeCallResponse> {
    if (!overrides || typeof overrides.sdpOffer !== 'string' || overrides.sdpOffer.trim().length === 0) {
      throw new RealtimeCallError('Missing SDP offer', 400);
    }

    const realtimeConfig = await this.loadConfig(req);
    const apiKey = extractEnvVariable(realtimeConfig.apiKey);

    if (!apiKey || typeof apiKey !== 'string') {
      throw new RealtimeCallError('Realtime speech API key is not configured', 500);
    }

    const sessionPayload = this.buildSessionPayload(realtimeConfig, overrides);

    const formData = new FormData();
    formData.append('sdp', overrides.sdpOffer);
    formData.append('session', JSON.stringify(sessionPayload));

    const headers = {
      ...formData.getHeaders(),
      Authorization: `Bearer ${apiKey}`,
      'OpenAI-Beta': 'realtime=v1',
    };

    try {
      const response = await this.httpClient.post(REALTIME_CALLS_ENDPOINT, formData, {
        headers,
      });

      const data = response?.data ?? {};
      const sdpAnswer: string | undefined = data.sdp ?? data.sdp_answer;

      if (!sdpAnswer) {
        throw new RealtimeCallError('Realtime call did not return an SDP answer', 502);
      }

      const expiresAt: number | string | undefined = data.expires_at ?? data.expiresAt;

      return typeof expiresAt !== 'undefined'
        ? { sdpAnswer, expiresAt }
        : { sdpAnswer };
    } catch (error: any) {
      const status = error?.response?.status ?? error?.status ?? 502;
      const message =
        error?.response?.data?.error?.message || error?.message || 'Failed to create realtime call';
      const code = error?.code;

      logger.error?.('Failed to create realtime call', {
        status,
        message,
        code,
      });

      if (error instanceof RealtimeCallError) {
        throw error;
      }

      throw new RealtimeCallError(message, status, code);
    }
  }

  private async loadConfig(req: any): Promise<RealtimeConfig> {
    const appConfig =
      req?.config ??
      (await getAppConfig({
        role: req?.user?.role,
      }));

    const realtimeConfig = appConfig?.speech?.stt?.realtime;
    this.validateConfig(realtimeConfig);
    return realtimeConfig;
  }

  private validateConfig(config: RealtimeConfig | undefined): asserts config is RealtimeConfig {
    if (!config || typeof config !== 'object') {
      throw new RealtimeCallError('Realtime STT is not configured', 404);
    }

    if (!config.model || typeof config.model !== 'string') {
      throw new RealtimeCallError('Realtime STT model is not configured', 500);
    }

    if (!config.apiKey || typeof config.apiKey !== 'string') {
      throw new RealtimeCallError('Realtime speech API key is not configured', 500);
    }
  }

  private buildSessionPayload(config: RealtimeConfig, overrides: RealtimeCallOverrides) {
    const sessionConfig = config.session ?? {};
    const speechToSpeech = Boolean(sessionConfig.speechToSpeech);
    const session: Record<string, unknown> = {
      model: overrides.model ?? sessionConfig.model ?? config.model,
    };

    const mode = overrides.mode ?? sessionConfig.mode;
    if (mode) {
      session.mode = mode;
    }

    const instructions = overrides.instructions ?? sessionConfig.instructions;
    if (instructions) {
      session.instructions = instructions;
    }

    const include = this.mergeInclude(config.include, overrides.include);
    if (include.length > 0) {
      session.modalities = include;
    }

    if (speechToSpeech) {
      session.speech_to_speech = true;
      const voice = overrides.voice ?? sessionConfig.voice;
      if (voice) {
        session.voice = voice;
      }
      if (Array.isArray(sessionConfig.voices) && sessionConfig.voices.length > 0) {
        session.voices = [...sessionConfig.voices];
      }
    } else {
      session.speech_to_speech = false;
    }

    if (sessionConfig.instructionTemplates) {
      session.instruction_templates = { ...sessionConfig.instructionTemplates };
    }

    const inputAudioFormat = this.normalizeInputFormat(config.audio?.input?.format);
    if (inputAudioFormat) {
      session.input_audio_format = inputAudioFormat;
    }

    const audioPayload = this.buildAudioInputPayload(config, overrides, speechToSpeech);
    if (Object.keys(audioPayload).length > 0) {
      session.audio = { input: audioPayload };
    }

    return session;
  }

  private mergeInclude(base: string[] | undefined, overrides: string[] | undefined) {
    const values = [...(Array.isArray(base) ? base : []), ...(Array.isArray(overrides) ? overrides : [])]
      .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
      .filter((entry) => entry.length > 0);

    return [...new Set(values)];
  }

  private normalizeInputFormat(format?: RealtimeAudioInputFormat) {
    const defaults = {
      codec: 'pcm16',
      sample_rate: 24000,
      channels: 1,
    };

    if (!format) {
      return defaults;
    }

    const { encoding, sampleRate, channels, ...rest } = format;
    let codec = defaults.codec;
    const extra: Record<string, unknown> = {};

    if (typeof encoding === 'string') {
      codec = encoding;
    } else if (encoding && typeof encoding === 'object') {
      if (typeof encoding.codec === 'string') {
        codec = encoding.codec;
      }
      Object.assign(extra, this.convertKeysToSnakeCase({ ...encoding, codec: undefined }));
    }

    const normalized = {
      codec,
      sample_rate: typeof sampleRate === 'number' ? sampleRate : defaults.sample_rate,
      channels: typeof channels === 'number' ? channels : defaults.channels,
      ...this.convertKeysToSnakeCase(rest),
      ...extra,
    };

    if (normalized.sample_rate === undefined) {
      delete normalized.sample_rate;
    }

    if (normalized.channels === undefined) {
      delete normalized.channels;
    }

    return normalized;
  }

  private buildAudioInputPayload(
    config: RealtimeConfig,
    overrides: RealtimeCallOverrides,
    speechToSpeech: boolean,
  ) {
    const payload: Record<string, unknown> = {};
    const audioInput = config.audio?.input ?? {};

    const noiseReduction = overrides.noiseReduction ?? audioInput.noiseReduction;
    if (typeof noiseReduction === 'string' && noiseReduction.trim().length > 0) {
      payload.noise_reduction = noiseReduction;
    }

    let vadSource: Record<string, unknown> | undefined;

    if (audioInput.turnDetection && typeof audioInput.turnDetection === 'object') {
      vadSource = this.mergeDeep({}, audioInput.turnDetection);
    }

    if (overrides.vad && typeof overrides.vad === 'object') {
      vadSource = this.mergeDeep(vadSource ?? {}, overrides.vad);
    }

    if (vadSource && Object.keys(vadSource).length > 0) {
      payload.turn_detection = this.convertKeysToSnakeCase(vadSource);
    }

    if (!speechToSpeech && audioInput.transcriptionDefaults) {
      payload.transcription_defaults = this.convertKeysToSnakeCase(audioInput.transcriptionDefaults);
    }

    return payload;
  }

  private convertKeysToSnakeCase(value: any): any {
    if (Array.isArray(value)) {
      return value.map((entry) => this.convertKeysToSnakeCase(entry));
    }

    if (!value || typeof value !== 'object') {
      return value;
    }

    return Object.entries(value).reduce((acc, [key, entryValue]) => {
      if (entryValue === undefined) {
        return acc;
      }

      const normalizedKey = key
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
        .replace(/[-\s]+/g, '_')
        .toLowerCase();

      acc[normalizedKey] = this.convertKeysToSnakeCase(entryValue);
      return acc;
    }, {} as Record<string, unknown>);
  }

  private mergeDeep(target: Record<string, unknown>, source: Record<string, unknown>) {
    return Object.entries(source).reduce((acc, [key, entryValue]) => {
      if (entryValue === undefined) {
        return acc;
      }

      if (Array.isArray(entryValue)) {
        acc[key] = entryValue.map((item) => (typeof item === 'object' && item !== null ? this.mergeDeep({}, item as Record<string, unknown>) : item));
        return acc;
      }

      if (entryValue && typeof entryValue === 'object') {
        const base = acc[key];
        const nextTarget =
          base && typeof base === 'object' && !Array.isArray(base)
            ? (base as Record<string, unknown>)
            : {};
        acc[key] = this.mergeDeep({ ...nextTarget }, entryValue as Record<string, unknown>);
        return acc;
      }

      acc[key] = entryValue;
      return acc;
    }, target);
  }
}

export async function createRealtimeCall(
  req: any,
  overrides: RealtimeCallOverrides,
  options?: { httpClient?: AxiosInstance },
): Promise<RealtimeCallResponse> {
  const service = RealtimeCallService.create(options);
  return service.createCall(req, overrides);
}
