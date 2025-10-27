const express = require('express');
const { createRealtimeCall, RealtimeCallError } = require('~/server/services/Files/Audio');

const router = express.Router();

const handleRealtimeCall = async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { sdpOffer, mode, model, voice, instructions, include, vad, noiseReduction } =
    req.body ?? {};

  if (typeof sdpOffer !== 'string' || sdpOffer.trim().length === 0) {
    return res.status(400).json({ error: 'Missing SDP offer' });
  }

  const overrides = {
    sdpOffer,
    ...(typeof mode === 'string' ? { mode } : {}),
    ...(typeof model === 'string' ? { model } : {}),
    ...(typeof voice === 'string' ? { voice } : {}),
    ...(typeof instructions === 'string' ? { instructions } : {}),
    ...(Array.isArray(include) ? { include } : {}),
    ...(vad && typeof vad === 'object' ? { vad } : {}),
    ...(typeof noiseReduction === 'string' ? { noiseReduction } : {}),
  };

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
router.post('/session', handleRealtimeCall);

module.exports = router;
