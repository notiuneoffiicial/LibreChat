const express = require('express');
const { logger } = require('@librechat/data-schemas');
const optionalJwtAuth = require('~/server/middleware/optionalJwtAuth');
const { generateNewsFeed, loadNewsFeed } = require('../../../scripts/news/generateFeed');

const router = express.Router();

router.get('/', optionalJwtAuth, async (req, res) => {
  const refresh = req.query.refresh === 'true';
  try {
    const articles = refresh ? await generateNewsFeed({ writeToDisk: true }) : await loadNewsFeed();
    res.json({ articles });
  } catch (error) {
    logger.error('Failed to load news feed', error);
    res.status(500).json({ message: 'Unable to load news feed' });
  }
});

module.exports = router;
