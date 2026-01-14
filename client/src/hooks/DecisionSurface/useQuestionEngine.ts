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
import { useDecisionStream } from './useDecisionStream';
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

interface UseQuestionEngineOptions {
    /** Use real SSE stream instead of simulation. Default: false */
    useRealStream?: boolean;
}

export function useQuestionEngine(options: UseQuestionEngineOptions = {}) {
    const { useRealStream = false } = options;

    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const anchorPosition = useRecoilValue(store.anchorPositionAtom);
    const setThoughtNodes = useSetRecoilState(store.thoughtNodesAtom);
    const setSession = useSetRecoilState(store.decisionSessionAtom);

    // Initialize the real stream hook (only used when useRealStream is true)
    const stream = useDecisionStream();

    /**
     * Generate initial inquiry nodes from a decision statement
     * Uses structured prompt to get 3 high-leverage questions
     */
    const generateInitialQuestions = useCallback(
        async (decisionStatement: string): Promise<ThoughtNodeData[]> => {
            // Use real SSE stream if enabled
            if (useRealStream) {
                setIsProcessing(true);
                setError(null);
                try {
                    const nodes = await stream.generateQuestions(decisionStatement);
                    return nodes;
                } catch (err) {
                    const message = err instanceof Error ? err.message : 'Stream failed';
                    setError(message);
                    return [];
                } finally {
                    setIsProcessing(false);
                }
            }

            // Fallback to simulation
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
        [anchorPosition, setThoughtNodes, setSession, useRealStream, stream],
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
    await new Promise((resolve) => setTimeout(resolve, 600));

    const lower = statement.toLowerCase();

    // Extract key entities and patterns from the statement
    const keywords = extractKeywords(statement);
    const hasTimeReference = /\b(soon|now|immediately|urgent|deadline|month|week|year)\b/i.test(statement);
    const hasMoneyReference = /\b(cost|expensive|afford|budget|salary|price|\$\d+)\b/i.test(statement);
    const hasPersonReference = /\b(partner|family|boss|friend|colleague|parent|child)\b/i.test(statement);
    const isComparison = /\b(or|versus|vs|between|either|whether)\b/i.test(statement);
    const isMovement = /\b(leave|quit|move|change|start|end|begin|stop)\b/i.test(statement);

    // Detect domain with more nuance
    let domain = 'other';
    let emotionDetected = 'neutral';

    if (/\b(job|career|work|boss|resign|quit|promotion|salary|hire|fired)\b/i.test(lower)) {
        domain = 'career';
    } else if (/\b(invest|money|buy|sell|stock|house|rent|mortgage|debt|loan|save)\b/i.test(lower)) {
        domain = 'finance';
    } else if (/\b(relationship|partner|marry|divorce|dating|love|break.?up)\b/i.test(lower)) {
        domain = 'relationship';
    } else if (/\b(health|doctor|surgery|treatment|diagnosis|sick|pain)\b/i.test(lower)) {
        domain = 'health';
    } else if (/\b(move|relocate|city|country|abroad|immigration)\b/i.test(lower)) {
        domain = 'relocation';
    } else if (/\b(school|degree|study|education|college|university)\b/i.test(lower)) {
        domain = 'education';
    }

    // Detect emotion from language
    if (/\b(stressed|anxious|worried|scared|afraid|nervous)\b/i.test(lower)) {
        emotionDetected = 'anxious';
    } else if (/\b(excited|happy|eager|thrilled)\b/i.test(lower)) {
        emotionDetected = 'excited';
    } else if (/\b(stuck|torn|confused|conflicted)\b/i.test(lower)) {
        emotionDetected = 'conflicted';
    } else if (/\b(overwhelmed|exhausted|tired)\b/i.test(lower)) {
        emotionDetected = 'overwhelmed';
    }

    // Generate contextual questions based on extracted features
    const questions: GeneratedQuestion[] = [
        {
            category: 'reality',
            question: generateRealityQuestion(domain, keywords, hasTimeReference, hasMoneyReference),
            expectedType: 'fact',
        },
        {
            category: 'values',
            question: generateValuesQuestion(domain, keywords, emotionDetected, hasPersonReference),
            expectedType: 'value',
        },
        {
            category: 'options',
            question: generateOptionsQuestion(domain, keywords, isComparison, isMovement),
            expectedType: 'option',
        },
    ];

    return {
        questions,
        domain,
        uncertainty: isComparison ? 0.8 : 0.6,
        emotionDetected,
    };
}

/**
 * Extract meaningful keywords from the decision statement
 */
function extractKeywords(statement: string): string[] {
    const stopWords = new Set([
        'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'you', 'your', 'he', 'she', 'it',
        'they', 'them', 'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those',
        'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
        'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must',
        'shall', 'can', 'need', 'dare', 'ought', 'used', 'a', 'an', 'the', 'and', 'but',
        'if', 'or', 'because', 'as', 'until', 'while', 'of', 'at', 'by', 'for', 'with',
        'about', 'against', 'between', 'into', 'through', 'during', 'before', 'after',
        'above', 'below', 'to', 'from', 'up', 'down', 'in', 'out', 'on', 'off', 'over',
        'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where',
        'why', 'how', 'all', 'each', 'few', 'more', 'most', 'other', 'some', 'such',
        'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just',
        'deciding', 'decision', 'whether', 'should', 'thinking', 'considering',
    ]);

    const words = statement.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(word => word.length > 2 && !stopWords.has(word));

    return [...new Set(words)].slice(0, 5);
}

function generateRealityQuestion(
    domain: string,
    keywords: string[],
    hasTime: boolean,
    hasMoney: boolean,
): string {
    const keywordStr = keywords[0] || 'this';

    if (hasMoney) {
        return `What's the actual financial impact of ${keywordStr}, and what's your runway?`;
    }
    if (hasTime) {
        return `What's the real deadline or timeline you're working with?`;
    }

    const domainQuestions: Record<string, string> = {
        career: `What would you lose if you left, and what would you gain?`,
        finance: `What's the number you need, and how did you calculate it?`,
        relationship: `What specific behaviors lead you to this decision?`,
        health: `What have the doctors actually said versus what you're assuming?`,
        relocation: `What are the non-negotiable requirements for where you live?`,
        education: `What career outcomes does this education actually enable?`,
        other: `What facts do you know for certain, versus what you're guessing?`,
    };

    return domainQuestions[domain] || domainQuestions.other;
}

function generateValuesQuestion(
    domain: string,
    keywords: string[],
    emotion: string,
    hasPerson: boolean,
): string {
    if (hasPerson) {
        return `Whose opinion matters most here, and why does it matter to you?`;
    }

    if (emotion === 'anxious') {
        return `What's the fear underneath this decision?`;
    }
    if (emotion === 'conflicted') {
        return `What part of you wants one thing, and what part wants another?`;
    }

    const domainQuestions: Record<string, string> = {
        career: `If success wasn't about money, what would "winning" look like here?`,
        finance: `What does this money represent to you beyond its number?`,
        relationship: `What version of yourself emerges in each scenario?`,
        health: `What quality of life are you really optimizing for?`,
        relocation: `What kind of daily life are you trying to create?`,
        education: `What's the person you want to become, and does this path lead there?`,
        other: `What would you regret more: trying and failing, or never trying?`,
    };

    return domainQuestions[domain] || domainQuestions.other;
}

function generateOptionsQuestion(
    domain: string,
    keywords: string[],
    isComparison: boolean,
    isMovement: boolean,
): string {
    if (isComparison) {
        return `What third option exists that combines the best of both?`;
    }
    if (isMovement) {
        return `What would a "test drive" or partial version of this change look like?`;
    }

    const domainQuestions: Record<string, string> = {
        career: `What paths exist between where you are and where you want to be?`,
        finance: `What are three different approaches with different risk profiles?`,
        relationship: `What would need to change for you to feel differently?`,
        health: `What range of treatments or approaches haven't you explored?`,
        relocation: `What compromise locations might give you 80% of what you want?`,
        education: `What alternative ways could you acquire the same skills or credentials?`,
        other: `What creative alternatives haven't you fully considered?`,
    };

    return domainQuestions[domain] || domainQuestions.other;
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
