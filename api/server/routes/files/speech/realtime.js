const express = require('express');
const { createRealtimeCall, RealtimeCallError } = require('~/server/services/Files/Audio');

const router = express.Router();

const mergeAudioConfig = (target = {}, source = {}) => {
  const next = { ...target };

  if (source.input && typeof source.input === 'object') {
    next.input = { ...(next.input ?? {}), ...source.input };
  }

  if (source.output && typeof source.output === 'object') {
    next.output = { ...(next.output ?? {}), ...source.output };
  }

  Object.entries(source).forEach(([key, value]) => {
    if (key === 'input' || key === 'output') {
      return;
    }

    if (value === undefined) {
      return;
    }

    next[key] = value;
  });

  return next;
};

const handleRealtimeCall = async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const {
    sdpOffer,
    session,
    include,
    mode,
    model,
    voice,
    instructions,
    audio,
    turnDetection,
    noiseReduction,
  } = req.body ?? {};

  if (typeof sdpOffer !== 'string' || sdpOffer.trim().length === 0) {
    return res.status(400).json({ error: 'Missing SDP offer' });
  }

  const overrides = { sdpOffer };

  const ensureSession = () => {
    if (!overrides.session || typeof overrides.session !== 'object') {
      overrides.session = {};
    }
    return overrides.session;
  };

  if (session && typeof session === 'object') {
    overrides.session = session;
  }

  if (Array.isArray(include)) {
    overrides.include = include;
  }

  if (typeof mode === 'string') {
    ensureSession().mode = mode;
  }

  if (typeof model === 'string') {
    ensureSession().model = model;
  }

  if (typeof instructions === 'string') {
    ensureSession().instructions = instructions;
  }

  if (typeof voice === 'string') {
    const sessionConfig = ensureSession();
    sessionConfig.audio = mergeAudioConfig(sessionConfig.audio, {
      output: { voice },
    });
  }

  if (turnDetection && typeof turnDetection === 'object') {
    const sessionConfig = ensureSession();
    sessionConfig.audio = mergeAudioConfig(sessionConfig.audio, {
      input: { turnDetection },
    });
  }

  if (
    typeof noiseReduction === 'string' ||
    (noiseReduction && typeof noiseReduction === 'object')
  ) {
    const sessionConfig = ensureSession();
    sessionConfig.audio = mergeAudioConfig(sessionConfig.audio, {
      input: { noiseReduction },
    });
  }

  if (audio && typeof audio === 'object') {
    const sessionConfig = ensureSession();
    sessionConfig.audio = mergeAudioConfig(sessionConfig.audio, audio);
  }

  try {
    const payload = await createRealtimeCall(req, overrides);
    return res.status(200).json(payload);
  } catch (error) {
    if (error instanceof RealtimeCallError) {
      const status = error.status ?? 500;
      const body = { error: error.message };
      if (error.code) {
        body.code = error.code;
      }
      return res.status(status).json(body);
    }

    const status = error?.status ?? error?.response?.status ?? 500;
    const message = error?.message || 'Failed to create realtime call';
    return res.status(status).json({ error: message });
  }
};

router.post('/call', handleRealtimeCall);

module.exports = router;
