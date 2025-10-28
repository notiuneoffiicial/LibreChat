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
              session: {
                audio: {
                  input: {
                    format: {
                      encoding: 'pcm16',
                      rate: 16000,
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
      },
    };

    const httpClient = {
      post: jest.fn().mockResolvedValue({ data: { sdp: 'answer', expires_at: 1234 } }),
    };

    const service = new RealtimeCallService({ httpClient });
    const payload = await service.createCall(req, {
      sdpOffer: 'offer',
      session: {
        instructions: 'Transcribe clearly',
        output_modalities: ['audio'],
        audio: {
          input: { turnDetection: { type: 'server_vad', serverVad: { threshold: 0.5 } } },
        },
      },
    });

    expect(httpClient.post).toHaveBeenCalledWith(
      REALTIME_CALLS_ENDPOINT,
      expect.any(FormData),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-key',
        }),
      }),
    );

    const sessionCall = appendSpy.mock.calls.find(([field]) => field === 'session');
    expect(sessionCall).toBeDefined();
    const sessionPayload = JSON.parse(sessionCall[1]);
    const callHeaders = httpClient.post.mock.calls[0][2].headers;

    expect(callHeaders).not.toHaveProperty('OpenAI-Beta');

    expect(sessionPayload).toMatchObject({
      type: 'realtime',
      model: 'gpt-realtime-mini',
      instructions: 'Transcribe clearly',
      output_modalities: ['text', 'audio'],
      audio: {
        input: {
          format: {
            type: 'pcm16',
            sample_rate: 16000,
            channels: 1,
          },
          transcription: {
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
    expect(sessionPayload).not.toHaveProperty('modalities');
    expect(sessionPayload).not.toHaveProperty('speech_to_speech');

    expect(payload).toEqual({ sdpAnswer: 'answer', expiresAt: 1234 });
  });

  it('omits modal entries when rebuilding include list', async () => {
    process.env.REALTIME_KEY = 'test-key';
    const req = {
      config: {
        speech: {
          stt: {
            realtime: {
              apiKey: '${REALTIME_KEY}',
              model: 'gpt-realtime-mini',
              session: {
                include: ['text', 'logprobs'],
                output_modalities: ['text'],
              },
            },
          },
        },
      },
    };

    const httpClient = {
      post: jest.fn().mockResolvedValue({ data: { sdp: 'answer' } }),
    };

    const service = new RealtimeCallService({ httpClient });
    await service.createCall(req, {
      sdpOffer: 'offer',
      include: ['audio'],
    });

    const sessionCall = appendSpy.mock.calls.find(([field]) => field === 'session');
    const sessionPayload = JSON.parse(sessionCall[1]);

    expect(sessionPayload.output_modalities).toEqual(expect.arrayContaining(['text', 'audio']));
    expect(sessionPayload.include).toEqual(['logprobs']);
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
                mode: 'conversation',
                audio: {
                  output: {
                    voice: 'alloy',
                    voices: ['alloy', 'nova'],
                  },
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
      },
    };

    const httpClient = {
      post: jest.fn().mockResolvedValue({ data: { sdp_answer: 'answer' } }),
    };

    const service = new RealtimeCallService({ httpClient });
    const payload = await service.createCall(req, {
      sdpOffer: 'offer',
      session: {
        audio: {
          output: { voice: 'nova' },
          input: { noiseReduction: 'server_light' },
        },
      },
    });

    const sessionCall = appendSpy.mock.calls.find(([field]) => field === 'session');
    const sessionPayload = JSON.parse(sessionCall[1]);

    expect(sessionPayload).toMatchObject({
      type: 'realtime',
      model: 'gpt-realtime-mini',
      mode: 'conversation',
      output_modalities: ['audio'],
      audio: {
        input: {
          format: {
            type: 'pcm16',
            sample_rate: 24000,
            channels: 1,
          },
          noise_reduction: 'server_light',
          turn_detection: {
            type: 'server_vad',
            server_vad: { enabled: true },
          },
        },
        output: {
          voice: 'nova',
          voices: ['alloy', 'nova'],
        },
      },
    });
    expect(sessionPayload).not.toHaveProperty('modalities');
    expect(sessionPayload).not.toHaveProperty('speech_to_speech');
    expect(sessionPayload.audio.input).not.toHaveProperty('transcription');
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
