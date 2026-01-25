/**
 * OptimismAI - Clarity Assessment Agent
 * Evaluates answer quality across the session to determine clarity progress
 * 
 * Operates independently from question generation.
 * After each answer, assesses:
 * - Specificity: Is the answer concrete or vague?
 * - Coherence: Does it align with or contradict previous answers?
 * - Orientation: Is the user exploring or ready to act?
 * - Tension delta: Does this close loops or open new ones?
 * 
 * Returns a recommendation for the question generator:
 * - probe_deeper: Same area needs more exploration
 * - explore_new: A new area should be touched
 * - converging: Session is settling, reduce probing
 * - clarity: Genuine clarity achieved, can offer to end
 */

const { logger } = require('@librechat/data-schemas');

// ============================================================================
// Clarity Assessment Prompt
// ============================================================================

const CLARITY_ASSESSMENT_PROMPT = `You are a clarity assessment agent for OptimismAI. Your role is to evaluate the quality and depth of a user's thinking about their decision.

You will receive:
1. The original decision statement
2. All Q&A pairs from the session so far
3. The latest answer being assessed

Your task is to analyze the LATEST answer in context of the full session and provide a structured assessment.

ASSESSMENT CRITERIA:

1. SPECIFICITY (1-5):
   1 = Completely vague ("I don't know", "maybe")
   2 = Mostly vague with hints of something concrete
   3 = Mixed - some concrete elements, some vague
   4 = Mostly concrete with clear facts/feelings
   5 = Highly specific with actionable details

2. COHERENCE:
   - "contradicts" = This answer conflicts with something said earlier
   - "neutral" = No clear relationship to previous answers
   - "reinforces" = This confirms or builds on earlier thinking

3. TENSION_DELTA:
   - "new_tension" = This answer reveals new complexity or concerns
   - "no_change" = Neither opens nor closes anything significant
   - "tension_closed" = This resolves a previously open question or concern

4. ORIENTATION:
   - "exploring" = Still discovering, asking "what", divergent thinking
   - "transitioning" = Starting to narrow, comparing options
   - "action_ready" = Clear on what to do, thinking about "how"

5. RECOMMENDATION:
   - "probe_deeper" = This area needs more exploration (suggest focus area)
   - "explore_new" = Touch a different dimension (suggest which: reality/values/options)
   - "converging" = Good progress, light probing only
   - "clarity" = Genuine clarity emerging, can offer to conclude

Respond with valid JSON only:
{
  "specificity": 1-5,
  "coherence": "contradicts" | "neutral" | "reinforces",
  "tensionDelta": "new_tension" | "no_change" | "tension_closed",
  "orientation": "exploring" | "transitioning" | "action_ready",
  "recommendation": "probe_deeper" | "explore_new" | "converging" | "clarity",
  "suggestedFocus": "optional string - what to probe or explore if applicable",
  "reasoning": "1-2 sentences explaining your assessment"
}`;

// ============================================================================
// Contextual Question Generator Prompt
// ============================================================================

const CONTEXTUAL_QUESTION_PROMPT = `You are a decision clarification engine for OptimismAI. Generate a SINGLE focused question based on the session context and clarity assessment.

You will receive:
1. The original decision statement
2. All Q&A pairs from the session so far
3. A clarity assessment with recommendation

Based on the recommendation:
- "probe_deeper": Ask a follow-up that digs deeper into the suggested focus area
- "explore_new": Ask a question in the suggested dimension (reality/values/options)
- "converging": Ask a light, confirming question that helps crystallize thinking
- "clarity": No question needed (you may still suggest one optional reflection)

Rules:
- ONE sentence maximum
- Target what's NOT YET KNOWN or NOT YET CLEAR
- Never be chatty or explain yourself
- Match the depth to the recommendation

If recommendation is "clarity", respond with:
{
  "shouldAsk": false,
  "reflection": "optional 1-sentence observation about what emerged"
}

Otherwise respond with:
{
  "shouldAsk": true,
  "question": "your single focused question",
  "category": "reality" | "values" | "options",
  "reasoning": "why this question now"
}`;

// ============================================================================
// ClarityAssessmentAgent Class
// ============================================================================

class ClarityAssessmentAgent {
    /**
     * @param {function} sendMessageToModel - Function to call LLM
     */
    constructor(sendMessageToModel) {
        this.sendMessageToModel = sendMessageToModel;

        // Track assessment history for trend detection
        this.assessmentHistory = [];
    }

    /**
     * Build session context string from Q&A history
     * @param {string} decisionStatement 
     * @param {Array} qaHistory - Array of { question, answer, category }
     */
    buildSessionContext(decisionStatement, qaHistory) {
        let context = `DECISION: ${decisionStatement}\n\n`;
        context += `SESSION HISTORY:\n`;

        qaHistory.forEach((qa, index) => {
            context += `\n--- Exchange ${index + 1} ---\n`;
            context += `Category: ${qa.category || 'general'}\n`;
            context += `Question: ${qa.question}\n`;
            context += `Answer: ${qa.answer || '[not yet answered]'}\n`;
        });

        return context;
    }

    /**
     * Assess the latest answer for clarity progress
     * @param {string} decisionStatement - Original decision
     * @param {Array} qaHistory - All Q&A pairs including latest
     * @param {string} latestAnswer - The answer being assessed
     * @returns {Promise<ClarityAssessment>}
     */
    async assessAnswer(decisionStatement, qaHistory, latestAnswer) {
        logger.debug('[ClarityAssessmentAgent.assessAnswer] Starting assessment');

        try {
            const sessionContext = this.buildSessionContext(decisionStatement, qaHistory);

            const prompt = `${sessionContext}\n\nLATEST ANSWER TO ASSESS:\n${latestAnswer}`;

            const messages = [
                { role: 'system', content: CLARITY_ASSESSMENT_PROMPT },
                { role: 'user', content: prompt },
            ];

            const response = await this.sendMessageToModel(messages, {
                stream: false,
                temperature: 0.3, // Low temp for consistent assessment
            });

            // Parse JSON response
            let assessment;
            try {
                const jsonMatch = response.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    assessment = JSON.parse(jsonMatch[0]);
                } else {
                    throw new Error('No JSON found in assessment response');
                }
            } catch (parseErr) {
                logger.error('[ClarityAssessmentAgent.assessAnswer] Parse error', parseErr);
                // Return safe default
                return this.getDefaultAssessment();
            }

            // Validate required fields
            if (!assessment.specificity || !assessment.recommendation) {
                logger.warn('[ClarityAssessmentAgent.assessAnswer] Incomplete assessment, using defaults');
                return this.getDefaultAssessment();
            }

            // Track history for trend analysis
            this.assessmentHistory.push({
                ...assessment,
                timestamp: Date.now(),
            });

            logger.debug('[ClarityAssessmentAgent.assessAnswer] Complete', {
                specificity: assessment.specificity,
                recommendation: assessment.recommendation,
            });

            return assessment;

        } catch (err) {
            logger.error('[ClarityAssessmentAgent.assessAnswer] Error', err);
            return this.getDefaultAssessment();
        }
    }

    /**
     * Generate next question based on assessment
     * @param {string} decisionStatement 
     * @param {Array} qaHistory 
     * @param {ClarityAssessment} assessment 
     * @returns {Promise<QuestionResult>}
     */
    async generateContextualQuestion(decisionStatement, qaHistory, assessment) {
        logger.debug('[ClarityAssessmentAgent.generateContextualQuestion] Starting');

        try {
            const sessionContext = this.buildSessionContext(decisionStatement, qaHistory);

            const prompt = `${sessionContext}\n\nCLARITY ASSESSMENT:\n${JSON.stringify(assessment, null, 2)}`;

            const messages = [
                { role: 'system', content: CONTEXTUAL_QUESTION_PROMPT },
                { role: 'user', content: prompt },
            ];

            const response = await this.sendMessageToModel(messages, {
                stream: false,
                temperature: 0.7, // Higher temp for question variety
            });

            // Parse JSON response
            let result;
            try {
                const jsonMatch = response.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    result = JSON.parse(jsonMatch[0]);
                } else {
                    throw new Error('No JSON found in question response');
                }
            } catch (parseErr) {
                logger.error('[ClarityAssessmentAgent.generateContextualQuestion] Parse error', parseErr);
                return { shouldAsk: false };
            }

            logger.debug('[ClarityAssessmentAgent.generateContextualQuestion] Complete', {
                shouldAsk: result.shouldAsk,
                category: result.category,
            });

            return result;

        } catch (err) {
            logger.error('[ClarityAssessmentAgent.generateContextualQuestion] Error', err);
            return { shouldAsk: false };
        }
    }

    /**
     * Check if clarity has been achieved based on assessment history
     * Requires "clarity" recommendation 2+ times consecutively
     */
    isClarityAchieved() {
        if (this.assessmentHistory.length < 2) return false;

        const last2 = this.assessmentHistory.slice(-2);
        return last2.every(a => a.recommendation === 'clarity');
    }

    /**
     * Get trend in specificity over session
     * Returns: 'increasing' | 'stable' | 'decreasing'
     */
    getSpecificityTrend() {
        if (this.assessmentHistory.length < 3) return 'stable';

        const last3 = this.assessmentHistory.slice(-3);
        const scores = last3.map(a => a.specificity);

        const increasing = scores[2] > scores[0];
        const decreasing = scores[2] < scores[0];

        return increasing ? 'increasing' : (decreasing ? 'decreasing' : 'stable');
    }

    /**
     * Get default safe assessment when parsing fails
     */
    getDefaultAssessment() {
        return {
            specificity: 3,
            coherence: 'neutral',
            tensionDelta: 'no_change',
            orientation: 'exploring',
            recommendation: 'explore_new',
            suggestedFocus: null,
            reasoning: 'Assessment unavailable, defaulting to exploration',
        };
    }

    /**
     * Reset assessment history (for new session)
     */
    reset() {
        this.assessmentHistory = [];
    }
}

module.exports = {
    ClarityAssessmentAgent,
    CLARITY_ASSESSMENT_PROMPT,
    CONTEXTUAL_QUESTION_PROMPT,
};
