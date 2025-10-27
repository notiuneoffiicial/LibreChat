jest.mock(
  '@librechat/data-schemas',
  () => ({
    logger: {
      error: jest.fn(),
      warn: jest.fn(),
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

const FormData = require('form-data');
const { getAppConfig } = require('~/server/services/Config');
const { logger } = require('@librechat/data-schemas');
const {
  RealtimeCallService,
  RealtimeCallError,
  REALTIME_CALLS_ENDPOINT,
} = require('./RealtimeCallService');
const { extractEnvVariable } = require('librechat-data-provider');

const ORIGINAL_ENV = { ...process.env };

describe('RealtimeCallService', () => {
  let appendSpy;

  beforeEach(() => {
    appendSpy = jest.spyOn(FormData.prototype, 'append');
  });

  afterEach(() => {
    appendSpy.mockRestore();
    process.env = { ...ORIGINAL_ENV };
    jest.clearAllMocks();
  });

  it('builds a transcription session payload and returns the SDP answer', async () => {
    process.env.REALTIME_KEY = 'test-key';
    const req = {
      config: {
        speech: {
          stt: {
            realtime: {
              apiKey: '${REALTIME_KEY}',
              model: 'gpt-realtime-mini',
              include: ['text'],
              audio: {
                input: {
                  format: {
                    encoding: 'pcm16',
                    sampleRate: 16000,
                    channels: 1,
                  },
                  transcriptionDefaults: {
                    language: 'en',
                    temperature: 0,
                  },
                  turnDetection: {
                    type: 'server_vad',
                    serverVad: { enabled: true },
                  },
                },
              },
            },
          },
        },
      },
    };

    const httpClient = {
      post: jest.fn().mockResolvedValue({ data: { sdp: 'answer', expires_at: 1234 } }),
    };

    const service = new RealtimeCallService({ httpClient });
    const payload = await service.createCall(req, {
      sdpOffer: 'offer',
      instructions: 'Transcribe clearly',
      include: ['audio'],
      turnDetection: { type: 'server_vad', serverVad: { threshold: 0.5 } },
    });

    expect(httpClient.post).toHaveBeenCalledWith(
      REALTIME_CALLS_ENDPOINT,
      expect.any(FormData),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-key',
          'OpenAI-Beta': 'realtime=v1',
        }),
      }),
    );

    const sessionCall = appendSpy.mock.calls.find(([field]) => field === 'session');
    expect(sessionCall).toBeDefined();
    const sessionPayload = JSON.parse(sessionCall[1]);

    expect(sessionPayload).toMatchObject({
      model: 'gpt-realtime-mini',
      instructions: 'Transcribe clearly',
      speech_to_speech: false,
      modalities: ['text', 'audio'],
      input_audio_format: {
        codec: 'pcm16',
        sample_rate: 16000,
        channels: 1,
      },
      audio: {
        input: {
          transcription_defaults: {
            language: 'en',
            temperature: 0,
          },
          turn_detection: {
            type: 'server_vad',
            server_vad: {
              enabled: true,
              threshold: 0.5,
            },
          },
        },
      },
    });

    expect(payload).toEqual({ sdpAnswer: 'answer', expiresAt: 1234 });
  });

  it('includes speech-to-speech voice parameters and omits transcription defaults', async () => {
    process.env.REALTIME_KEY = 'test-key';
    const req = {
      config: {
        speech: {
          stt: {
            realtime: {
              apiKey: '${REALTIME_KEY}',
              model: 'gpt-realtime-mini',
              session: {
                speechToSpeech: true,
                voice: 'alloy',
                voices: ['alloy', 'nova'],
                mode: 'conversation',
              },
              audio: {
                input: {
                  noiseReduction: 'server_heavy',
                  turnDetection: {
                    type: 'server_vad',
                    serverVad: { enabled: true },
                  },
                },
              },
            },
          },
        },
      },
    };

    const httpClient = {
      post: jest.fn().mockResolvedValue({ data: { sdp_answer: 'answer' } }),
    };

    const service = new RealtimeCallService({ httpClient });
    const payload = await service.createCall(req, {
      sdpOffer: 'offer',
      voice: 'nova',
      noiseReduction: 'server_light',
    });

    const sessionCall = appendSpy.mock.calls.find(([field]) => field === 'session');
    const sessionPayload = JSON.parse(sessionCall[1]);

    expect(sessionPayload).toMatchObject({
      model: 'gpt-realtime-mini',
      mode: 'conversation',
      speech_to_speech: true,
      voice: 'nova',
      voices: ['alloy', 'nova'],
      audio: {
        input: {
          noise_reduction: 'server_light',
          turn_detection: {
            type: 'server_vad',
            server_vad: { enabled: true },
          },
        },
      },
    });
    expect(sessionPayload.audio.input).not.toHaveProperty('transcription_defaults');
    expect(payload).toEqual({ sdpAnswer: 'answer' });
  });

  it('loads config from storage when not present on the request', async () => {
    process.env.REALTIME_KEY = 'test-key';
    getAppConfig.mockResolvedValue({
      speech: {
        stt: {
          realtime: {
            apiKey: '${REALTIME_KEY}',
            model: 'gpt-realtime-mini',
          },
        },
      },
    });

    const httpClient = {
      post: jest.fn().mockResolvedValue({ data: { sdp: 'answer' } }),
    };

    const service = new RealtimeCallService({ httpClient });
    await service.createCall({ user: { role: 'user' } }, { sdpOffer: 'offer' });

    expect(getAppConfig).toHaveBeenCalledWith({ role: 'user' });
    expect(httpClient.post).toHaveBeenCalledWith(
      REALTIME_CALLS_ENDPOINT,
      expect.any(FormData),
      expect.any(Object),
    );
  });

  it('throws when realtime config is missing', async () => {
    getAppConfig.mockResolvedValue({ speech: { stt: {} } });

    const service = new RealtimeCallService({ httpClient: { post: jest.fn() } });

    await expect(
      service.createCall({ user: { role: 'user' } }, { sdpOffer: 'offer' }),
    ).rejects.toBeInstanceOf(RealtimeCallError);
  });

  it('propagates service errors with sanitized logging', async () => {
    process.env.REALTIME_KEY = 'test-key';
    const axiosError = new Error('Request failed');
    axiosError.response = {
      status: 401,
      data: {
        error: {
          message: 'Unauthorized',
        },
      },
    };
    axiosError.code = 'ERR_UNAUTHORIZED';

    const httpClient = {
      post: jest.fn().mockRejectedValue(axiosError),
    };

    const req = {
      config: {
        speech: {
          stt: {
            realtime: {
              apiKey: '${REALTIME_KEY}',
              model: 'gpt-realtime-mini',
            },
          },
        },
      },
    };

    const service = new RealtimeCallService({ httpClient });

    await expect(service.createCall(req, { sdpOffer: 'offer' })).rejects.toMatchObject({
      status: 401,
      message: 'Unauthorized',
      code: 'ERR_UNAUTHORIZED',
    });

    expect(logger.error).toHaveBeenCalledWith('Failed to create realtime call', {
      status: 401,
      message: 'Unauthorized',
      code: 'ERR_UNAUTHORIZED',
    });
  });

  it('validates the SDP offer before making the request', async () => {
    const service = new RealtimeCallService({ httpClient: { post: jest.fn() } });

    await expect(service.createCall({}, { sdpOffer: '' })).rejects.toMatchObject({
      message: 'Missing SDP offer',
      status: 400,
    });
    expect(extractEnvVariable).not.toHaveBeenCalled();
  });
});
