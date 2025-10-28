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
  turnDetection?: Record<string, unknown>;
  noiseReduction?: string | Record<string, unknown>;
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
  modalities?: string[];
  include?: string[];
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

    const voice = overrides.voice ?? sessionConfig.voice;
    if (voice) {
      session.voice = voice;
    }

    if (Array.isArray(sessionConfig.voices) && sessionConfig.voices.length > 0) {
      session.voices = [...sessionConfig.voices];
    }

    if (sessionConfig.instructionTemplates) {
      session.instruction_templates = { ...sessionConfig.instructionTemplates };
    }

    const includeValues = this.mergeInclude(
      config.include,
      overrides.include,
      sessionConfig.modalities,
    );
    const includeItems = this.mergeInclude(sessionConfig.include);
    const { modalities, include } = this.partitionInclude(includeValues, speechToSpeech, includeItems);

    if (modalities.length > 0) {
      session.modalities = modalities;
    }

    if (include.length > 0) {
      session.include = include;
    }

    const inputAudioFormat = this.normalizeInputFormat(config.audio?.input?.format);
    if (inputAudioFormat) {
      session.input_audio_format = inputAudioFormat;
    }

    const inputAudioNoiseReduction = this.resolveNoiseReduction(config, overrides);
    if (inputAudioNoiseReduction !== undefined) {
      session.input_audio_noise_reduction = inputAudioNoiseReduction;
    }

    if (!speechToSpeech) {
      const transcriptionDefaults = this.resolveTranscriptionDefaults(config);
      if (transcriptionDefaults) {
        session.input_audio_transcription = transcriptionDefaults;
      }
    }

    const turnDetection = this.resolveTurnDetection(config, overrides);
    if (turnDetection) {
      session.turn_detection = turnDetection;
    }

    return session;
  }

  private mergeInclude(...lists: Array<string[] | undefined>) {
    const values = lists
      .flatMap((list) => (Array.isArray(list) ? list : []))
      .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
      .filter((entry) => entry.length > 0);

    return [...new Set(values)];
  }

  private normalizeInputFormat(format?: RealtimeAudioInputFormat) {
    const defaults = {
      type: 'pcm16',
      sample_rate: 24000,
      channels: 1,
    };

    if (!format) {
      return defaults;
    }

    const { encoding, sampleRate, channels, ...rest } = format;
    let type = defaults.type;
    const extra: Record<string, unknown> = {};

    if (typeof encoding === 'string') {
      type = encoding;
    } else if (encoding && typeof encoding === 'object') {
      if (typeof encoding.codec === 'string') {
        type = encoding.codec;
      }
      Object.assign(extra, this.convertKeysToSnakeCase({ ...encoding, codec: undefined }));
    }

    const normalized = {
      type,
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

  private partitionInclude(values: string[], speechToSpeech: boolean, includeItems: string[]) {
    const modalitiesSet = new Set<string>();
    const includeSet = new Set<string>();

    values.forEach((entry) => {
      const normalized = entry.toLowerCase();
      if (normalized === 'text' || normalized === 'audio') {
        modalitiesSet.add(normalized);
        return;
      }

      includeSet.add(entry);
    });

    includeItems.forEach((entry) => {
      if (typeof entry !== 'string') {
        return;
      }

      const trimmed = entry.trim();
      if (trimmed.length === 0) {
        return;
      }

      const normalized = trimmed.toLowerCase();
      if (normalized === 'text' || normalized === 'audio') {
        return;
      }

      includeSet.add(trimmed);
    });

    if (speechToSpeech) {
      modalitiesSet.add('audio');
    }

    return {
      modalities: [...modalitiesSet],
      include: [...includeSet],
    };
  }

  private resolveNoiseReduction(config: RealtimeConfig, overrides: RealtimeCallOverrides) {
    const audioInput = config.audio?.input ?? {};
    const noiseReduction = overrides.noiseReduction ?? audioInput.noiseReduction;

    if (noiseReduction === undefined || noiseReduction === null) {
      return undefined;
    }

    if (typeof noiseReduction === 'string') {
      const trimmed = noiseReduction.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    }

    if (typeof noiseReduction === 'object') {
      return this.convertKeysToSnakeCase(noiseReduction);
    }

    return undefined;
  }

  private resolveTranscriptionDefaults(config: RealtimeConfig) {
    const transcriptionDefaults = config.audio?.input?.transcriptionDefaults;
    if (!transcriptionDefaults || typeof transcriptionDefaults !== 'object') {
      return undefined;
    }

    if (Object.keys(transcriptionDefaults).length === 0) {
      return undefined;
    }

    return this.convertKeysToSnakeCase(transcriptionDefaults);
  }

  private resolveTurnDetection(config: RealtimeConfig, overrides: RealtimeCallOverrides) {
    const audioInput = config.audio?.input ?? {};
    let vadSource: Record<string, unknown> | undefined;

    if (audioInput.turnDetection && typeof audioInput.turnDetection === 'object') {
      vadSource = this.mergeDeep({}, audioInput.turnDetection);
    }

    if (overrides.turnDetection && typeof overrides.turnDetection === 'object') {
      vadSource = this.mergeDeep(vadSource ?? {}, overrides.turnDetection);
    }

    if (!vadSource || Object.keys(vadSource).length === 0) {
      return undefined;
    }

    return this.convertKeysToSnakeCase(vadSource);
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

      const normalizedKey = this.toSnakeCase(key);

      acc[normalizedKey] = this.convertKeysToSnakeCase(entryValue);
      return acc;
    }, {} as Record<string, unknown>);
  }

  private toSnakeCase(key: string): string {
    return key
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .replace(/[-\s]+/g, '_')
      .replace(/__+/g, '_')
      .toLowerCase();
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
