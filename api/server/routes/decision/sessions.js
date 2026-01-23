/**
 * OptimismAI - Decision Session Routes
 * API routes for decision session persistence
 */

const express = require('express');
const { logger } = require('@librechat/data-schemas');
const {
    getDecisionSession,
    getDecisionSessionsByCursor,
    saveDecisionSession,
    deleteDecisionSession,
} = require('~/models/DecisionSession');

const router = express.Router();

/**
 * GET /api/decision/sessions
 * List all sessions for the authenticated user with cursor-based pagination
 */
router.get('/', async (req, res) => {
    const limit = parseInt(req.query.limit, 10) || 25;
    const cursor = req.query.cursor;
    const order = req.query.order || 'desc';

    try {
        const result = await getDecisionSessionsByCursor(req.user.id, {
            cursor,
            limit,
            order,
        });
        res.status(200).json(result);
    } catch (error) {
        logger.error('[GET /sessions] Error fetching decision sessions', error);
        res.status(500).json({ error: 'Error fetching decision sessions' });
    }
});

/**
 * GET /api/decision/sessions/:sessionId
 * Get a single session by ID
 */
router.get('/:sessionId', async (req, res) => {
    const { sessionId } = req.params;

    try {
        const session = await getDecisionSession(req.user.id, sessionId);
        if (session) {
            res.status(200).json(session);
        } else {
            res.status(404).json({ error: 'Session not found' });
        }
    } catch (error) {
        logger.error('[GET /sessions/:sessionId] Error getting session', error);
        res.status(500).json({ error: 'Error getting session' });
    }
});

/**
 * POST /api/decision/sessions
 * Create a new session
 */
router.post('/', async (req, res) => {
    const sessionData = req.body;

    if (!sessionData.sessionId) {
        return res.status(400).json({ error: 'sessionId is required' });
    }

    try {
        const session = await saveDecisionSession(req.user.id, sessionData);
        res.status(201).json(session);
    } catch (error) {
        logger.error('[POST /sessions] Error creating session', error);
        res.status(500).json({ error: 'Error creating session' });
    }
});

/**
 * PUT /api/decision/sessions/:sessionId
 * Update an existing session
 */
router.put('/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    const sessionData = { ...req.body, sessionId };

    try {
        const session = await saveDecisionSession(req.user.id, sessionData);
        res.status(200).json(session);
    } catch (error) {
        logger.error('[PUT /sessions/:sessionId] Error updating session', error);
        res.status(500).json({ error: 'Error updating session' });
    }
});

/**
 * DELETE /api/decision/sessions/:sessionId
 * Delete a session
 */
router.delete('/:sessionId', async (req, res) => {
    const { sessionId } = req.params;

    try {
        const result = await deleteDecisionSession(req.user.id, sessionId);
        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'Session not found' });
        }
        res.status(200).json({ message: 'Session deleted' });
    } catch (error) {
        logger.error('[DELETE /sessions/:sessionId] Error deleting session', error);
        res.status(500).json({ error: 'Error deleting session' });
    }
});

module.exports = router;
