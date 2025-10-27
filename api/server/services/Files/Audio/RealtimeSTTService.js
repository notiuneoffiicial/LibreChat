const axios = require('axios');
const { logger } = require('@librechat/data-schemas');
const { extractEnvVariable } = require('librechat-data-provider');
const { getAppConfig } = require('~/server/services/Config');

const DEFAULT_REALTIME_URL = 'wss://api.openai.com/v1/realtime';
const DEFAULT_SESSION_ENDPOINT = 'https://api.openai.com/v1/realtime/sessions';

class RealtimeSTTError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.name = 'RealtimeSTTError';
    this.status = status;
  }
}

class RealtimeSTTService {
  constructor(options = {}) {
    const { httpClient } = options;
    this.httpClient = httpClient ?? axios;
  }

  static async getInstance(options = {}) {
    return new RealtimeSTTService(options);
  }

  async getRealtimeConfig(req) {
    const appConfig =
      req?.config ??
      (await getAppConfig({
        role: req?.user?.role,
      }));

    const realtimeConfig = appConfig?.speech?.stt?.realtime;
    if (!realtimeConfig || !realtimeConfig.model) {
      throw new RealtimeSTTError('Realtime STT is not configured', 404);
    }

    return realtimeConfig;
  }

  resolveSessionEndpoint(realtimeConfig) {
    const baseUrl = realtimeConfig?.url;
    if (!baseUrl) {
      return DEFAULT_SESSION_ENDPOINT;
    }

    let normalized = baseUrl.trim();

    if (/^ws/i.test(normalized)) {
      normalized = normalized.replace(/^ws/i, 'http');
    }

    try {
      const parsed = new URL(normalized);
      parsed.search = '';
      parsed.hash = '';

      if (!/\/sessions$/i.test(parsed.pathname)) {
        parsed.pathname = `${parsed.pathname.replace(/\/$/, '')}/sessions`;
      }

      return parsed.toString();
    } catch (error) {
      logger.warn?.('Failed to normalize realtime session URL with URL parser', error);
    }

    normalized = normalized.replace(/[?#].*$/, '').replace(/\/$/, '');

    if (!/\/sessions$/i.test(normalized)) {
      normalized = `${normalized}/sessions`;
    }

    return normalized;
  }

  normalizeInputFormat(inputFormat) {
    const defaults = {
      encoding: 'pcm16',
      sampleRate: 24000,
      channels: 1,
    };

    if (!inputFormat) {
      return defaults;
    }

    return {
      encoding: inputFormat.encoding ?? defaults.encoding,
      sampleRate: inputFormat.sampleRate ?? defaults.sampleRate,
      channels: inputFormat.channels ?? defaults.channels,
    };
  }

  buildSessionPayload(realtimeConfig) {
    const payload = {
      model: realtimeConfig.session?.model ?? realtimeConfig.model,
    };

    const sessionDefaults = realtimeConfig.session ?? {};

    if (typeof sessionDefaults.mode === 'string') {
      payload.mode = sessionDefaults.mode;
    }

    if (typeof sessionDefaults.voice === 'string') {
      payload.voice = sessionDefaults.voice;
    }

    if (Array.isArray(sessionDefaults.voices) && sessionDefaults.voices.length > 0) {
      payload.voices = [...sessionDefaults.voices];
    }

    if (typeof sessionDefaults.instructions === 'string') {
      payload.instructions = sessionDefaults.instructions;
    }

    if (typeof sessionDefaults.speechToSpeech === 'boolean') {
      payload.speech_to_speech = sessionDefaults.speechToSpeech;
    }

    if (
      sessionDefaults.instructionTemplates &&
      typeof sessionDefaults.instructionTemplates === 'object'
    ) {
      payload.instruction_templates = { ...sessionDefaults.instructionTemplates };
    }

    const includeList = Array.isArray(realtimeConfig.include)
      ? realtimeConfig.include.filter((value) => typeof value === 'string' && value.trim().length > 0)
      : [];

    if (includeList.length > 0) {
      payload.modalities = [...new Set(includeList)];
    }

    const inputFormat = this.normalizeInputFormat(
      realtimeConfig.audio?.input?.format ?? realtimeConfig.inputAudioFormat,
    );

    if (inputFormat) {
      const { encoding, sampleRate, channels, ...rest } = inputFormat;
      let codec = 'pcm16';

      if (typeof encoding === 'string' && encoding.trim().length > 0) {
        codec = encoding;
      } else if (
        typeof encoding === 'object' &&
        typeof encoding.codec === 'string' &&
        encoding.codec.trim().length > 0
      ) {
        codec = encoding.codec;
        Object.assign(rest, this.#convertKeysToSnakeCase({ ...encoding, codec: undefined }));
      }

      payload.input_audio_format = {
        codec,
        sample_rate: typeof sampleRate === 'number' ? sampleRate : undefined,
        channels: typeof channels === 'number' ? channels : undefined,
        ...this.#convertKeysToSnakeCase(rest),
      };

      if (payload.input_audio_format.sample_rate === undefined) {
        delete payload.input_audio_format.sample_rate;
      }

      if (payload.input_audio_format.channels === undefined) {
        delete payload.input_audio_format.channels;
      }
    }

    const audioInput = realtimeConfig.audio?.input;

    if (audioInput) {
      const audioPayload = {};

      if (audioInput.noiseReduction !== undefined) {
        audioPayload.noise_reduction = audioInput.noiseReduction;
      }

      if (audioInput.transcriptionDefaults) {
        audioPayload.transcription_defaults = this.#convertKeysToSnakeCase(
          audioInput.transcriptionDefaults,
        );
      }

      if (audioInput.turnDetection) {
        audioPayload.turn_detection = this.#convertKeysToSnakeCase(audioInput.turnDetection);
      }

      if (Object.keys(audioPayload).length > 0) {
        payload.audio = { input: audioPayload };
      }
    }

    return payload;
  }

  #convertKeysToSnakeCase(value) {
    if (Array.isArray(value)) {
      return value.map((entry) => this.#convertKeysToSnakeCase(entry));
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

      acc[normalizedKey] = this.#convertKeysToSnakeCase(entryValue);
      return acc;
    }, {});
  }

  buildHeaders(apiKey) {
    return {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'OpenAI-Beta': 'realtime=v1',
    };
  }

  async createSessionDescriptor(req) {
    const realtimeConfig = await this.getRealtimeConfig(req);

    const apiKey = extractEnvVariable(realtimeConfig.apiKey);
    if (!apiKey) {
      throw new RealtimeSTTError('Realtime STT API key is not configured', 500);
    }

    const endpoint = this.resolveSessionEndpoint(realtimeConfig);
    const payload = this.buildSessionPayload(realtimeConfig);
    const headers = this.buildHeaders(apiKey);

    try {
      const response = await this.httpClient.post(endpoint, payload, { headers });
      const session = response?.data;

      if (!session) {
        throw new RealtimeSTTError('Empty response from realtime session endpoint', 502);
      }

      const inputFormat = this.normalizeInputFormat(
        realtimeConfig.audio?.input?.format ?? realtimeConfig.inputAudioFormat,
      );

      const includeList = Array.isArray(realtimeConfig.include)
        ? [...realtimeConfig.include]
        : undefined;

      const sessionDefaults = realtimeConfig.session ? { ...realtimeConfig.session } : undefined;

      const audioConfig = {
        ...(realtimeConfig.audio ? { ...realtimeConfig.audio, input: undefined } : {}),
        input: {
          ...(realtimeConfig.audio?.input ? { ...realtimeConfig.audio.input } : {}),
          format: inputFormat,
        },
      };

      const descriptorModel = sessionDefaults?.model ?? realtimeConfig.model;

      return {
        url: realtimeConfig.url ?? DEFAULT_REALTIME_URL,
        transport: realtimeConfig.transport ?? 'websocket',
        stream: typeof realtimeConfig.stream === 'boolean' ? realtimeConfig.stream : true,
        inputAudioFormat: inputFormat,
        model: descriptorModel,
        session,
        ...(realtimeConfig.ffmpegPath ? { ffmpegPath: realtimeConfig.ffmpegPath } : {}),
        audio: audioConfig,
        ...(includeList ? { include: includeList } : {}),
        ...(sessionDefaults ? { sessionDefaults } : {}),
      };
    } catch (error) {
      const status = error?.response?.status ?? error?.status ?? 502;
      const message =
        error?.response?.data?.error?.message ||
        error?.message ||
        'Failed to create realtime session';
      const safeContext = {
        status,
        message,
        code: error?.code,
      };

      logger.error?.('Failed to create realtime STT session', safeContext);

      if (error instanceof RealtimeSTTError) {
        throw error;
      }

      throw new RealtimeSTTError(message, status);
    }
  }
}

async function issueRealtimeSession(req) {
  const service = await RealtimeSTTService.getInstance();
  return service.createSessionDescriptor(req);
}

module.exports = {
  RealtimeSTTService,
  RealtimeSTTError,
  issueRealtimeSession,
  DEFAULT_REALTIME_URL,
  DEFAULT_SESSION_ENDPOINT,
};
