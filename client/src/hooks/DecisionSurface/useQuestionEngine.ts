/**
 * OptimismAI - Living Decision Surface
 * useQuestionEngine - AI-powered question generation and answer processing
 *
 * Integrates with LibreChat's existing chat completion to:
 * 1. Generate initial inquiry nodes from a decision statement
 * 2. Process answers to extract insights
 * 3. Determine follow-up satellite questions
 */

import { useCallback, useState } from 'react';
import { useSetRecoilState, useRecoilValue } from 'recoil';
import { v4 as uuidv4 } from 'uuid';
import store from '~/store';
import { getSpawnPosition } from '~/components/DecisionSurface/nodeMotionConfig';
import type {
    ThoughtNodeData,
    SatelliteNodeData,
    TopicKey,
    QuestionCategory,
    ExpectedInfoType,
    NodeSignal,
} from '~/common/DecisionSession.types';

// ============================================================================
// System Prompts for Different Modes
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
// Types
// ============================================================================

interface GeneratedQuestion {
    category: TopicKey;
    question: string;
    expectedType: ExpectedInfoType;
}

interface QuestionGenerationResult {
    questions: GeneratedQuestion[];
    domain: string;
    uncertainty: number;
    emotionDetected: string;
}

interface AnswerProcessingResult {
    constraints: string[];
    assumptions: { text: string; needsTesting: boolean }[];
    optionsDiscovered: string[];
    needsFollowUp: boolean;
    followUpQuestion?: string;
    signals: NodeSignal[];
    informationGain: number;
}

interface MergeDetectionResult {
    shouldMerge: boolean;
    overlapReason?: string;
    insightText: string;
    confidence: number;
}

// ============================================================================
// Hook
// ============================================================================

export function useQuestionEngine() {
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const anchorPosition = useRecoilValue(store.anchorPositionAtom);
    const setThoughtNodes = useSetRecoilState(store.thoughtNodesAtom);
    const setSession = useSetRecoilState(store.decisionSessionAtom);

    /**
     * Generate initial inquiry nodes from a decision statement
     * Uses structured prompt to get 3 high-leverage questions
     */
    const generateInitialQuestions = useCallback(
        async (decisionStatement: string): Promise<ThoughtNodeData[]> => {
            setIsProcessing(true);
            setError(null);

            try {
                // For now, use placeholder questions
                // TODO: Integrate with actual chat completion API
                const result = await simulateQuestionGeneration(decisionStatement);

                const now = Date.now();
                const nodes: ThoughtNodeData[] = result.questions.map((q, index) => ({
                    id: uuidv4(),
                    state: 'DORMANT' as const,
                    question: q.question,
                    topicKey: q.category,
                    category: getCategoryFromTopic(q.category),
                    expectedInfoType: q.expectedType,
                    position: getSpawnPosition(index, anchorPosition.x, anchorPosition.y),
                    satellites: [],
                    signals: [],
                    createdAt: now + index * 70, // Stagger for animation
                }));

                // Update session with domain/emotion info
                setSession((prev) =>
                    prev
                        ? {
                            ...prev,
                            draft: {
                                statement: decisionStatement,
                                domain: result.domain,
                                uncertaintyEstimate: result.uncertainty,
                                emotionEstimate: result.emotionDetected,
                            },
                            updatedAt: Date.now(),
                        }
                        : prev,
                );

                setThoughtNodes(nodes);
                return nodes;
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Failed to generate questions';
                setError(message);
                console.error('[useQuestionEngine] Error generating questions:', err);
                return [];
            } finally {
                setIsProcessing(false);
            }
        },
        [anchorPosition, setThoughtNodes, setSession],
    );

    /**
     * Process an answer to extract insights and determine follow-ups
     */
    const processAnswer = useCallback(
        async (
            nodeId: string,
            question: string,
            answer: string,
        ): Promise<AnswerProcessingResult | null> => {
            setIsProcessing(true);
            setError(null);

            try {
                // TODO: Integrate with actual chat completion API
                const result = await simulateAnswerProcessing(question, answer);

                // Update the node with signals and potentially spawn satellite
                setThoughtNodes((prev) =>
                    prev.map((node) => {
                        if (node.id !== nodeId) return node;

                        const updatedNode = {
                            ...node,
                            answer,
                            state: 'RESOLVED' as const,
                            resolvedAt: Date.now(),
                            signals: [...node.signals, ...result.signals],
                        };

                        // Add satellite if follow-up needed
                        if (result.needsFollowUp && result.followUpQuestion) {
                            const parentPos = node.position;
                            const satelliteAngle = Math.random() * 360;
                            const satelliteRadius = 70;

                            const satellite: SatelliteNodeData = {
                                id: uuidv4(),
                                parentId: node.id,
                                question: result.followUpQuestion,
                                position: {
                                    x: parentPos.x + satelliteRadius * Math.cos((satelliteAngle * Math.PI) / 180),
                                    y: parentPos.y + satelliteRadius * Math.sin((satelliteAngle * Math.PI) / 180),
                                },
                                answered: false,
                                createdAt: Date.now(),
                            };

                            updatedNode.satellites = [...node.satellites, satellite];
                        }

                        return updatedNode;
                    }),
                );

                // Update session with discovered constraints/options
                setSession((prev) => {
                    if (!prev) return prev;
                    return {
                        ...prev,
                        constraints: [...prev.constraints, ...result.constraints],
                        options: [
                            ...prev.options,
                            ...result.optionsDiscovered.map((opt) => ({
                                id: uuidv4(),
                                text: opt,
                                eliminated: false,
                            })),
                        ],
                        assumptions: [
                            ...prev.assumptions,
                            ...result.assumptions.map((a) => ({
                                id: uuidv4(),
                                text: a.text,
                                resolved: !a.needsTesting,
                            })),
                        ],
                        updatedAt: Date.now(),
                    };
                });

                return result;
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Failed to process answer';
                setError(message);
                console.error('[useQuestionEngine] Error processing answer:', err);
                return null;
            } finally {
                setIsProcessing(false);
            }
        },
        [setThoughtNodes, setSession],
    );

    /**
     * Detect if two nodes should merge based on overlapping insights
     */
    const detectMerge = useCallback(
        async (
            node1: ThoughtNodeData,
            node2: ThoughtNodeData,
        ): Promise<MergeDetectionResult | null> => {
            if (!node1.answer || !node2.answer) return null;

            setIsProcessing(true);
            setError(null);

            try {
                // TODO: Integrate with actual chat completion API
                const result = await simulateMergeDetection(node1, node2);
                return result;
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Failed to detect merge';
                setError(message);
                console.error('[useQuestionEngine] Error detecting merge:', err);
                return null;
            } finally {
                setIsProcessing(false);
            }
        },
        [],
    );

    /**
     * Get the next best question based on current state
     * Uses information gain to prioritize
     */
    const getNextQuestion = useCallback(
        (nodes: ThoughtNodeData[]): ThoughtNodeData | null => {
            // Find unanswered dormant nodes
            const unanswered = nodes.filter((n) => n.state === 'DORMANT' && !n.answer);

            if (unanswered.length === 0) return null;

            // For now, just return the first one
            // TODO: Implement information gain-based selection
            return unanswered[0];
        },
        [],
    );

    return {
        isProcessing,
        error,
        generateInitialQuestions,
        processAnswer,
        detectMerge,
        getNextQuestion,
    };
}

// ============================================================================
// Helpers
// ============================================================================

function getCategoryFromTopic(topic: TopicKey): QuestionCategory {
    switch (topic) {
        case 'reality':
            return 'grounding';
        case 'values':
            return 'clarifying';
        case 'options':
            return 'contrast';
        default:
            return 'grounding';
    }
}

// ============================================================================
// Simulated API Calls (to be replaced with real integration)
// ============================================================================

async function simulateQuestionGeneration(
    statement: string,
): Promise<QuestionGenerationResult> {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Detect domain from keywords
    const lowerStatement = statement.toLowerCase();
    let domain = 'other';
    if (lowerStatement.includes('job') || lowerStatement.includes('career') || lowerStatement.includes('work')) {
        domain = 'career';
    } else if (lowerStatement.includes('money') || lowerStatement.includes('invest') || lowerStatement.includes('buy')) {
        domain = 'finance';
    } else if (lowerStatement.includes('relationship') || lowerStatement.includes('partner')) {
        domain = 'relationship';
    }

    // Generate contextual questions based on domain
    const questions: GeneratedQuestion[] = [
        {
            category: 'reality',
            question: domain === 'career'
                ? 'What financial runway do you have if you make this change?'
                : 'What constraints are truly non-negotiable in this decision?',
            expectedType: 'fact',
        },
        {
            category: 'values',
            question: domain === 'career'
                ? 'What feels most misaligned about your current situation?'
                : 'What would you regret more: acting or not acting?',
            expectedType: 'value',
        },
        {
            category: 'options',
            question: domain === 'career'
                ? 'What paths exist between staying fully and leaving completely?'
                : 'What alternatives have you not yet considered?',
            expectedType: 'option',
        },
    ];

    return {
        questions,
        domain,
        uncertainty: 0.7,
        emotionDetected: 'neutral',
    };
}

async function simulateAnswerProcessing(
    question: string,
    answer: string,
): Promise<AnswerProcessingResult> {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 300));

    const lowerAnswer = answer.toLowerCase();
    const constraints: string[] = [];
    const assumptions: { text: string; needsTesting: boolean }[] = [];
    const signals: NodeSignal[] = [];

    // Extract constraints from number-like mentions
    if (/\d+\s*(month|year|week|day)s?/.test(lowerAnswer)) {
        constraints.push('Time constraint identified');
    }
    if (/\$\d+|\d+\s*(dollar|euro|pound)s?/i.test(lowerAnswer)) {
        constraints.push('Financial constraint identified');
    }

    // Detect assumptions
    if (lowerAnswer.includes('probably') || lowerAnswer.includes('i think') || lowerAnswer.includes('assume')) {
        assumptions.push({
            text: 'Untested assumption in reasoning',
            needsTesting: true,
        });
        signals.push({
            type: 'assumption',
            description: 'This answer contains an untested assumption',
        });
    }

    // Detect uncertainty
    if (lowerAnswer.includes('not sure') || lowerAnswer.includes("don't know") || lowerAnswer.includes('maybe')) {
        signals.push({
            type: 'uncertainty',
            description: 'Uncertainty expressed in this area',
        });
    }

    // Determine if follow-up needed
    const needsFollowUp = answer.length < 50 || signals.length > 0;
    const followUpQuestion = needsFollowUp
        ? 'Can you tell me more about what makes this uncertain?'
        : undefined;

    return {
        constraints,
        assumptions,
        optionsDiscovered: [],
        needsFollowUp,
        followUpQuestion,
        signals,
        informationGain: Math.min(1, answer.length / 200),
    };
}

async function simulateMergeDetection(
    node1: ThoughtNodeData,
    node2: ThoughtNodeData,
): Promise<MergeDetectionResult> {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Simple heuristic: merge if both are resolved and share keywords
    if (node1.state !== 'RESOLVED' || node2.state !== 'RESOLVED') {
        return { shouldMerge: false, insightText: '', confidence: 0 };
    }

    const answer1 = (node1.answer || '').toLowerCase();
    const answer2 = (node2.answer || '').toLowerCase();

    // Check for overlapping significant words
    const words1 = new Set(answer1.split(/\s+/).filter((w) => w.length > 4));
    const words2 = new Set(answer2.split(/\s+/).filter((w) => w.length > 4));
    const overlap = [...words1].filter((w) => words2.has(w));

    const shouldMerge = overlap.length >= 2;

    return {
        shouldMerge,
        overlapReason: shouldMerge ? `Both mention: ${overlap.slice(0, 3).join(', ')}` : undefined,
        insightText: shouldMerge
            ? `These paths converge on ${overlap[0] || 'a shared concern'}`
            : '',
        confidence: Math.min(1, overlap.length / 5),
    };
}

export default useQuestionEngine;
