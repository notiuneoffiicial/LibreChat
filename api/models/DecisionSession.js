/**
 * OptimismAI - Decision Session Model Operations
 * Database operations for decision sessions following Conversation.js pattern
 */

const { logger } = require('@librechat/data-schemas');
const { DecisionSession } = require('~/db/models');

/**
 * Get a single decision session by sessionId for a user
 * @param {string} user - User ID
 * @param {string} sessionId - Session ID
 * @returns {Promise<Object|null>}
 */
const getDecisionSession = async (user, sessionId) => {
    try {
        return await DecisionSession.findOne({ user, sessionId }).lean();
    } catch (error) {
        logger.error('[getDecisionSession] Error getting session', error);
        return null;
    }
};

/**
 * Get decision sessions with cursor-based pagination
 * @param {string} user - User ID
 * @param {Object} options - Query options
 * @returns {Promise<{sessions: Array, nextCursor: string|null}>}
 */
const getDecisionSessionsByCursor = async (user, { cursor, limit = 25, order = 'desc' } = {}) => {
    try {
        const filters = [{ user }];

        if (cursor) {
            filters.push({ updatedAt: { $lt: new Date(cursor) } });
        }

        const query = filters.length === 1 ? filters[0] : { $and: filters };

        const sessions = await DecisionSession.find(query)
            .select('sessionId title statement phase endingState createdAt updatedAt')
            .sort({ updatedAt: order === 'asc' ? 1 : -1 })
            .limit(limit + 1)
            .lean();

        let nextCursor = null;
        if (sessions.length > limit) {
            const lastSession = sessions.pop();
            nextCursor = lastSession.updatedAt.toISOString();
        }

        return { sessions, nextCursor };
    } catch (error) {
        logger.error('[getDecisionSessionsByCursor] Error getting sessions', error);
        return { sessions: [], nextCursor: null };
    }
};

/**
 * Save (create or update) a decision session
 * @param {string} user - User ID
 * @param {Object} sessionData - Session data to save
 * @returns {Promise<Object>}
 */
const saveDecisionSession = async (user, sessionData) => {
    try {
        const { sessionId, ...data } = sessionData;

        if (!sessionId) {
            throw new Error('sessionId is required');
        }

        // Generate title from statement if not provided
        if (!data.title && data.statement) {
            data.title = data.statement.slice(0, 50) + (data.statement.length > 50 ? '...' : '');
        }

        const session = await DecisionSession.findOneAndUpdate(
            { sessionId, user },
            { $set: { ...data, user, sessionId } },
            { new: true, upsert: true },
        );

        return session.toObject();
    } catch (error) {
        logger.error('[saveDecisionSession] Error saving session', error);
        throw error;
    }
};

/**
 * Delete a decision session
 * @param {string} user - User ID
 * @param {string} sessionId - Session ID
 * @returns {Promise<Object>}
 */
const deleteDecisionSession = async (user, sessionId) => {
    try {
        const result = await DecisionSession.deleteOne({ user, sessionId });
        return result;
    } catch (error) {
        logger.error('[deleteDecisionSession] Error deleting session', error);
        throw error;
    }
};

/**
 * Delete all decision sessions for a user
 * @param {string} user - User ID
 * @returns {Promise<Object>}
 */
const deleteAllDecisionSessions = async (user) => {
    try {
        const result = await DecisionSession.deleteMany({ user });
        return result;
    } catch (error) {
        logger.error('[deleteAllDecisionSessions] Error deleting sessions', error);
        throw error;
    }
};

module.exports = {
    getDecisionSession,
    getDecisionSessionsByCursor,
    saveDecisionSession,
    deleteDecisionSession,
    deleteAllDecisionSessions,
};
