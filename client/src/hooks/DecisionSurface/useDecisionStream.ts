/**
 * OptimismAI - Living Decision Surface
 * useDecisionStream - SSE connection to the decision stream endpoint
 *
 * Establishes and manages an SSE connection for real-time AI-powered
 * question generation and answer processing.
 */

import { useCallback, useRef, useState } from 'react';
import { useSetRecoilState, useRecoilValue } from 'recoil';
import { v4 as uuidv4 } from 'uuid';
import store from '~/store';
import { useAuthContext } from '~/hooks/AuthContext';
import { getSpawnPosition } from '~/components/DecisionSurface/nodeMotionConfig';
import type {
    ThoughtNodeData,
    SatelliteNodeData,
    TopicKey,
    QuestionCategory,
    ExpectedInfoType,
    NodeSignal,
    ClarityAssessment,
} from '~/common/DecisionSession.types';

// ============================================================================
// Types
// ============================================================================

interface NodeUpdateEvent {
    type: 'decision_node_update';
    nodeId: string;
    action: 'created' | 'processing' | 'resolved' | 'satellite_spawned';
    progress?: number;
    index?: number;
    question?: string;
    category?: TopicKey;
    expectedType?: ExpectedInfoType;
    signals?: NodeSignal[];
    satellite?: SatelliteNodeData;
    informationGain?: number;
}

interface SessionUpdateEvent {
    type: 'decision_session_update';
    sessionId: string;
    status?: 'generating' | 'ready' | 'updated';
    progress?: number;
    domain?: string;
    uncertainty?: number;
    emotionDetected?: string;
    nodeCount?: number;
    constraints?: string[];
    options?: string[];
    assumptions?: { text: string; needsTesting: boolean }[];
}

interface MergeSuggestionEvent {
    type: 'decision_merge_suggestion';
    node1Id: string;
    node2Id: string;
    reason: string;
    insightText: string;
    confidence: number;
}

interface ErrorEvent {
    type: 'decision_error';
    error: string;
}

interface ClarityAssessmentEvent {
    type: 'decision_clarity_assessment';
    nodeId: string;
    assessment: ClarityAssessment;
    clarityAchieved: boolean;
    specificityTrend: 'increasing' | 'stable' | 'decreasing';
}

interface NextQuestionEvent {
    type: 'decision_next_question';
    nodeId: string;
    action: 'spawned';
    question: string;
    category: TopicKey;
    expectedType: ExpectedInfoType;
    reasoning?: string;
}

type SSEEvent =
    | NodeUpdateEvent
    | SessionUpdateEvent
    | MergeSuggestionEvent
    | ClarityAssessmentEvent
    | NextQuestionEvent
    | ErrorEvent;

// ============================================================================
// Hook
// ============================================================================

export function useDecisionStream() {
    const [isStreaming, setIsStreaming] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    // Auth context for JWT token
    const { token } = useAuthContext();

    // Recoil state
    const anchorPosition = useRecoilValue(store.anchorPositionAtom);
    const setThoughtNodes = useSetRecoilState(store.thoughtNodesAtom);
    const setSession = useSetRecoilState(store.decisionSessionAtom);
    const thoughtNodes = useRecoilValue(store.thoughtNodesAtom);
    const session = useRecoilValue(store.decisionSessionAtom);

    /**
     * Helper to get category from topic
     */
    const getCategoryFromTopic = (topic: TopicKey): QuestionCategory => {
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
    };

    /**
     * Parse SSE data from a line
     */
    const parseSSELine = (line: string): SSEEvent | null => {
        if (!line.startsWith('data: ')) return null;
        try {
            return JSON.parse(line.slice(6));
        } catch {
            console.warn('[useDecisionStream] Failed to parse SSE:', line);
            return null;
        }
    };

    /**
     * Stream request to the decision API
     */
    const streamRequest = useCallback(
        async (
            action: 'generate' | 'answer' | 'merge',
            payload: Record<string, unknown>,
            onEvent: (event: SSEEvent) => void,
        ): Promise<void> => {
            setIsStreaming(true);
            setError(null);

            // Abort any existing request
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
            abortControllerRef.current = new AbortController();

            // Debug: Log token availability
            console.log('[useDecisionStream] Token available:', !!token, token ? `${token.substring(0, 20)}...` : 'undefined');

            try {
                const response = await fetch('/api/decision/stream', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                    },
                    body: JSON.stringify({ action, payload }),
                    signal: abortControllerRef.current.signal,
                    credentials: 'include',
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const reader = response.body?.getReader();
                if (!reader) {
                    throw new Error('No response body');
                }

                const decoder = new TextDecoder();
                let buffer = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        const event = parseSSELine(line.trim());
                        if (event) {
                            onEvent(event);
                        }
                    }
                }

                // Process any remaining buffer
                if (buffer.trim()) {
                    const event = parseSSELine(buffer.trim());
                    if (event) {
                        onEvent(event);
                    }
                }
            } catch (err) {
                if ((err as Error).name === 'AbortError') {
                    console.log('[useDecisionStream] Request aborted');
                } else {
                    const message = err instanceof Error ? err.message : 'Stream failed';
                    setError(message);
                    console.error('[useDecisionStream] Error:', err);
                }
            } finally {
                setIsStreaming(false);
            }
        },
        [token],
    );

    /**
     * Generate initial questions from a decision statement
     */
    const generateQuestions = useCallback(
        async (statement: string): Promise<ThoughtNodeData[]> => {
            const nodes: ThoughtNodeData[] = [];
            const now = Date.now();

            await streamRequest('generate', { statement }, (event) => {
                if (event.type === 'decision_error') {
                    setError(event.error);
                    return;
                }

                if (event.type === 'decision_node_update' && event.action === 'created') {
                    const nodeEvent = event as NodeUpdateEvent;
                    const index = nodeEvent.index ?? nodes.length;

                    const node: ThoughtNodeData = {
                        id: nodeEvent.nodeId,
                        state: 'DORMANT',
                        question: nodeEvent.question || '',
                        topicKey: nodeEvent.category || 'reality',
                        category: getCategoryFromTopic(nodeEvent.category || 'reality'),
                        expectedInfoType: nodeEvent.expectedType || 'fact',
                        position: getSpawnPosition(index, anchorPosition.x, anchorPosition.y),
                        satellites: [],
                        signals: [],
                        createdAt: now + index * 70,
                    };

                    nodes.push(node);
                    setThoughtNodes((prev) => [...prev.filter((n) => n.id !== node.id), node]);
                }

                if (event.type === 'decision_session_update' && event.status === 'ready') {
                    const sessionEvent = event as SessionUpdateEvent;
                    setSession((prev) =>
                        prev
                            ? {
                                ...prev,
                                draft: {
                                    statement,
                                    domain: sessionEvent.domain || 'other',
                                    uncertaintyEstimate: sessionEvent.uncertainty || 0.5,
                                    emotionEstimate: sessionEvent.emotionDetected || 'neutral',
                                },
                                updatedAt: Date.now(),
                            }
                            : prev,
                    );
                }
            });

            return nodes;
        },
        [anchorPosition, setThoughtNodes, setSession, streamRequest],
    );

    /**
     * Process an answer to a question
     */
    const processAnswer = useCallback(
        async (nodeId: string, answer: string): Promise<void> => {
            // Build session context to send with the request
            const sessionContext = {
                statement: session?.draft?.statement || '',
                nodes: thoughtNodes.map((n) => ({
                    id: n.id,
                    question: n.question,
                    answer: n.answer,
                    category: n.topicKey,
                })),
                constraints: session?.constraints || [],
                options: session?.options.map((o) => o.text) || [],
            };

            await streamRequest('answer', { nodeId, answer, sessionContext }, (event) => {
                if (event.type === 'decision_error') {
                    setError(event.error);
                    return;
                }

                if (event.type === 'decision_node_update') {
                    const nodeEvent = event as NodeUpdateEvent;

                    if (nodeEvent.action === 'resolved') {
                        setThoughtNodes((prev) =>
                            prev.map((node) => {
                                if (node.id !== nodeId) return node;
                                return {
                                    ...node,
                                    answer,
                                    state: 'RESOLVED' as const,
                                    resolvedAt: Date.now(),
                                    signals: [...node.signals, ...(nodeEvent.signals || [])],
                                };
                            }),
                        );
                    }

                    if (nodeEvent.action === 'satellite_spawned' && nodeEvent.satellite) {
                        const parentNode = thoughtNodes.find((n) => n.id === nodeId);
                        if (parentNode) {
                            const satelliteAngle = Math.random() * 360;
                            const satelliteRadius = 70;

                            const satellite: SatelliteNodeData = {
                                id: nodeEvent.satellite.id || uuidv4(),
                                parentId: nodeId,
                                question: nodeEvent.satellite.question,
                                position: {
                                    x:
                                        parentNode.position.x +
                                        satelliteRadius * Math.cos((satelliteAngle * Math.PI) / 180),
                                    y:
                                        parentNode.position.y +
                                        satelliteRadius * Math.sin((satelliteAngle * Math.PI) / 180),
                                },
                                answered: false,
                                createdAt: Date.now(),
                            };

                            setThoughtNodes((prev) =>
                                prev.map((node) => {
                                    if (node.id !== nodeId) return node;
                                    return {
                                        ...node,
                                        satellites: [...node.satellites, satellite],
                                    };
                                }),
                            );
                        }
                    }
                }

                if (event.type === 'decision_session_update') {
                    const sessionEvent = event as SessionUpdateEvent;
                    setSession((prev) => {
                        if (!prev) return prev;
                        return {
                            ...prev,
                            constraints: sessionEvent.constraints || prev.constraints,
                            options: [
                                ...prev.options,
                                ...(sessionEvent.options || []).map((opt) => ({
                                    id: uuidv4(),
                                    text: opt,
                                    eliminated: false,
                                })),
                            ],
                            assumptions: [
                                ...prev.assumptions,
                                ...(sessionEvent.assumptions || []).map((a) => ({
                                    id: uuidv4(),
                                    text: a.text,
                                    resolved: !a.needsTesting,
                                })),
                            ],
                            updatedAt: Date.now(),
                        };
                    });
                }
            });
        },
        [session, thoughtNodes, streamRequest, setThoughtNodes, setSession],
    );

    /**
     * Check if two nodes should merge
     */
    const detectMerge = useCallback(
        async (nodeId1: string, nodeId2: string): Promise<{ shouldMerge: boolean; insightText?: string } | null> => {
            let result: { shouldMerge: boolean; insightText?: string } | null = null;

            const sessionContext = {
                nodes: thoughtNodes
                    .filter((n) => n.id === nodeId1 || n.id === nodeId2)
                    .map((n) => ({
                        id: n.id,
                        question: n.question,
                        answer: n.answer,
                    })),
            };

            await streamRequest('merge', { nodeId1, nodeId2, sessionContext }, (event) => {
                if (event.type === 'decision_merge_suggestion') {
                    const mergeEvent = event as MergeSuggestionEvent;
                    result = {
                        shouldMerge: true,
                        insightText: mergeEvent.insightText,
                    };
                }
            });

            return result;
        },
        [thoughtNodes, streamRequest],
    );

    /**
     * Process an answer with clarity assessment
     * This is the new flow that:
     * 1. Assesses answer quality with a dedicated LLM agent
     * 2. Determines if/what follow-up question is needed
     * 3. Spawns new nodes based on assessment recommendation
     */
    const assessAndRespond = useCallback(
        async (nodeId: string, answer: string): Promise<{
            assessment: ClarityAssessment | null;
            clarityAchieved: boolean;
            newNodeId?: string;
        }> => {
            let result = {
                assessment: null as ClarityAssessment | null,
                clarityAchieved: false,
                newNodeId: undefined as string | undefined,
            };

            const sessionContext = {
                statement: session?.draft?.statement || '',
                nodes: thoughtNodes.map((n) => ({
                    id: n.id,
                    question: n.question,
                    answer: n.answer,
                    category: n.topicKey,
                })),
            };

            await streamRequest('assess', { nodeId, answer, sessionContext }, (event) => {
                if (event.type === 'decision_error') {
                    setError(event.error);
                    return;
                }

                // Handle clarity assessment event
                if (event.type === 'decision_clarity_assessment') {
                    const assessEvent = event as ClarityAssessmentEvent;
                    result.assessment = assessEvent.assessment;
                    result.clarityAchieved = assessEvent.clarityAchieved;

                    // Update node state to RESOLVED
                    setThoughtNodes((prev) =>
                        prev.map((node) => {
                            if (node.id !== nodeId) return node;
                            return {
                                ...node,
                                answer,
                                state: 'RESOLVED' as const,
                                resolvedAt: Date.now(),
                            };
                        }),
                    );

                    console.log('[useDecisionStream] Clarity assessment received:', {
                        recommendation: assessEvent.assessment.recommendation,
                        specificity: assessEvent.assessment.specificity,
                        clarityAchieved: assessEvent.clarityAchieved,
                    });
                }

                // Handle new question spawned from assessment
                if (event.type === 'decision_next_question') {
                    const nextEvent = event as NextQuestionEvent;
                    result.newNodeId = nextEvent.nodeId;

                    // Find a good spawn position
                    const existingNodes = thoughtNodes.length;
                    const spawnIndex = existingNodes + 1;

                    const newNode: ThoughtNodeData = {
                        id: nextEvent.nodeId,
                        state: 'LATENT' as const,
                        question: nextEvent.question,
                        topicKey: nextEvent.category,
                        category: getCategoryFromTopic(nextEvent.category),
                        expectedInfoType: nextEvent.expectedType,
                        position: getSpawnPosition(
                            spawnIndex,
                            anchorPosition.x,
                            anchorPosition.y,
                            6
                        ),
                        satellites: [],
                        signals: [],
                        source: 'assessment' as const,
                        createdAt: Date.now(),
                    };

                    setThoughtNodes((prev) => [...prev, newNode]);

                    console.log('[useDecisionStream] New question spawned:', {
                        nodeId: nextEvent.nodeId,
                        category: nextEvent.category,
                        reasoning: nextEvent.reasoning,
                    });
                }

                // Handle session update for clarity achieved
                if (event.type === 'decision_session_update') {
                    const sessionEvent = event as SessionUpdateEvent;
                    if (sessionEvent.status === 'clarity_achieved') {
                        setSession((prev) => {
                            if (!prev) return prev;
                            return {
                                ...prev,
                                phase: 'SETTLING' as const,
                                updatedAt: Date.now(),
                            };
                        });
                    }
                }
            });

            return result;
        },
        [session, thoughtNodes, anchorPosition, streamRequest, setThoughtNodes, setSession],
    );

    /**
     * Abort ongoing stream
     */
    const abort = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
    }, []);

    return {
        isStreaming,
        error,
        generateQuestions,
        processAnswer,
        assessAndRespond,
        detectMerge,
        abort,
    };
}

export default useDecisionStream;
