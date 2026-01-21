/**
 * OptimismAI - Living Decision Surface
 * useTensionProbe - Single-question probing engine
 * 
 * Replaces useQuestionEngine.
 * Manages the flow of:
 * 1. Generating latent tension points (from statement)
 * 2. Selecting the highest-tension point to probe
 * 3. Processing answers to release tension
 */

import { useCallback, useState } from 'react';
import { useSetRecoilState, useRecoilValue, useRecoilState } from 'recoil';
import { v4 as uuidv4 } from 'uuid';
import store from '~/store';
import { getSpawnPosition, TENSION, CONVERGENCE } from '~/components/DecisionSurface/nodeMotionConfig';
import { useDecisionStream } from './useDecisionStream';
import { useBehaviorSignals } from './useBehaviorSignals';
import type {
    ThoughtNodeData,
    TopicKey,
    QuestionCategory,
    ExpectedInfoType,
    NodeSignal,
    BehaviorSignal,
    NodeState,
} from '~/common/DecisionSession.types';

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

interface UseTensionProbeOptions {
    /** Use real SSE stream instead of simulation. Default: true */
    useRealStream?: boolean;
}

export function useTensionProbe(options: UseTensionProbeOptions = {}) {
    const { useRealStream = true } = options;

    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const anchorPosition = useRecoilValue(store.anchorPositionAtom);
    const [thoughtNodes, setThoughtNodes] = useRecoilState(store.thoughtNodesAtom);
    const setSession = useSetRecoilState(store.decisionSessionAtom);
    const activeNodeId = useRecoilValue(store.activeNodeIdAtom);
    const setActiveNodeId = useSetRecoilState(store.activeNodeIdAtom);
    const [openLoops, setOpenLoops] = useRecoilState(store.openLoopsAtom);

    // Initialize the real stream hook
    const stream = useDecisionStream();

    // Behavior tracking
    const { startTracking, analyzeInput } = useBehaviorSignals();

    /**
     * Generate latent tension points from a decision statement
     */
    const generateInitialTensionPoints = useCallback(
        async (decisionStatement: string): Promise<ThoughtNodeData[]> => {
            setIsProcessing(true);
            setError(null);

            try {
                // Use simulation for now as backend stream is still strictly 3 questions
                // In future, update backend to return tension objects
                const result = await simulateQuestionGeneration(decisionStatement);

                const now = Date.now();
                const nodes: ThoughtNodeData[] = result.questions.map((q, index) => ({
                    id: uuidv4(),
                    state: 'LATENT' as const, // Start as LATENT, not DORMANT
                    question: q.question,
                    topicKey: q.category,
                    concept: extractConceptFromQuestion(q.question),
                    intensity: 0.4 + (Math.random() * 0.4), // Random intensity 0.4-0.8 for start
                    category: getCategoryFromTopic(q.category),
                    expectedInfoType: q.expectedType,
                    position: getSpawnPosition(index, anchorPosition.x, anchorPosition.y, result.questions.length),
                    satellites: [],
                    signals: [],
                    affinities: new Map(),
                    source: 'initial',
                    createdAt: now + index * 100,
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

                // Don't auto-select yet, let visualizer spawn them first

                return nodes;
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Failed to generate tension points';
                setError(message);
                console.error('[useTensionProbe] Error generating points:', err);
                return [];
            } finally {
                setIsProcessing(false);
            }
        },
        [anchorPosition, setThoughtNodes, setSession],
    );

    /**
     * Select the next best probe (highest tension latent node)
     */
    const selectNextProbe = useCallback(() => {
        setThoughtNodes(currentNodes => {
            // Filter eligible latent nodes
            const latentNodes = currentNodes.filter(n => n.state === 'LATENT');

            if (latentNodes.length === 0) return currentNodes;

            // Find highest intensity
            const nextProbe = latentNodes.reduce((prev, current) =>
                (current.intensity || 0) > (prev.intensity || 0) ? current : prev
            );

            // If we found one, update its state to PROBING
            // Also reset any other PROBING nodes to LATENT
            if (nextProbe) {
                console.log('[useTensionProbe] Selected next probe:', nextProbe.id);
                setActiveNodeId(nextProbe.id);
                startTracking(); // Start tracking response behavior
                return currentNodes.map(n => {
                    if (n.id === nextProbe.id) {
                        return { ...n, state: 'PROBING' as const };
                    } else if (n.state === 'PROBING') {
                        // Reset any other PROBING node back to LATENT
                        return { ...n, state: 'LATENT' as const };
                    }
                    return n;
                });
            }

            return currentNodes;
        });
    }, [setThoughtNodes, setActiveNodeId]);

    /**
     * Regenerate a tension point (throw gesture)
     * Hoisted so processAnswer can see it
     */
    const regenerateQuestion = useCallback(
        async (category: TopicKey, statement: string): Promise<ThoughtNodeData | null> => {
            // Implementation similar to regenerateQuestion but creating LATENT point
            setIsProcessing(true);
            try {
                const result = await simulateSingleQuestionRegeneration(category, statement);
                if (!result) throw new Error('Failed');

                const newNode: ThoughtNodeData = {
                    id: uuidv4(),
                    state: 'LATENT' as const,
                    question: result.question,
                    topicKey: category,
                    concept: extractConceptFromQuestion(result.question),
                    intensity: 0.6,
                    category: getCategoryFromTopic(category),
                    expectedInfoType: result.expectedType,
                    // Spawn near center or random?
                    position: getSpawnPosition(0, anchorPosition.x, anchorPosition.y),
                    satellites: [],
                    signals: [],
                    source: 'user_added',
                    createdAt: Date.now(),
                };

                setThoughtNodes(prev => [...prev, newNode]);
                return newNode;
            } catch (e) {
                console.error(e);
                return null;
            } finally {
                setIsProcessing(false);
            }
        },
        [anchorPosition, setThoughtNodes]
    );

    /**
     * Process an answer to release tension
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
                // Determine tension reduction based on answer length
                const tensionRelease = Math.min(
                    CONVERGENCE.MAX_TENSION_RELEASE,
                    answer.length * CONVERGENCE.TENSION_RELEASE_RATE
                );

                const result = await simulateAnswerProcessing(question, answer);

                // Track if this answer resolves the node (for loop handling below)
                let nodeWasResolved = false;

                setThoughtNodes((prev) =>
                    prev.map((node) => {
                        if (node.id !== nodeId) return node;

                        const currentIntensity = node.intensity || 0.5;
                        const newIntensity = Math.max(0, currentIntensity - tensionRelease);

                        // If intensity is very low, mark resolved
                        const isResolved = newIntensity < CONVERGENCE.RESOLUTION_THRESHOLD;
                        nodeWasResolved = isResolved; // Capture for outer scope

                        return {
                            ...node,
                            answer,
                            intensity: newIntensity,
                            state: isResolved ? 'RESOLVED' : 'LATENT' as NodeState,
                            resolvedAt: isResolved ? Date.now() : undefined,
                            signals: [...node.signals, ...result.signals],
                        };
                    }),
                );

                // Open Loop Tracking
                const behaviorSignals = analyzeInput(answer); // Analyze behavior (time, hedging)
                const newSignals = [...(result.signals || []), ...behaviorSignals]; // Combine with simulation signals

                const hasUncertainty = newSignals.some(s => s.type === 'uncertainty' || (s.type === 'hedging' && s.indicates === 'confusion'));
                const hasAssumption = newSignals.some(s => s.type === 'assumption');

                if (hasUncertainty || hasAssumption) {
                    setOpenLoops(prev => [
                        ...prev,
                        {
                            id: uuidv4(),
                            description: hasAssumption ? 'Untested assumption' : 'Uncertainty detected',
                            tensionPointId: nodeId,
                            raisedAt: Date.now(),
                            status: 'open',
                        }
                    ]);
                } else if (nodeWasResolved) {
                    // Resolve loops if node is resolved
                    setOpenLoops(prev => prev.map(loop =>
                        loop.tensionPointId === nodeId && loop.status === 'open'
                            ? { ...loop, status: 'resolved' as const, resolvedAt: Date.now() }
                            : loop
                    ));
                }

                // Check if we need to spawn new tension points from this answer
                if (result.needsFollowUp && result.followUpQuestion) {
                    await regenerateQuestion('reality', answer); // Approximate category
                }

                // Clear active node immediately to fix selection persistence bug
                setActiveNodeId(null);

                // Auto-select next probe after short delay
                setTimeout(() => {
                    selectNextProbe();
                }, CONVERGENCE.AUTO_PROBE_DELAY);

                return result;
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Failed to process answer';
                setError(message);
                console.error('[useTensionProbe] Error processing answer:', err);
                setActiveNodeId(null); // Clear even on error
                return null;
            } finally {
                setIsProcessing(false);
            }
        },
        [setThoughtNodes, selectNextProbe, regenerateQuestion, setActiveNodeId],
    );

    return {
        isProcessing,
        error,
        generateInitialTensionPoints,
        processAnswer,
        selectNextProbe,
        regenerateQuestion,
    };
}

// ============================================================================
// Helpers & Simulations
// ============================================================================

function getCategoryFromTopic(topic: TopicKey): QuestionCategory {
    switch (topic) {
        case 'reality': return 'grounding';
        case 'values': return 'clarifying';
        case 'options': return 'contrast';
        default: return 'grounding';
    }
}

function extractConceptFromQuestion(question: string): string {
    // Simple heuristic extraction from question text
    const words = question.split(' ');
    const stopWords = new Set(['what', 'why', 'how', 'when', 'where', 'who', 'is', 'are', 'the', 'a', 'an', 'do', 'does']);

    // Find longest word that isn't a stop word?
    let best = 'Idea';
    let maxLen = 0;

    for (const w of words) {
        const clean = w.replace(/[?.,]/g, '').toLowerCase();
        if (!stopWords.has(clean) && clean.length > maxLen) {
            maxLen = clean.length;
            best = clean;
        }
    }
    // Capitalize
    return best.charAt(0).toUpperCase() + best.slice(1);
}

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

function generateRealityQuestion(domain: string, keywords: string[], hasTime: boolean, hasMoney: boolean): string {
    const keywordStr = keywords[0] || 'this';
    if (hasMoney) return `What's the actual financial impact of ${keywordStr}, and what's your runway?`;
    if (hasTime) return `What's the real deadline or timeline you're working with?`;

    const questions: Record<string, string> = {
        career: `What would you lose if you left, and what would you gain?`,
        finance: `What's the number you need, and how did you calculate it?`,
        relationship: `What specific behaviors lead you to this decision?`,
        health: `What have the doctors actually said versus what you're assuming?`,
        relocation: `What are the non-negotiable requirements for where you live?`,
        education: `What career outcomes does this education actually enable?`,
        other: `What facts do you know for certain, versus what you're guessing?`,
    };
    return questions[domain] || questions.other;
}

function generateValuesQuestion(domain: string, keywords: string[], emotion: string, hasPerson: boolean): string {
    if (hasPerson) return `Whose opinion matters most here, and why does it matter to you?`;
    if (emotion === 'anxious') return `What's the fear underneath this decision?`;
    if (emotion === 'conflicted') return `What part of you wants one thing, and what part wants another?`;

    const questions: Record<string, string> = {
        career: `If success wasn't about money, what would "winning" look like here?`,
        finance: `What does this money represent to you beyond its number?`,
        relationship: `What version of yourself emerges in each scenario?`,
        health: `What quality of life are you really optimizing for?`,
        relocation: `What kind of daily life are you trying to create?`,
        education: `What's the person you want to become, and does this path lead there?`,
        other: `What would you regret more: trying and failing, or never trying?`,
    };
    return questions[domain] || questions.other;
}

function generateOptionsQuestion(domain: string, keywords: string[], isComparison: boolean, isMovement: boolean): string {
    if (isComparison) return `What third option exists that combines the best of both?`;
    if (isMovement) return `What would a "test drive" or partial version of this change look like?`;

    const questions: Record<string, string> = {
        career: `What paths exist between where you are and where you want to be?`,
        finance: `What are three different approaches with different risk profiles?`,
        relationship: `What would need to change for you to feel differently?`,
        health: `What range of treatments or approaches haven't you explored?`,
        relocation: `What compromise locations might give you 80% of what you want?`,
        education: `What alternative ways could you acquire the same skills or credentials?`,
        other: `What creative alternatives haven't you fully considered?`,
    };
    return questions[domain] || questions.other;
}

async function simulateQuestionGeneration(statement: string): Promise<QuestionGenerationResult> {
    await new Promise((resolve) => setTimeout(resolve, 600));
    const lower = statement.toLowerCase();

    // Extract features
    const keywords = extractKeywords(statement);
    const hasTime = /\b(soon|now|immediately|urgent|deadline|month|week|year)\b/i.test(statement);
    const hasMoney = /\b(cost|expensive|afford|budget|salary|price|\$\d+)\b/i.test(statement);
    const hasPerson = /\b(partner|family|boss|friend|colleague|parent|child)\b/i.test(statement);
    const isComparison = /\b(or|versus|vs|between|either|whether)\b/i.test(statement);
    const isMovement = /\b(leave|quit|move|change|start|end|begin|stop)\b/i.test(statement);

    // Detect domain
    let domain = 'other';
    if (/\b(job|career|work|boss|resign|quit|promotion|salary|hire|fired)\b/i.test(lower)) domain = 'career';
    else if (/\b(invest|money|buy|sell|stock|house|rent|mortgage|debt|loan|save)\b/i.test(lower)) domain = 'finance';
    else if (/\b(relationship|partner|marry|divorce|dating|love|break.?up)\b/i.test(lower)) domain = 'relationship';
    else if (/\b(health|doctor|surgery|treatment|diagnosis|sick|pain)\b/i.test(lower)) domain = 'health';
    else if (/\b(move|relocate|city|country|abroad|immigration)\b/i.test(lower)) domain = 'relocation';
    else if (/\b(school|degree|study|education|college|university)\b/i.test(lower)) domain = 'education';

    // Detect emotion
    let emotionDetected = 'neutral';
    if (/\b(stressed|anxious|worried|scared|afraid|nervous)\b/i.test(lower)) emotionDetected = 'anxious';
    else if (/\b(excited|happy|eager|thrilled)\b/i.test(lower)) emotionDetected = 'excited';
    else if (/\b(stuck|torn|confused|conflicted)\b/i.test(lower)) emotionDetected = 'conflicted';
    else if (/\b(overwhelmed|exhausted|tired)\b/i.test(lower)) emotionDetected = 'overwhelmed';

    return {
        questions: [
            { category: 'reality', question: generateRealityQuestion(domain, keywords, hasTime, hasMoney), expectedType: 'fact' },
            { category: 'values', question: generateValuesQuestion(domain, keywords, emotionDetected, hasPerson), expectedType: 'value' },
            { category: 'options', question: generateOptionsQuestion(domain, keywords, isComparison, isMovement), expectedType: 'option' },
        ],
        domain,
        uncertainty: isComparison ? 0.8 : 0.6,
        emotionDetected,
    };
}

async function simulateAnswerProcessing(question: string, answer: string): Promise<AnswerProcessingResult> {
    await new Promise((resolve) => setTimeout(resolve, 300));
    const lowerAnswer = answer.toLowerCase();
    const constraints: string[] = [];
    const assumptions: { text: string; needsTesting: boolean }[] = [];
    const signals: NodeSignal[] = [];

    if (/\d+\s*(month|year|week|day)s?/.test(lowerAnswer)) constraints.push('Time constraint identified');
    if (/\$\d+|\d+\s*(dollar|euro|pound)s?/i.test(lowerAnswer)) constraints.push('Financial constraint identified');

    if (lowerAnswer.includes('probably') || lowerAnswer.includes('i think') || lowerAnswer.includes('assume')) {
        assumptions.push({ text: 'Untested assumption in reasoning', needsTesting: true });
        signals.push({ type: 'assumption', description: 'This answer contains an untested assumption' });
    }

    if (lowerAnswer.includes('not sure') || lowerAnswer.includes("don't know") || lowerAnswer.includes('maybe')) {
        signals.push({ type: 'uncertainty', description: 'Uncertainty expressed in this area' });
    }

    const needsFollowUp = answer.length < 50 || signals.length > 0;

    return {
        constraints,
        assumptions,
        optionsDiscovered: [],
        needsFollowUp,
        followUpQuestion: needsFollowUp ? 'Can you tell me more about what makes this uncertain?' : undefined,
        signals,
        informationGain: Math.min(1, answer.length / 200),
    };
}

async function simulateSingleQuestionRegeneration(category: TopicKey, statement: string) {
    await new Promise((resolve) => setTimeout(resolve, 400));

    // Quick heuristic for alternative questions
    const alternatives = {
        reality: [
            'What information would change this decision completely?',
            'What are the hard numbers involved here?',
            'What resources are you underestimating?'
        ],
        values: [
            'What would your ideal self do?',
            'Which choice aligns with your long-term goals?',
            'What are you afraid of losing?'
        ],
        options: [
            'What if you did nothing?',
            'What exists between these two choices?',
            'How could you test this before committing?'
        ]
    };

    const questions = alternatives[category] || alternatives.reality;
    const randomQ = questions[Math.floor(Math.random() * questions.length)];

    return {
        question: randomQ,
        expectedType: category === 'reality' ? 'fact' : category === 'values' ? 'value' : 'option' as ExpectedInfoType
    };
}
