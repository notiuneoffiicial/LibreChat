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
      model: realtimeConfig.model,
    };

    const inputFormat = this.normalizeInputFormat(realtimeConfig.inputAudioFormat);

    if (inputFormat) {
      payload.input_audio_format = {
        encoding: inputFormat.encoding,
        sample_rate: inputFormat.sampleRate,
        channels: inputFormat.channels,
      };
    }

    return payload;
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

      return {
        url: realtimeConfig.url ?? DEFAULT_REALTIME_URL,
        transport: realtimeConfig.transport ?? 'websocket',
        stream: typeof realtimeConfig.stream === 'boolean' ? realtimeConfig.stream : true,
        inputAudioFormat: this.normalizeInputFormat(realtimeConfig.inputAudioFormat),
        model: realtimeConfig.model,
        session,
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
