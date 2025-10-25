class MockRealtimeSTTError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.name = 'RealtimeSTTError';
    this.status = status;
  }
}

jest.mock('~/server/services/Files/Audio', () => ({
  issueRealtimeSession: jest.fn(),
  RealtimeSTTError: MockRealtimeSTTError,
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

describe('POST /api/files/speech/stt/realtime/session', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects unauthenticated requests', async () => {
    const app = buildApp(false);

    const response = await request(app).post('/api/files/speech/stt/realtime/session').send({});

    expect(audioServices.issueRealtimeSession).not.toHaveBeenCalled();
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'Unauthorized' });
  });

  it('returns the realtime session descriptor from the service', async () => {
    const app = buildApp();
    const descriptor = { session: { client_secret: { value: 'secret' } } };
    audioServices.issueRealtimeSession.mockResolvedValue(descriptor);

    const response = await request(app).post('/api/files/speech/stt/realtime/session').send({});

    expect(audioServices.issueRealtimeSession).toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(response.body).toEqual(descriptor);
  });

  it('surfaces RealtimeSTTError status codes', async () => {
    const app = buildApp();
    const { RealtimeSTTError } = audioServices;
    audioServices.issueRealtimeSession.mockRejectedValue(
      new RealtimeSTTError('Realtime STT is not configured', 404),
    );

    const response = await request(app).post('/api/files/speech/stt/realtime/session').send({});

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'Realtime STT is not configured' });
  });

  it('returns a 500 when the service throws an unexpected error', async () => {
    const app = buildApp();
    audioServices.issueRealtimeSession.mockRejectedValue(new Error('Boom'));

    const response = await request(app).post('/api/files/speech/stt/realtime/session').send({});

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: 'Boom' });
  });
});
