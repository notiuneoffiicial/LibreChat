jest.mock(
  '@librechat/data-schemas',
  () => ({
    logger: {
      error: jest.fn(),
    },
  }),
  { virtual: true },
);
jest.mock(
  'librechat-data-provider',
  () => ({
    extractEnvVariable: jest.fn((value) => {
      if (!value) {
        return value;
      }
      const match = value.match(/^\${(.+)}$/);
      if (match) {
        return process.env[match[1]] ?? value;
      }
      return value;
    }),
  }),
  { virtual: true },
);
jest.mock('~/server/services/Config', () => ({
  getAppConfig: jest.fn(),
}));

const { RealtimeSTTService, RealtimeSTTError, DEFAULT_SESSION_ENDPOINT } = require('./RealtimeSTTService');
const { getAppConfig } = require('~/server/services/Config');

describe('RealtimeSTTService', () => {
  const ORIGINAL_ENV = { ...process.env };

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    jest.clearAllMocks();
  });

  it('creates a realtime session descriptor using request config', async () => {
    process.env.REALTIME_KEY = 'test-key';

    const req = {
      config: {
        speech: {
          stt: {
            realtime: {
              apiKey: '${REALTIME_KEY}',
              model: 'gpt-4o-realtime-preview',
              transport: 'webrtc',
              stream: false,
              url: 'wss://example.com/v1/realtime',
              inputAudioFormat: {
                encoding: 'pcm16',
                sampleRate: 16000,
                channels: 1,
              },
            },
          },
        },
      },
    };

    const mockSession = { client_secret: { value: 'secret' }, expires_at: 1234 };
    const httpClient = {
      post: jest.fn().mockResolvedValue({ data: mockSession }),
    };

    const service = new RealtimeSTTService({ httpClient });
    const descriptor = await service.createSessionDescriptor(req);

    expect(httpClient.post).toHaveBeenCalledWith(
      'https://example.com/v1/realtime/sessions',
      {
        model: 'gpt-4o-realtime-preview',
        transport: 'webrtc',
        stream: false,
        input_audio_format: {
          encoding: 'pcm16',
          sample_rate: 16000,
          channels: 1,
        },
      },
      {
        headers: {
          Authorization: 'Bearer test-key',
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'realtime=v1',
        },
      },
    );

    expect(descriptor).toEqual({
      url: 'wss://example.com/v1/realtime',
      transport: 'webrtc',
      stream: false,
      inputAudioFormat: {
        encoding: 'pcm16',
        sampleRate: 16000,
        channels: 1,
      },
      model: 'gpt-4o-realtime-preview',
      session: mockSession,
    });
    expect(getAppConfig).not.toHaveBeenCalled();
  });

  it('loads config when not present on request', async () => {
    process.env.REALTIME_KEY = 'test-key';
    getAppConfig.mockResolvedValue({
      speech: {
        stt: {
          realtime: {
            apiKey: '${REALTIME_KEY}',
            model: 'gpt-4o-realtime-preview',
          },
        },
      },
    });

    const httpClient = {
      post: jest.fn().mockResolvedValue({ data: { client_secret: { value: 'secret' } } }),
    };

    const service = new RealtimeSTTService({ httpClient });
    const descriptor = await service.createSessionDescriptor({ user: { role: 'user' } });

    expect(getAppConfig).toHaveBeenCalledWith({ role: 'user' });
    expect(httpClient.post).toHaveBeenCalledWith(
      DEFAULT_SESSION_ENDPOINT,
      {
        model: 'gpt-4o-realtime-preview',
        input_audio_format: {
          encoding: 'pcm16',
          sample_rate: 24000,
          channels: 1,
        },
      },
      expect.any(Object),
    );
    expect(descriptor.inputAudioFormat).toEqual({
      encoding: 'pcm16',
      sampleRate: 24000,
      channels: 1,
    });
  });

  it('throws an error when realtime config is missing', async () => {
    getAppConfig.mockResolvedValue({ speech: { stt: {} } });

    const service = new RealtimeSTTService({ httpClient: { post: jest.fn() } });

    await expect(service.createSessionDescriptor({ user: { role: 'user' } })).rejects.toMatchObject({
      message: 'Realtime STT is not configured',
      status: 404,
    });
  });

  it('wraps request errors with RealtimeSTTError', async () => {
    process.env.REALTIME_KEY = 'test-key';
    const error = new Error('request failed');
    const httpClient = {
      post: jest.fn().mockRejectedValue(error),
    };

    const req = {
      config: {
        speech: {
          stt: {
            realtime: {
              apiKey: '${REALTIME_KEY}',
              model: 'gpt-4o-realtime-preview',
            },
          },
        },
      },
    };

    const service = new RealtimeSTTService({ httpClient });

    await expect(service.createSessionDescriptor(req)).rejects.toBeInstanceOf(RealtimeSTTError);
    expect(httpClient.post).toHaveBeenCalledWith(
      DEFAULT_SESSION_ENDPOINT,
      {
        model: 'gpt-4o-realtime-preview',
        input_audio_format: {
          encoding: 'pcm16',
          sample_rate: 24000,
          channels: 1,
        },
      },
      expect.any(Object),
    );
  });
});
