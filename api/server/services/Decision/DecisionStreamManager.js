/**
 * OptimismAI - Decision Stream Manager
 * Manages SSE streaming for the Living Decision Surface
 *
 * Holds session context and routes decision-related prompts to the LLM
 * Uses SSE pattern from formulation.js
 */

const { v4: uuidv4 } = require('uuid');
const { logger } = require('@librechat/data-schemas');
const { ClarityAssessmentAgent } = require('./ClarityAssessmentAgent');

// ============================================================================
// System Prompts
// ============================================================================

const QUESTION_FORMULATOR_PROMPT = `You are a decision clarification engine for OptimismAI. Your role is to help users think through important decisions by asking high-leverage questions.

Given the user's decision statement, generate exactly 3 questions:
1. REALITY question: Uncover constraints, facts, resources, timelines
2. VALUES question: Explore alignment, feelings, what matters most
3. OPTIONS question: Discover alternatives beyond obvious choices

Rules:
- Each question must be ONE sentence maximum
- Questions should reveal what's NOT YET KNOWN
- Never be chatty or add explanations
- Focus on high-leverage insights

Respond with valid JSON only:
{
  "questions": [
    { "category": "reality", "question": "...", "expectedType": "fact" },
    { "category": "values", "question": "...", "expectedType": "value" },
    { "category": "options", "question": "...", "expectedType": "option" }
  ],
  "domain": "career|finance|relationship|health|major_purchase|other",
  "uncertainty": 0.0-1.0,
  "emotionDetected": "neutral|anxious|excited|conflicted|overwhelmed"
}`;

const ANSWER_PROCESSOR_PROMPT = `You are analyzing a user's answer to a decision-clarifying question.

Extract structured insights from their response. Identify:
1. Constraints/facts discovered
2. Assumptions made (that might need testing)
3. Whether a follow-up question would help
4. Any signals (uncertainty, loops, irreversible elements)

Respond with valid JSON only:
{
  "constraints": ["constraint 1", "constraint 2"],
  "assumptions": [{ "text": "assumption text", "needsTesting": true }],
  "optionsDiscovered": ["option 1"],
  "needsFollowUp": true|false,
  "followUpQuestion": "follow-up if needed",
  "signals": [{ "type": "assumption|loop|uncertainty|irreversibility", "description": "..." }],
  "informationGain": 0.0-1.0
}`;

const MERGE_DETECTOR_PROMPT = `You are detecting when two lines of inquiry in a decision process are converging.

Given two answered questions and their responses, determine if they point to the same underlying insight.

Respond with valid JSON only:
{
  "shouldMerge": true|false,
  "overlapReason": "why they connect (if merging)",
  "insightText": "one-sentence merged insight",
  "confidence": 0.0-1.0
}`;

// ============================================================================
// Content Types for Decision Surface
// ============================================================================

const DecisionContentTypes = {
    NODE_UPDATE: 'decision_node_update',
    SESSION_UPDATE: 'decision_session_update',
    MERGE_SUGGESTION: 'decision_merge_suggestion',
    CLARITY_ASSESSMENT: 'decision_clarity_assessment',
    NEXT_QUESTION: 'decision_next_question',
    ERROR: 'decision_error',
};

// ============================================================================
// DecisionStreamManager Class
// ============================================================================

class DecisionStreamManager {
    /**
     * @param {import('http').ServerResponse} res - HTTP response for SSE
     * @param {object} options - Configuration options
     * @param {function} options.sendMessageToModel - Function to call LLM
     */
    constructor(res, options = {}) {
        this.res = res;
        this.sendMessageToModel = options.sendMessageToModel;

        // Session state
        this.sessionId = uuidv4();
        this.decisionStatement = '';
        this.nodes = new Map(); // nodeId -> { question, answer, category, signals }
        this.constraints = [];
        this.assumptions = [];
        this.options = [];

        // Q&A history for clarity assessment
        this.qaHistory = [];

        // Initialize clarity assessment agent
        this.clarityAgent = new ClarityAssessmentAgent(this.sendMessageToModel);

        logger.debug('[DecisionStreamManager] Created session', { sessionId: this.sessionId });
    }

    // ==========================================================================
    // SSE Helpers
    // ==========================================================================

    /**
     * Write SSE event to the response stream
     * @param {object} data - Event data
     */
    writeSSE(data) {
        if (this.res && this.res.writable) {
            try {
                this.res.write(`data: ${JSON.stringify(data)}\n\n`);
            } catch (err) {
                logger.error('[DecisionStreamManager.writeSSE] Error', err);
            }
        }
    }

    /**
     * Send a node-specific update
     * @param {string} nodeId 
     * @param {object} update 
     */
    sendNodeUpdate(nodeId, update) {
        this.writeSSE({
            type: DecisionContentTypes.NODE_UPDATE,
            nodeId,
            ...update,
        });
    }

    /**
     * Send a session-level update
     * @param {object} update 
     */
    sendSessionUpdate(update) {
        this.writeSSE({
            type: DecisionContentTypes.SESSION_UPDATE,
            sessionId: this.sessionId,
            ...update,
        });
    }

    /**
     * Send an error event
     * @param {string} message 
     */
    sendError(message) {
        this.writeSSE({
            type: DecisionContentTypes.ERROR,
            error: message,
        });
    }

    /**
     * End the SSE stream
     */
    endStream() {
        if (this.res && this.res.writable) {
            this.res.end();
        }
    }

    // ==========================================================================
    // Core Actions
    // ==========================================================================

    /**
     * Generate initial questions from a decision statement
     * @param {string} statement - The user's decision statement
     */
    async generateQuestions(statement) {
        this.decisionStatement = statement;

        logger.debug('[DecisionStreamManager.generateQuestions] Starting', { statement });

        try {
            // Signal start
            this.sendSessionUpdate({
                status: 'generating',
                progress: 0.1,
            });

            // Build messages for the model
            const messages = [
                { role: 'system', content: QUESTION_FORMULATOR_PROMPT },
                { role: 'user', content: statement },
            ];

            // Call the model
            const response = await this.sendMessageToModel(messages, {
                stream: false, // We parse JSON so need complete response
                temperature: 0.7,
            });

            // Parse the JSON response
            let result;
            try {
                // Extract JSON from response (handle markdown code blocks)
                const jsonMatch = response.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    result = JSON.parse(jsonMatch[0]);
                } else {
                    throw new Error('No JSON found in response');
                }
            } catch (parseErr) {
                logger.error('[DecisionStreamManager.generateQuestions] Parse error', parseErr);
                this.sendError('Failed to parse AI response');
                return null;
            }

            // Validate result structure
            if (!result.questions || !Array.isArray(result.questions)) {
                this.sendError('Invalid question format from AI');
                return null;
            }

            // Create nodes and send updates
            const nodes = result.questions.map((q, index) => {
                const nodeId = uuidv4();
                const nodeData = {
                    id: nodeId,
                    question: q.question,
                    category: q.category,
                    expectedType: q.expectedType,
                    state: 'DORMANT',
                    satellites: [],
                    signals: [],
                };

                this.nodes.set(nodeId, nodeData);

                // Stream each node creation
                this.sendNodeUpdate(nodeId, {
                    action: 'created',
                    index,
                    ...nodeData,
                    progress: 0.3 + (index * 0.2),
                });

                return nodeData;
            });

            // Send session completion
            this.sendSessionUpdate({
                status: 'ready',
                progress: 1,
                domain: result.domain,
                uncertainty: result.uncertainty,
                emotionDetected: result.emotionDetected,
                nodeCount: nodes.length,
            });

            logger.debug('[DecisionStreamManager.generateQuestions] Complete', {
                nodeCount: nodes.length,
                domain: result.domain,
            });

            return nodes;

        } catch (err) {
            logger.error('[DecisionStreamManager.generateQuestions] Error', err);
            this.sendError(err.message || 'Failed to generate questions');
            return null;
        }
    }

    /**
     * Process an answer to a question
     * @param {string} nodeId - The node being answered
     * @param {string} answer - The user's answer
     */
    async processAnswer(nodeId, answer) {
        const node = this.nodes.get(nodeId);
        if (!node) {
            this.sendError(`Node ${nodeId} not found`);
            return null;
        }

        logger.debug('[DecisionStreamManager.processAnswer] Starting', { nodeId });

        try {
            // Signal processing
            this.sendNodeUpdate(nodeId, {
                action: 'processing',
                progress: 0.2,
            });

            // Build context prompt
            const contextPrompt = `Decision: ${this.decisionStatement}
Question: ${node.question}
Answer: ${answer}

Previous context:
- Constraints discovered: ${this.constraints.join(', ') || 'none yet'}
- Options considered: ${this.options.join(', ') || 'none yet'}`;

            const messages = [
                { role: 'system', content: ANSWER_PROCESSOR_PROMPT },
                { role: 'user', content: contextPrompt },
            ];

            // Call the model
            const response = await this.sendMessageToModel(messages, {
                stream: false,
                temperature: 0.5,
            });

            // Parse JSON
            let result;
            try {
                const jsonMatch = response.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    result = JSON.parse(jsonMatch[0]);
                } else {
                    throw new Error('No JSON found in response');
                }
            } catch (parseErr) {
                logger.error('[DecisionStreamManager.processAnswer] Parse error', parseErr);
                this.sendError('Failed to parse AI response');
                return null;
            }

            // Update node state
            node.answer = answer;
            node.state = 'RESOLVED';
            node.signals = result.signals || [];
            this.nodes.set(nodeId, node);

            // Update session state
            this.constraints.push(...(result.constraints || []));
            this.options.push(...(result.optionsDiscovered || []));
            this.assumptions.push(...(result.assumptions || []));

            // Send node update
            this.sendNodeUpdate(nodeId, {
                action: 'resolved',
                progress: 1,
                signals: result.signals,
                informationGain: result.informationGain,
            });

            // Create satellite if follow-up needed
            if (result.needsFollowUp && result.followUpQuestion) {
                const satelliteId = uuidv4();
                const satellite = {
                    id: satelliteId,
                    parentId: nodeId,
                    question: result.followUpQuestion,
                    answered: false,
                };

                node.satellites.push(satellite);
                this.nodes.set(nodeId, node);

                this.sendNodeUpdate(nodeId, {
                    action: 'satellite_spawned',
                    satellite,
                });
            }

            // Send session update with new insights
            this.sendSessionUpdate({
                status: 'updated',
                constraints: this.constraints,
                options: this.options,
                assumptions: this.assumptions,
            });

            return result;

        } catch (err) {
            logger.error('[DecisionStreamManager.processAnswer] Error', err);
            this.sendError(err.message || 'Failed to process answer');
            return null;
        }
    }

    /**
     * Check if two nodes should merge
     * @param {string} nodeId1 
     * @param {string} nodeId2 
     */
    async detectMerge(nodeId1, nodeId2) {
        const node1 = this.nodes.get(nodeId1);
        const node2 = this.nodes.get(nodeId2);

        if (!node1 || !node2) {
            this.sendError('One or both nodes not found');
            return null;
        }

        if (!node1.answer || !node2.answer) {
            this.sendError('Both nodes must be answered for merge detection');
            return null;
        }

        logger.debug('[DecisionStreamManager.detectMerge] Checking', { nodeId1, nodeId2 });

        try {
            const contextPrompt = `Question 1: ${node1.question}
Answer 1: ${node1.answer}

Question 2: ${node2.question}
Answer 2: ${node2.answer}`;

            const messages = [
                { role: 'system', content: MERGE_DETECTOR_PROMPT },
                { role: 'user', content: contextPrompt },
            ];

            const response = await this.sendMessageToModel(messages, {
                stream: false,
                temperature: 0.3,
            });

            let result;
            try {
                const jsonMatch = response.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    result = JSON.parse(jsonMatch[0]);
                } else {
                    throw new Error('No JSON found');
                }
            } catch (parseErr) {
                logger.error('[DecisionStreamManager.detectMerge] Parse error', parseErr);
                return null;
            }

            if (result.shouldMerge) {
                this.writeSSE({
                    type: DecisionContentTypes.MERGE_SUGGESTION,
                    node1Id: nodeId1,
                    node2Id: nodeId2,
                    reason: result.overlapReason,
                    insightText: result.insightText,
                    confidence: result.confidence,
                });
            }

            return result;

        } catch (err) {
            logger.error('[DecisionStreamManager.detectMerge] Error', err);
            return null;
        }
    }

    // ==========================================================================
    // Clarity Assessment Flow
    // ==========================================================================

    /**
     * Assess an answer and determine next action
     * This is the main method for the new clarity-aware flow
     * 
     * @param {string} nodeId - The node being answered
     * @param {string} answer - The user's answer
     * @returns {Promise<{assessment, nextQuestion}>}
     */
    async assessAndRespond(nodeId, answer) {
        const node = this.nodes.get(nodeId);
        if (!node) {
            this.sendError(`Node ${nodeId} not found`);
            return null;
        }

        logger.debug('[DecisionStreamManager.assessAndRespond] Starting', { nodeId });

        try {
            // 1. Record this Q&A pair in history
            this.qaHistory.push({
                question: node.question,
                answer: answer,
                category: node.category,
                nodeId: nodeId,
                timestamp: Date.now(),
            });

            // Update node state
            node.answer = answer;
            node.state = 'RESOLVED';
            this.nodes.set(nodeId, node);

            // 2. Run clarity assessment (independent LLM call)
            const assessment = await this.clarityAgent.assessAnswer(
                this.decisionStatement,
                this.qaHistory,
                answer
            );

            // Send assessment to client
            this.writeSSE({
                type: DecisionContentTypes.CLARITY_ASSESSMENT,
                nodeId,
                assessment,
                clarityAchieved: this.clarityAgent.isClarityAchieved(),
                specificityTrend: this.clarityAgent.getSpecificityTrend(),
            });

            logger.debug('[DecisionStreamManager.assessAndRespond] Assessment complete', {
                recommendation: assessment.recommendation,
                specificity: assessment.specificity,
            });

            // 3. If not clarity, generate contextual question (separate LLM call)
            let nextQuestion = null;
            if (assessment.recommendation !== 'clarity') {
                nextQuestion = await this.clarityAgent.generateContextualQuestion(
                    this.decisionStatement,
                    this.qaHistory,
                    assessment
                );

                if (nextQuestion && nextQuestion.shouldAsk) {
                    // Create new node for the question
                    const newNodeId = uuidv4();
                    const newNode = {
                        id: newNodeId,
                        question: nextQuestion.question,
                        category: nextQuestion.category,
                        expectedType: nextQuestion.category === 'reality' ? 'fact'
                            : nextQuestion.category === 'values' ? 'value' : 'option',
                        state: 'DORMANT',
                        satellites: [],
                        signals: [],
                        source: 'assessment',
                    };

                    this.nodes.set(newNodeId, newNode);

                    // Send new question to client
                    this.writeSSE({
                        type: DecisionContentTypes.NEXT_QUESTION,
                        nodeId: newNodeId,
                        action: 'spawned',
                        ...newNode,
                        reasoning: nextQuestion.reasoning,
                    });

                    logger.debug('[DecisionStreamManager.assessAndRespond] Spawned follow-up', {
                        newNodeId,
                        category: nextQuestion.category,
                    });
                }
            } else {
                // Clarity achieved - send reflection if available
                const reflection = await this.clarityAgent.generateContextualQuestion(
                    this.decisionStatement,
                    this.qaHistory,
                    assessment
                );

                if (reflection && reflection.reflection) {
                    this.sendSessionUpdate({
                        status: 'clarity_achieved',
                        reflection: reflection.reflection,
                    });
                }
            }

            return {
                assessment,
                nextQuestion,
            };

        } catch (err) {
            logger.error('[DecisionStreamManager.assessAndRespond] Error', err);
            this.sendError(err.message || 'Failed to assess and respond');
            return null;
        }
    }
}

module.exports = {
    DecisionStreamManager,
    DecisionContentTypes,
};
