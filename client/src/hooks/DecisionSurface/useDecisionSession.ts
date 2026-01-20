/**
 * OptimismAI - Living Decision Surface
 * useDecisionSession - State machine for decision session lifecycle
 *
 * Manages the flow: IDLE → INTAKE → EXPLORING → SETTLING → SILENT
 */

import { useCallback, useMemo, useRef } from 'react';
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil';
import { v4 as uuidv4 } from 'uuid';
import store from '~/store';
import { getSpawnPosition, CONVERGENCE } from '~/components/DecisionSurface/nodeMotionConfig';
import { useTensionProbe } from './useTensionProbe';
import { useConvergence } from './useConvergence';
import { useBehaviorSignals } from './useBehaviorSignals';
import type {
    DecisionSession,
    SessionPhase,
    ThoughtNodeData,
    Milestone,
    LeaningVector,
    SessionEvent,
    DecisionSessionDraft,
} from '~/common/DecisionSession.types';

/**
 * useDecisionSession - Core state machine hook
 *
 * Handles all session lifecycle events and state transitions.
 */
export function useDecisionSession(conversationId?: string) {
    // State atoms
    const [session, setSession] = useRecoilState(store.decisionSessionAtom);
    const [phase, setPhase] = useRecoilState(store.sessionPhaseAtom);
    const [nodes, setNodes] = useRecoilState(store.thoughtNodesAtom);
    const [activeNodeId, setActiveNodeId] = useRecoilState(store.activeNodeIdAtom);
    const [milestones, setMilestones] = useRecoilState(store.milestonesAtom);
    const [leaning, setLeaning] = useRecoilState(store.leaningVectorAtom);
    const anchorPosition = useRecoilValue(store.anchorPositionAtom);
    const setComposerSubmitted = useSetRecoilState(store.composerSubmittedAtom);
    const setFieldSettling = useSetRecoilState(store.fieldSettlingAtom);
    const setSessionEndingState = useSetRecoilState(store.sessionEndingStateAtom);
    const [openLoops, setOpenLoops] = useRecoilState(store.openLoopsAtom);
    const [softConfirmation, setSoftConfirmation] = useRecoilState(store.softConfirmationAtom);

    // Question engine for real AI-powered question generation (uses SSE stream)
    const { generateInitialTensionPoints } = useTensionProbe();
    const { checkConvergence, generateConfirmationStatement } = useConvergence();
    const { startTracking } = useBehaviorSignals();

    /**
     * Initialize a new session
     */
    const initSession = useCallback(
        (convoId: string): DecisionSession => {
            const now = Date.now();
            const newSession: DecisionSession = {
                id: uuidv4(),
                conversationId: convoId,
                phase: 'IDLE',
                createdAt: now,
                updatedAt: now,
                constraints: [],
                assumptions: [],
                options: [],
                insights: [],
                milestones: [],
            };
            setSession(newSession);
            setPhase('IDLE');
            setNodes([]);
            setActiveNodeId(null);
            setMilestones([]);
            setLeaning(null);
            setComposerSubmitted(false);
            setFieldSettling(false);
            setSessionEndingState(null);
            setOpenLoops([]); // Reset open loops for new session
            setSoftConfirmation(null); // Reset soft confirmation
            return newSession;
        },
        [
            setSession,
            setPhase,
            setNodes,
            setActiveNodeId,
            setMilestones,
            setLeaning,
            setComposerSubmitted,
            setFieldSettling,
            setSessionEndingState,
            setOpenLoops,
            setSoftConfirmation,
        ],
    );

    /**
     * Add a milestone to the trace
     */
    const addMilestone = useCallback(
        (type: Milestone['type'], label: string, nodeId?: string) => {
            const milestone: Milestone = {
                id: uuidv4(),
                type,
                label,
                timestamp: Date.now(),
                nodeId,
            };
            setMilestones((prev) => [...prev, milestone]);
            setSession((prev) =>
                prev
                    ? {
                        ...prev,
                        milestones: [...prev.milestones, milestone],
                        updatedAt: Date.now(),
                    }
                    : prev,
            );
            return milestone;
        },
        [setMilestones, setSession],
    );

    /**
     * Generate initial thought nodes from first message
     * This would integrate with the AI to generate questions
     */
    const generateInitialNodes = useCallback(
        (draft: DecisionSessionDraft): ThoughtNodeData[] => {
            // For now, generate placeholder nodes
            // In production, this would call the AI to generate contextual questions
            const questions = [
                {
                    question: 'What constraints are non-negotiable right now?',
                    topicKey: 'reality' as const,
                    category: 'grounding' as const,
                    expectedInfoType: 'fact' as const,
                },
                {
                    question: 'What feels misaligned in your current situation?',
                    topicKey: 'values' as const,
                    category: 'clarifying' as const,
                    expectedInfoType: 'value' as const,
                },
                {
                    question: 'What options exist besides the obvious choices?',
                    topicKey: 'options' as const,
                    category: 'contrast' as const,
                    expectedInfoType: 'option' as const,
                },
            ];

            const now = Date.now();
            const newNodes: ThoughtNodeData[] = questions.map((q, index) => ({
                id: uuidv4(),
                state: 'LATENT', // Changed from DORMANT
                question: q.question,
                topicKey: q.topicKey,
                category: q.category,
                expectedInfoType: q.expectedInfoType,
                position: getSpawnPosition(index, anchorPosition.x, anchorPosition.y),
                intensity: 0.6, // Default intensity
                satellites: [],
                signals: [],
                createdAt: now + index * 70, // Stagger for animation
            }));

            return newNodes;
        },
        [anchorPosition],
    );

    /**
     * Handle SUBMIT_DECISION event
     * Now uses real AI-powered question generation via SSE stream
     */
    const submitDecision = useCallback(
        async (message: string) => {
            if (phase !== 'IDLE') return;

            console.log('[useDecisionSession] submitDecision called:', message);

            // Parse the message into a draft (simplified for now)
            const draft: DecisionSessionDraft = {
                statement: message,
                domain: 'general', // Would be classified by AI
                uncertaintyEstimate: 0.7,
                emotionEstimate: 'neutral',
            };

            // Update session
            setSession((prev) =>
                prev
                    ? {
                        ...prev,
                        draft,
                        phase: 'INTAKE',
                        updatedAt: Date.now(),
                    }
                    : prev,
            );

            setPhase('INTAKE');
            setComposerSubmitted(true);

            // Generate initial nodes using real AI via SSE stream
            // (useTensionProbe automatically updates Recoil state with nodes)
            console.log('[useDecisionSession] Generating questions via useTensionProbe...');

            setTimeout(async () => {
                try {
                    // Call the real AI question generation
                    await generateInitialTensionPoints(message);

                    setPhase('EXPLORING');
                    setSession((prev) =>
                        prev
                            ? {
                                ...prev,
                                phase: 'EXPLORING',
                                updatedAt: Date.now(),
                            }
                            : prev,
                    );
                    console.log('[useDecisionSession] Questions generated, entering EXPLORING phase');
                } catch (err) {
                    console.error('[useDecisionSession] Failed to generate questions:', err);
                    // Fallback to hardcoded questions if SSE fails
                    const fallbackNodes = generateInitialNodes(draft);
                    setNodes(fallbackNodes);
                    setPhase('EXPLORING');
                }
            }, 600); // Wait for composer animation
        },
        [phase, setSession, setPhase, setComposerSubmitted, generateInitialTensionPoints, generateInitialNodes, setNodes],
    );

    /**
     * Handle SELECT_NODE event
     */
    const selectNode = useCallback(
        (nodeId: string) => {
            const node = nodes.find((n) => n.id === nodeId);
            if (!node || node.state === 'MERGED' || node.state === 'DISSOLVED') return;

            // Update node state to PROBING
            setNodes((prev) =>
                prev.map((n) => ({
                    ...n,
                    state: n.id === nodeId ? 'PROBING' : (n.state === 'PROBING' ? 'LATENT' : n.state),
                })),
            );

            setActiveNodeId(nodeId);
            startTracking(); // Start tracking response behavior for this probe
        },
        [nodes, setNodes, setActiveNodeId, startTracking],
    );

    /**
     * Handle ANSWER_QUESTION event
     */
    const answerQuestion = useCallback(
        (nodeId: string, answer: string) => {
            const node = nodes.find((n) => n.id === nodeId);
            if (!node) return;

            // Update node with answer and mark as RESOLVED
            setNodes((prev) =>
                prev.map((n) =>
                    n.id === nodeId
                        ? {
                            ...n,
                            answer,
                            state: 'RESOLVED',
                            resolvedAt: Date.now(),
                        }
                        : n,
                ),
            );

            // Add milestone based on topic
            if (node.topicKey === 'reality') {
                addMilestone('constraint_identified', answer.slice(0, 50), nodeId);
            } else if (node.topicKey === 'values') {
                addMilestone('insight_formed', answer.slice(0, 50), nodeId);
            }

            // Clear active node
            setActiveNodeId(null);

            // Check for convergence after a delay (let state update)
            setTimeout(() => {
                checkAndTriggerConvergence();
            }, CONVERGENCE.CONVERGENCE_CHECK_DELAY);
        },
        [nodes, setNodes, setActiveNodeId, addMilestone],
    );

    /**
     * Check if session should converge and trigger soft confirmation
     */
    const checkAndTriggerConvergence = useCallback(() => {
        // Use external convergence logic which checks loops, resolved nodes, and behavior
        const canConverge = checkConvergence();

        if (canConverge && !softConfirmation) {
            const statement = generateConfirmationStatement();
            setSoftConfirmation({
                statement,
                shownAt: Date.now()
            });
            console.log('[useDecisionSession] Triggering Soft Confirmation');
        }
    }, [checkConvergence, generateConfirmationStatement, softConfirmation, setSoftConfirmation]);

    /**
     * Handle TRIGGER_MERGE event
     */
    const triggerMerge = useCallback(
        (nodeIds: [string, string], insightText: string) => {
            const [id1, id2] = nodeIds;

            // Mark nodes as merged
            setNodes((prev) =>
                prev.map((n) =>
                    n.id === id1 || n.id === id2
                        ? {
                            ...n,
                            state: 'MERGED',
                            mergedIntoId: id1, // First node is the "winner"
                        }
                        : n,
                ),
            );

            // Add merged insight
            setSession((prev) =>
                prev
                    ? {
                        ...prev,
                        insights: [...prev.insights, insightText],
                        updatedAt: Date.now(),
                    }
                    : prev,
            );

            // Add milestone
            addMilestone('nodes_merged', insightText);

            // Check if we should transition to SETTLING
            const resolvedCount = nodes.filter(
                (n) => n.state === 'RESOLVED' || n.state === 'MERGED',
            ).length;
            if (resolvedCount >= 2) {
                setPhase('SETTLING');
                setSession((prev) =>
                    prev
                        ? {
                            ...prev,
                            phase: 'SETTLING',
                            updatedAt: Date.now(),
                        }
                        : prev,
                );
            }
        },
        [nodes, setNodes, setSession, setPhase, addMilestone],
    );

    /**
     * Handle UPDATE_LEANING event
     */
    const updateLeaning = useCallback(
        (newLeaning: LeaningVector) => {
            // Apply damping - max 12% shift per update
            setLeaning((prev) => {
                if (!prev) return newLeaning;

                const maxShift = 0.12;
                const rawShift = newLeaning.confidence - prev.confidence;
                const dampedShift = Math.sign(rawShift) * Math.min(Math.abs(rawShift), maxShift);

                return {
                    direction: newLeaning.direction,
                    confidence: Math.max(0, Math.min(1, prev.confidence + dampedShift)),
                };
            });

            addMilestone('leaning_shifted', newLeaning.direction);
        },
        [setLeaning, addMilestone],
    );

    /**
     * Handle END_SESSION event
     */
    const endSession = useCallback(
        (endingState: 'clarity' | 'conditional_clarity' | 'rest') => {
            setPhase('SILENT');
            setFieldSettling(true);
            setSessionEndingState(endingState);

            setSession((prev) =>
                prev
                    ? {
                        ...prev,
                        phase: 'SILENT',
                        endingState,
                        updatedAt: Date.now(),
                    }
                    : prev,
            );
        },
        [setPhase, setFieldSettling, setSessionEndingState, setSession],
    );

    /**
     * Dispatch a session event
     */
    const dispatch = useCallback(
        (event: SessionEvent) => {
            switch (event.type) {
                case 'SUBMIT_DECISION':
                    submitDecision(event.message);
                    break;
                case 'SELECT_NODE':
                    selectNode(event.nodeId);
                    break;
                case 'ANSWER_QUESTION':
                    answerQuestion(event.nodeId, event.answer);
                    break;
                case 'TRIGGER_MERGE':
                    triggerMerge(event.nodeIds, event.insightText);
                    break;
                case 'UPDATE_LEANING':
                    updateLeaning(event.leaning);
                    break;
                case 'END_SESSION':
                    endSession(event.endingState);
                    break;
                default:
                    console.warn('[useDecisionSession] Unknown event type:', event);
            }
        },
        [submitDecision, selectNode, answerQuestion, triggerMerge, updateLeaning, endSession],
    );

    return {
        // State
        session,
        phase,
        nodes,
        activeNodeId,
        milestones,
        leaning,

        // Actions
        initSession,
        dispatch,
        submitDecision,
        selectNode,
        answerQuestion,
        triggerMerge,
        updateLeaning,
        endSession,
        addMilestone,
        reopenSession: () => setPhase('EXPLORING'),
    };
}

export default useDecisionSession;
