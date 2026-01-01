const { ContentTypes } = require('librechat-data-provider');
const { logger } = require('@librechat/data-schemas');

/**
 * Creates callbacks to handle question formulation SSE streaming.
 * Follows the same pattern as createOnSearchResults for web search.
 * @param {import('http').ServerResponse} res - The HTTP server response object
 * @returns {{ onFormulationStart: function, onReasoningDelta: function, onComplete: function }}
 */
function createOnQuestionFormulation(res) {
    const context = {
        messageId: undefined,
        conversationId: undefined,
        accumulatedThought: '',
    };

    /**
     * Called when formulation starts - shows the shimmer indicator
     * @param {{ messageId: string, conversationId: string }} metadata
     */
    function onFormulationStart(metadata) {
        context.messageId = metadata.messageId;
        context.conversationId = metadata.conversationId;

        const event = {
            type: ContentTypes.QUESTION_FORMULATION,
            index: 0,
            messageId: context.messageId,
            conversationId: context.conversationId,
            [ContentTypes.QUESTION_FORMULATION]: {
                progress: 0.1,
            },
        };

        writeSSE(res, event);
        logger.debug('[onFormulationStart] Started formulation', { messageId: context.messageId });
    }

    /**
     * Called with each reasoning delta (for streaming reasoning content)
     * @param {string} delta - New reasoning text chunk
     * @param {{ messageId: string, conversationId: string }} metadata
     */
    function onReasoningDelta(delta, metadata) {
        if (metadata?.messageId) {
            context.messageId = metadata.messageId;
        }
        if (metadata?.conversationId) {
            context.conversationId = metadata.conversationId;
        }

        context.accumulatedThought += delta;

        const event = {
            type: ContentTypes.QUESTION_FORMULATION,
            index: 0,
            messageId: context.messageId,
            conversationId: context.conversationId,
            [ContentTypes.QUESTION_FORMULATION]: {
                progress: 0.5,
                thought: context.accumulatedThought,
            },
        };

        writeSSE(res, event);
    }

    /**
     * Called when formulation completes - shows the final question
     * @param {string} question - The formulated question
     * @param {string} thought - The reasoning thought
     */
    function onComplete(question, thought) {
        const event = {
            type: ContentTypes.QUESTION_FORMULATION,
            index: 0,
            messageId: context.messageId,
            conversationId: context.conversationId,
            [ContentTypes.QUESTION_FORMULATION]: {
                progress: 1,
                question,
                thought: thought || context.accumulatedThought,
            },
        };

        writeSSE(res, event);
        logger.debug('[onComplete] Formulation complete', { messageId: context.messageId, question });
    }

    return {
        onFormulationStart,
        onReasoningDelta,
        onComplete,
    };
}

/**
 * Write SSE event to the response stream
 * @param {import('http').ServerResponse} res
 * @param {object} data
 */
function writeSSE(res, data) {
    if (res && res.writable) {
        try {
            res.write(`data: ${JSON.stringify(data)}\n\n`);
        } catch (err) {
            logger.error('[writeSSE] Error writing SSE', err);
        }
    }
}

module.exports = {
    createOnQuestionFormulation,
};
