/**
 * OptimismAI - Decision Stream Controller
 * Express controller for /api/decision/stream endpoint
 */

const { DecisionStreamManager } = require('~/server/services/Decision/DecisionStreamManager');
const { logger } = require('@librechat/data-schemas');

/**
 * Create a simple model caller using DeepSeek's OpenAI-compatible API
 * Falls back to OpenAI if DeepSeek isn't configured
 */
function createModelCaller(req) {
    return async function sendMessageToModel(messages, options = {}) {
        const { OpenAI } = require('openai');

        // Check for DeepSeek first, then fall back to OpenAI
        const deepseekKey = process.env.DEEPSEEK_API_KEY;
        const openaiKey = process.env.OPENAI_API_KEY;

        let client;
        let model;

        if (deepseekKey) {
            // Use DeepSeek with OpenAI-compatible endpoint
            client = new OpenAI({
                apiKey: deepseekKey,
                baseURL: 'https://api.deepseek.com',
            });
            model = options.model || 'deepseek-chat';
            logger.debug('[DecisionStreamController] Using DeepSeek');
        } else if (openaiKey) {
            // Fall back to OpenAI
            client = new OpenAI({ apiKey: openaiKey });
            model = options.model || 'gpt-4o-mini';
            logger.debug('[DecisionStreamController] Using OpenAI');
        } else {
            throw new Error('No API key configured. Set DEEPSEEK_API_KEY or OPENAI_API_KEY');
        }

        const response = await client.chat.completions.create({
            model,
            messages,
            temperature: options.temperature || 0.7,
            stream: false, // Decision engine uses non-streaming for JSON parsing
        });

        return response.choices[0]?.message?.content || '';
    };
}

/**
 * Main stream controller
 * Handles POST /api/decision/stream
 */
async function streamController(req, res) {
    const { action, payload } = req.body;

    if (!action) {
        return res.status(400).json({ error: 'Missing action parameter' });
    }

    logger.debug('[DecisionStreamController] Request', { action, userId: req.user?.id });

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    // Create the stream manager
    const sendMessageToModel = createModelCaller(req);
    const manager = new DecisionStreamManager(res, { sendMessageToModel });

    try {
        switch (action) {
            case 'generate': {
                const { statement } = payload || {};
                if (!statement) {
                    manager.sendError('Missing statement in payload');
                    manager.endStream();
                    return;
                }
                await manager.generateQuestions(statement);
                break;
            }

            case 'answer': {
                const { nodeId, answer, question, sessionContext } = payload || {};
                if (!nodeId || !answer) {
                    manager.sendError('Missing nodeId or answer in payload');
                    manager.endStream();
                    return;
                }

                // For stateless requests, restore node context from client
                if (sessionContext) {
                    sessionContext.nodes?.forEach(node => {
                        manager.nodes.set(node.id, node);
                    });
                    manager.decisionStatement = sessionContext.statement || '';
                    manager.constraints = sessionContext.constraints || [];
                    manager.options = sessionContext.options || [];
                }

                await manager.processAnswer(nodeId, answer);
                break;
            }

            case 'merge': {
                const { nodeId1, nodeId2, sessionContext } = payload || {};
                if (!nodeId1 || !nodeId2) {
                    manager.sendError('Missing nodeIds in payload');
                    manager.endStream();
                    return;
                }

                // Restore context
                if (sessionContext) {
                    sessionContext.nodes?.forEach(node => {
                        manager.nodes.set(node.id, node);
                    });
                }

                await manager.detectMerge(nodeId1, nodeId2);
                break;
            }

            default:
                manager.sendError(`Unknown action: ${action}`);
        }
    } catch (err) {
        logger.error('[DecisionStreamController] Error', err);
        manager.sendError(err.message || 'Internal server error');
    } finally {
        manager.endStream();
    }
}

module.exports = {
    streamController,
};
