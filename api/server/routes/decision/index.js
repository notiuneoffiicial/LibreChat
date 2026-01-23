/**
 * OptimismAI - Decision Routes
 * API routes for the Living Decision Surface
 */

const express = require('express');
const { requireJwtAuth } = require('~/server/middleware');
const { streamController } = require('~/server/controllers/decision');
const sessionsRouter = require('./sessions');

const router = express.Router();

// Require authentication for decision endpoints
router.use(requireJwtAuth);

// Mount sessions sub-router
router.use('/sessions', sessionsRouter);

/**
 * POST /api/decision/stream
 * 
 * Main SSE endpoint for decision surface interactions
 * 
 * Body:
 *   action: 'generate' | 'answer' | 'merge'
 *   payload: { ...action-specific data }
 * 
 * Actions:
 *   generate: { statement: string }
 *   answer: { nodeId: string, answer: string, sessionContext?: object }
 *   merge: { nodeId1: string, nodeId2: string, sessionContext?: object }
 */
router.post('/stream', streamController);

module.exports = router;

