class MockRealtimeCallError extends Error {
  constructor(message, status = 500, code) {
    super(message);
    this.name = 'RealtimeCallError';
    this.status = status;
    this.code = code;
  }
}

jest.mock('~/server/services/Files/Audio', () => ({
  createRealtimeCall: jest.fn(),
  RealtimeCallError: MockRealtimeCallError,
}));

const request = require('supertest');
const express = require('express');

const realtimeRoute = require('../speech/realtime');
const audioServices = require('~/server/services/Files/Audio');

const buildApp = (withUser = true) => {
  const app = express();
  app.use(express.json());

  if (withUser) {
    app.use((req, _res, next) => {
      req.user = { id: 'user-123' };
      next();
    });
  }

  app.use('/api/files/speech/stt/realtime', realtimeRoute);

  return app;
};

describe('POST /api/files/speech/stt/realtime/call', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects unauthenticated requests', async () => {
    const app = buildApp(false);

    const response = await request(app).post('/api/files/speech/stt/realtime/call').send({});

    expect(audioServices.createRealtimeCall).not.toHaveBeenCalled();
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'Unauthorized' });
  });

  it('validates the presence of an SDP offer', async () => {
    const app = buildApp();

    const response = await request(app)
      .post('/api/files/speech/stt/realtime/call')
      .send({ mode: 'conversation' });

    expect(audioServices.createRealtimeCall).not.toHaveBeenCalled();
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Missing SDP offer' });
  });

  it('passes overrides to the realtime call service', async () => {
    const app = buildApp();
    const payload = { sdpAnswer: 'test-answer' };
    audioServices.createRealtimeCall.mockResolvedValue(payload);

    const body = {
      sdpOffer: 'offer',
      mode: 'conversation',
      model: 'gpt-realtime',
      voice: 'alloy',
      instructions: 'Be brief',
      include: ['text'],
      turnDetection: { type: 'server_vad' },
      noiseReduction: 'server_light',
    };

    const response = await request(app).post('/api/files/speech/stt/realtime/call').send(body);

    expect(audioServices.createRealtimeCall).toHaveBeenCalledWith(
      expect.objectContaining({ user: { id: 'user-123' } }),
      expect.objectContaining({
        sdpOffer: 'offer',
        include: ['text'],
        session: expect.objectContaining({
          model: 'gpt-realtime',
          instructions: 'Be brief',
          audio: expect.objectContaining({
            output: { voice: 'alloy' },
            input: expect.objectContaining({
              turnDetection: { type: 'server_vad' },
              noiseReduction: 'server_light',
            }),
          }),
        }),
      }),
    );
    expect(response.status).toBe(200);
    expect(response.body).toEqual(payload);
  });

  it('surfaces RealtimeCallError details', async () => {
    const app = buildApp();
    const { RealtimeCallError } = audioServices;
    audioServices.createRealtimeCall.mockRejectedValue(
      new RealtimeCallError('OpenAI rejected the offer', 409, 'conflict'),
    );

    const response = await request(app)
      .post('/api/files/speech/stt/realtime/call')
      .send({ sdpOffer: 'offer' });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: 'OpenAI rejected the offer', code: 'conflict' });
  });

  it('falls back to 500 for unexpected errors', async () => {
    const app = buildApp();
    audioServices.createRealtimeCall.mockRejectedValue(new Error('Boom'));

    const response = await request(app)
      .post('/api/files/speech/stt/realtime/call')
      .send({ sdpOffer: 'offer' });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: 'Boom' });
  });
});
