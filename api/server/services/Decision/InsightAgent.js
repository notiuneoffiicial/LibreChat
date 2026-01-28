/**
 * OptimismAI - Insight Agent
 * Analyzes conversation context and surfaces relevant web resources
 * 
 * Monitors the decision-making conversation and automatically identifies:
 * - Knowledge gaps that could benefit from external information
 * - Unfamiliar concepts that need clarification
 * - Areas of uncertainty where research could help
 * 
 * When insight is needed, performs web search and synthesizes results
 * into actionable insights connected to specific questions.
 */

const logger = require('~/config/winston');

// ============================================================================
// Prompts
// ============================================================================

const CONTEXT_ANALYSIS_PROMPT = `You are an insight-detection agent for a decision-making tool.
You analyze the conversation to determine if the user would benefit from external information.

INPUT:
- Decision statement: What the user is trying to decide
- Recent Q&A: The questions asked and user's answers
- Current question being considered (if any)

DETECTION CRITERIA - Surface an insight when:
1. User expresses uncertainty about facts ("I'm not sure if...", "I think maybe...")
2. User mentions unfamiliar concepts or jargon
3. User's answer reveals a knowledge gap
4. External data would clearly inform the decision (statistics, research, comparisons)
5. User is making assumptions that could be validated

DO NOT suggest insights for:
- Pure personal preferences
- Already-clear emotional decisions
- Simple yes/no situations
- When user shows high confidence

RESPONSE FORMAT (JSON only):
{
  "insightNeeded": boolean,
  "confidence": 0.0-1.0,
  "reason": "Brief explanation why insight would help",
  "searchQuery": "Specific search query if insight needed",
  "linkedQuestionId": "ID of the question this relates to (if any)"
}

If insightNeeded is false, only include: { "insightNeeded": false }`;

const INSIGHT_SYNTHESIS_PROMPT = `You are synthesizing web search results into a focused insight for a decision-maker.

CONTEXT:
- Decision: {decision}
- Related question: {question}
- Why this was searched: {reason}

SEARCH RESULTS:
{searchResults}

Create a concise, actionable insight. Focus on:
1. The most relevant finding for THIS decision
2. Concrete data, statistics, or expert opinions
3. How this specifically helps the decision

RESPONSE FORMAT (JSON only):
{
  "title": "Short attention-grabbing title (5-8 words)",
  "summary": "2-3 sentences with the key insight",
  "relevance": "1 sentence: how this helps the decision",
  "sourceName": "Name of primary source used",
  "sourceUrl": "URL of primary source"
}`;

// ============================================================================
// InsightAgent Class
// ============================================================================

/**
 * InsightAgent - Analyzes context and surfaces relevant resources
 */
class InsightAgent {
    /**
     * @param {function} sendMessageToModel - Function to call LLM
     * @param {function} performWebSearch - Function to search the web
     */
    constructor(sendMessageToModel, performWebSearch = null) {
        this.sendMessageToModel = sendMessageToModel;
        this.performWebSearch = performWebSearch;

        // Track what we've already surfaced to avoid duplicates
        this.surfacedTopics = new Set();

        // Rate limiting - don't spam insights
        this.insightCooldown = 0;
        this.MIN_COOLDOWN_MS = 30000; // 30 seconds between insights
    }

    /**
     * Build context string from session state
     */
    buildSessionContext(decisionStatement, qaHistory, currentQuestion = null) {
        let context = `Decision Statement: "${decisionStatement}"\n\n`;

        if (qaHistory.length > 0) {
            context += 'Recent Q&A History:\n';
            // Only include last 5 Q&As to keep context focused
            const recentQA = qaHistory.slice(-5);
            recentQA.forEach((qa, i) => {
                context += `Q${i + 1}: ${qa.question}\n`;
                context += `A${i + 1}: ${qa.answer}\n\n`;
            });
        }

        if (currentQuestion) {
            context += `\nCurrent question being considered: "${currentQuestion.question}" (ID: ${currentQuestion.id})`;
        }

        return context;
    }

    /**
     * Analyze context to determine if insight is needed
     * @param {string} decisionStatement
     * @param {Array} qaHistory - Array of { question, answer, id }
     * @param {Object} currentQuestion - Optional current question
     * @returns {Promise<{insightNeeded, searchQuery?, reason?, linkedQuestionId?}>}
     */
    async analyzeContext(decisionStatement, qaHistory, currentQuestion = null) {
        // Check cooldown
        const now = Date.now();
        if (now < this.insightCooldown) {
            return { insightNeeded: false };
        }

        const sessionContext = this.buildSessionContext(
            decisionStatement,
            qaHistory,
            currentQuestion
        );

        const messages = [
            { role: 'system', content: CONTEXT_ANALYSIS_PROMPT },
            { role: 'user', content: sessionContext },
        ];

        try {
            logger.debug('[InsightAgent] Analyzing context for insights...');

            const response = await this.sendMessageToModel({
                messages,
                response_format: { type: 'json_object' },
            });

            const result = JSON.parse(response);

            // Check if we've already surfaced this topic
            if (result.insightNeeded && result.searchQuery) {
                const topicKey = result.searchQuery.toLowerCase().slice(0, 50);
                if (this.surfacedTopics.has(topicKey)) {
                    logger.debug('[InsightAgent] Already surfaced this topic, skipping');
                    return { insightNeeded: false };
                }
            }

            logger.debug('[InsightAgent] Analysis result:', result);
            return result;
        } catch (error) {
            logger.error('[InsightAgent] Context analysis failed:', error);
            return { insightNeeded: false };
        }
    }

    /**
     * Perform web search and synthesize into insight
     * @param {string} decisionStatement
     * @param {string} searchQuery
     * @param {string} reason - Why this search is relevant
     * @param {Object} relatedQuestion - The question this relates to
     * @returns {Promise<InsightData|null>}
     */
    async generateInsight(decisionStatement, searchQuery, reason, relatedQuestion = null) {
        if (!this.performWebSearch) {
            logger.warn('[InsightAgent] No web search function provided, cannot generate insight');
            return null;
        }

        try {
            logger.debug('[InsightAgent] Performing web search:', searchQuery);

            // Perform the search
            const searchResults = await this.performWebSearch(searchQuery);

            if (!searchResults || searchResults.length === 0) {
                logger.debug('[InsightAgent] No search results found');
                return null;
            }

            // Format search results for synthesis
            const formattedResults = searchResults.slice(0, 5).map((r, i) =>
                `[${i + 1}] ${r.title}\n${r.snippet}\nURL: ${r.url}`
            ).join('\n\n');

            // Build synthesis prompt
            const synthesisPrompt = INSIGHT_SYNTHESIS_PROMPT
                .replace('{decision}', decisionStatement)
                .replace('{question}', relatedQuestion?.question || 'N/A')
                .replace('{reason}', reason)
                .replace('{searchResults}', formattedResults);

            const messages = [
                { role: 'system', content: synthesisPrompt },
                { role: 'user', content: 'Synthesize the search results into an insight.' },
            ];

            const response = await this.sendMessageToModel({
                messages,
                response_format: { type: 'json_object' },
            });

            const insight = JSON.parse(response);

            // Track this topic to avoid duplicates
            const topicKey = searchQuery.toLowerCase().slice(0, 50);
            this.surfacedTopics.add(topicKey);

            // Set cooldown
            this.insightCooldown = Date.now() + this.MIN_COOLDOWN_MS;

            logger.debug('[InsightAgent] Generated insight:', insight.title);

            return {
                ...insight,
                linkedQuestionId: relatedQuestion?.id || null,
            };
        } catch (error) {
            logger.error('[InsightAgent] Insight generation failed:', error);
            return null;
        }
    }

    /**
     * Full pipeline: analyze context and generate insight if needed
     * @param {string} decisionStatement
     * @param {Array} qaHistory
     * @param {Object} currentQuestion
     * @returns {Promise<InsightData|null>}
     */
    async checkAndGenerateInsight(decisionStatement, qaHistory, currentQuestion = null) {
        // First, analyze if insight is needed
        const analysis = await this.analyzeContext(
            decisionStatement,
            qaHistory,
            currentQuestion
        );

        if (!analysis.insightNeeded) {
            return null;
        }

        // Generate the insight
        const relatedQuestion = currentQuestion ||
            (analysis.linkedQuestionId && qaHistory.find(q => q.id === analysis.linkedQuestionId));

        return this.generateInsight(
            decisionStatement,
            analysis.searchQuery,
            analysis.reason,
            relatedQuestion
        );
    }

    /**
     * Reset agent state (for new session)
     */
    reset() {
        this.surfacedTopics.clear();
        this.insightCooldown = 0;
    }
}

module.exports = {
    InsightAgent,
    CONTEXT_ANALYSIS_PROMPT,
    INSIGHT_SYNTHESIS_PROMPT,
};
