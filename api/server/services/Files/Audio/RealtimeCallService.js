const axios = require('axios');
const FormData = require('form-data');
const { logger } = require('@librechat/data-schemas');
const { extractEnvVariable } = require('librechat-data-provider');
const { getAppConfig } = require('~/server/services/Config');

const REALTIME_CALLS_ENDPOINT = 'https://api.openai.com/v1/realtime/calls';

class RealtimeCallError extends Error {
  constructor(message, status = 500, code) {
    super(message);
    this.name = 'RealtimeCallError';
    this.status = status;
    this.code = code;
  }
}

class RealtimeCallService {
  constructor(options = {}) {
    const { httpClient } = options;
    this.httpClient = httpClient ?? axios;
  }

  static create(options) {
    return new RealtimeCallService(options);
  }

  async createCall(req, overrides) {
    if (
      !overrides ||
      typeof overrides.sdpOffer !== 'string' ||
      overrides.sdpOffer.trim().length === 0
    ) {
      throw new RealtimeCallError('Missing SDP offer', 400);
    }

    const realtimeConfig = await this.#loadConfig(req);
    const apiKey = extractEnvVariable(realtimeConfig.apiKey);

    if (!apiKey || typeof apiKey !== 'string') {
      throw new RealtimeCallError('Realtime speech API key is not configured', 500);
    }

    const sessionPayload = this.#buildSessionPayload(realtimeConfig, overrides);

    const formData = new FormData();
    formData.append('sdp', overrides.sdpOffer);
    formData.append('session', JSON.stringify(sessionPayload));

    const headers = {
      ...formData.getHeaders(),
      Authorization: `Bearer ${apiKey}`,
      'OpenAI-Beta': 'realtime=v1',
    };

    try {
      const response = await this.httpClient.post(REALTIME_CALLS_ENDPOINT, formData, { headers });
      const data = response?.data ?? {};
      const sdpAnswer = data.sdp ?? data.sdp_answer;

      if (!sdpAnswer) {
        throw new RealtimeCallError('Realtime call did not return an SDP answer', 502);
      }

      const expiresAt = data.expires_at ?? data.expiresAt;

      return typeof expiresAt !== 'undefined' ? { sdpAnswer, expiresAt } : { sdpAnswer };
    } catch (error) {
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

  async #loadConfig(req) {
    const appConfig =
      req?.config ??
      (await getAppConfig({
        role: req?.user?.role,
      }));

    const realtimeConfig = appConfig?.speech?.stt?.realtime;
    this.#validateConfig(realtimeConfig);
    return realtimeConfig;
  }

  #validateConfig(config) {
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

  #buildSessionPayload(config, overrides) {
    const sessionConfig = config.session ?? {};
    const speechToSpeech = Boolean(sessionConfig.speechToSpeech);
    const session = {
      model: overrides.model ?? sessionConfig.model ?? config.model,
      type: speechToSpeech ? 'realtime' : 'transcription',
    };

    const mode = overrides.mode ?? sessionConfig.mode;
    if (mode) {
      session.mode = mode;
    }

    const instructions = overrides.instructions ?? sessionConfig.instructions;
    if (instructions) {
      session.instructions = instructions;
    }

    const include = this.#mergeInclude(config.include, overrides.include);
    if (include.length > 0) {
      session.include = include;
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

    const inputAudioFormat = this.#normalizeInputFormat(config.audio?.input?.format);
    const audioPayload = this.#buildAudioInputPayload(config, overrides, speechToSpeech);

    if (inputAudioFormat) {
      audioPayload.format = inputAudioFormat;
    }

    if (Object.keys(audioPayload).length > 0) {
      session.audio = { input: audioPayload };
    }

    return session;
  }

  #mergeInclude(base, overrides) {
    const values = [
      ...(Array.isArray(base) ? base : []),
      ...(Array.isArray(overrides) ? overrides : []),
    ]
      .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
      .filter((entry) => entry.length > 0);

    return [...new Set(values)];
  }

  #normalizeInputFormat(format) {
    const defaults = {
      type: 'pcm16',
      rate: 24000,
      channels: 1,
    };

    if (!format) {
      return defaults;
    }

    const { encoding, sampleRate, channels, ...rest } = format;
    let type = defaults.type;
    const extra = {};

    if (typeof encoding === 'string') {
      type = encoding;
    } else if (encoding && typeof encoding === 'object') {
      if (typeof encoding.codec === 'string') {
        type = encoding.codec;
      }
      Object.assign(extra, this.#convertKeysToGaCase({ ...encoding, codec: undefined }));
    }

    const normalized = {
      type,
      rate: typeof sampleRate === 'number' ? sampleRate : defaults.rate,
      channels: typeof channels === 'number' ? channels : defaults.channels,
      ...this.#convertKeysToGaCase(rest),
      ...extra,
    };

    if (normalized.rate === undefined) {
      delete normalized.rate;
    }

    if (normalized.channels === undefined) {
      delete normalized.channels;
    }

    return normalized;
  }

  #buildAudioInputPayload(config, overrides, speechToSpeech) {
    const payload = {};
    const audioInput = config.audio?.input ?? {};

    const noiseReduction = overrides.noiseReduction ?? audioInput.noiseReduction;
    if (typeof noiseReduction === 'string' && noiseReduction.trim().length > 0) {
      payload.noiseReduction = noiseReduction;
    } else if (noiseReduction && typeof noiseReduction === 'object') {
      payload.noiseReduction = this.#convertKeysToGaCase(noiseReduction);
    }

    let vadSource;

    if (audioInput.turnDetection && typeof audioInput.turnDetection === 'object') {
      vadSource = this.#mergeDeep({}, audioInput.turnDetection);
    }

    if (overrides.turnDetection && typeof overrides.turnDetection === 'object') {
      vadSource = this.#mergeDeep(vadSource ?? {}, overrides.turnDetection);
    }

    if (vadSource && Object.keys(vadSource).length > 0) {
      payload.turnDetection = this.#convertKeysToGaCase(vadSource);
    }

    if (!speechToSpeech && audioInput.transcriptionDefaults) {
      payload.transcriptionDefaults = this.#convertKeysToGaCase(audioInput.transcriptionDefaults);
    }

    return payload;
  }

  #convertKeysToGaCase(value) {
    if (Array.isArray(value)) {
      return value.map((entry) => this.#convertKeysToGaCase(entry));
    }

    if (!value || typeof value !== 'object') {
      return value;
    }

    return Object.entries(value).reduce((acc, [key, entryValue]) => {
      if (entryValue === undefined) {
        return acc;
      }

      const normalizedKey = this.#toCamelCase(key);

      acc[normalizedKey] = this.#convertKeysToGaCase(entryValue);
      return acc;
    }, {});
  }

  #toCamelCase(key) {
    const cleaned = key.replace(/[-\s]+/g, '_');
    const parts = cleaned.split('_');
    if (parts.length === 1) {
      return parts[0].charAt(0).toLowerCase() + parts[0].slice(1);
    }

    return parts
      .map((part, index) => {
        if (part.length === 0) {
          return '';
        }

        const lower = part.toLowerCase();
        if (index === 0) {
          return lower;
        }

        return lower.charAt(0).toUpperCase() + lower.slice(1);
      })
      .join('');
  }

  #mergeDeep(target, source) {
    return Object.entries(source).reduce((acc, [key, entryValue]) => {
      if (entryValue === undefined) {
        return acc;
      }

      if (Array.isArray(entryValue)) {
        acc[key] = entryValue.map((item) =>
          typeof item === 'object' && item !== null ? this.#mergeDeep({}, item) : item,
        );
        return acc;
      }

      if (entryValue && typeof entryValue === 'object') {
        const base = acc[key];
        const nextTarget = base && typeof base === 'object' && !Array.isArray(base) ? base : {};
        acc[key] = this.#mergeDeep({ ...nextTarget }, entryValue);
        return acc;
      }

      acc[key] = entryValue;
      return acc;
    }, target);
  }
}

async function createRealtimeCall(req, overrides, options) {
  const service = RealtimeCallService.create(options);
  return service.createCall(req, overrides);
}

module.exports = {
  RealtimeCallService,
  RealtimeCallError,
  createRealtimeCall,
  REALTIME_CALLS_ENDPOINT,
};
