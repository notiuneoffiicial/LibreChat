const { ContentTypes } = require('librechat-data-provider');
const { logger } = require('@librechat/data-schemas');

/**
 * Creates callbacks to handle question formulation SSE streaming.
 * Uses data: SSE pattern to trigger contentHandler for shimmer display.
 * @param {import('http').ServerResponse} res - The HTTP server response object
 * @returns {{ onFormulationStart: function, onReasoningDelta: function, onComplete: function, onModeChange: function }}
 */
function createOnQuestionFormulation(res) {
    const context = {
        messageId: undefined,
        conversationId: undefined,
        accumulatedThought: '',
        mode: 'question', // 'question' or 'answer'
    };

    /**
     * Write SSE event to the response stream
     * Uses data: format which routes to contentHandler on frontend
     * @param {object} data - Event data
     */
    function writeSSE(data) {
        if (res && res.writable) {
            try {
                res.write(`data: ${JSON.stringify(data)}\n\n`);
            } catch (err) {
                logger.error('[writeSSE] Error writing SSE', err);
            }
        }
    }

    /**
     * Called when formulation starts - shows the shimmer indicator
     * @param {{ messageId: string, conversationId: string }} metadata
     */
    function onFormulationStart(metadata) {
        context.messageId = metadata.messageId;
        context.conversationId = metadata.conversationId;
        context.mode = 'question';

        const event = {
            type: ContentTypes.QUESTION_FORMULATION,
            index: 0,
            messageId: context.messageId,
            conversationId: context.conversationId,
            [ContentTypes.QUESTION_FORMULATION]: {
                progress: 0.1,
                mode: 'question',
            },
        };

        writeSSE(event);
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
                mode: context.mode,
            },
        };

        writeSSE(event);
    }

    /**
     * Called when mode changes from 'question' to 'answer' (no question was formulated)
     * The shimmer text should seamlessly change to "Formulating answer..."
     */
    function onModeChange(newMode) {
        context.mode = newMode;

        const event = {
            type: ContentTypes.QUESTION_FORMULATION,
            index: 0,
            messageId: context.messageId,
            conversationId: context.conversationId,
            [ContentTypes.QUESTION_FORMULATION]: {
                progress: 0.6, // Still processing, just changed mode
                mode: newMode,
                thought: context.accumulatedThought,
            },
        };

        writeSSE(event);
        logger.debug('[onModeChange] Changed mode to', newMode);
    }

    /**
     * Called when formulation completes - shows the final question
     * @param {string} question - The formulated question
     * @param {string} thought - The reasoning thought
     */
    async function onComplete(question, thought) {
        const event = {
            type: ContentTypes.QUESTION_FORMULATION,
            index: 0,
            messageId: context.messageId,
            conversationId: context.conversationId,
            [ContentTypes.QUESTION_FORMULATION]: {
                progress: 1,
                question,
                thought: thought || context.accumulatedThought,
                mode: context.mode,
            },
        };

        writeSSE(event);
        logger.debug('[onComplete] Formulation complete', { messageId: context.messageId, question });

        // Adaptive Delay for UX (Activity Log)
        // If text is long enough/complex, give the user time to read the "checking with Aristotle" steps
        if (question.length > 50) { // Assuming 'text' refers to 'question' here
            await new Promise(resolve => setTimeout(resolve, 2500));
        }
    }

    return {
        onFormulationStart,
        onReasoningDelta,
        onComplete,
        onModeChange,
    };
}

module.exports = {
    createOnQuestionFormulation,
};
