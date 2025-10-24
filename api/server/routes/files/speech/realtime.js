const express = require('express');
const { issueRealtimeSession, RealtimeSTTError } = require('~/server/services/Files/Audio');

const router = express.Router();

router.post('/session', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const payload = await issueRealtimeSession(req);
    return res.status(200).json(payload);
  } catch (error) {
    const status = error instanceof RealtimeSTTError ? error.status : 500;
    const message = error?.message || 'Failed to create realtime session';
    return res.status(status).json({ error: message });
  }
});

module.exports = router;
