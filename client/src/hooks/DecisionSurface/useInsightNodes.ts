/**
 * OptimismAI - useInsightNodes Hook
 * Manages AI-generated insight nodes that surface relevant resources
 * 
 * Monitors the conversation and triggers insight generation when:
 * - User answers a question with uncertainty
 * - AI detects knowledge gaps
 * - External information would help the decision
 */

import { useCallback, useRef } from 'react';
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil';
import { v4 as uuidv4 } from 'uuid';
import store from '~/store';
import type { InsightNodeData, Position } from '~/common/DecisionSession.types';
import { getSpawnPositionWithCollisionAvoidance } from '~/components/DecisionSurface/nodeMotionConfig';

// Minimum time between insight checks (30 seconds)
const INSIGHT_COOLDOWN_MS = 30000;

// SSE endpoint for insight generation
const INSIGHT_STREAM_ENDPOINT = '/api/decision/stream';

/**
 * Hook for managing AI insight nodes
 */
export function useInsightNodes() {
    const [insightNodes, setInsightNodes] = useRecoilState(store.insightNodesAtom);
    const session = useRecoilValue(store.decisionSessionAtom);
    const thoughtNodes = useRecoilValue(store.thoughtNodesAtom);
    const anchorPosition = useRecoilValue(store.anchorPositionAtom);

    // Track last insight check time
    const lastInsightCheck = useRef<number>(0);

    // Track pending insight request
    const pendingRequest = useRef<AbortController | null>(null);

    /**
     * Calculate spawn position for an insight node
     * Places it near the linked question or in a free area
     */
    const calculateInsightPosition = useCallback((linkedQuestionId?: string): Position => {
        // Try to position near the linked question
        if (linkedQuestionId) {
            const linkedNode = thoughtNodes.find(n => n.id === linkedQuestionId);
            if (linkedNode) {
                // Position slightly offset from the question node
                const offsetX = 200; // Offset to the right
                const offsetY = -50; // Slightly above

                const existingPositions = [
                    ...thoughtNodes.map(n => n.position),
                    ...insightNodes.map(n => n.position),
                ];

                return getSpawnPositionWithCollisionAvoidance(
                    0,
                    linkedNode.position.x + offsetX,
                    linkedNode.position.y + offsetY,
                    1,
                    existingPositions
                );
            }
        }

        // Fallback: position in a free area
        const existingPositions = [
            ...thoughtNodes.map(n => n.position),
            ...insightNodes.map(n => n.position),
        ];

        return getSpawnPositionWithCollisionAvoidance(
            insightNodes.length,
            anchorPosition.x + 300, // Offset from center
            anchorPosition.y - 100,
            1,
            existingPositions
        );
    }, [thoughtNodes, insightNodes, anchorPosition]);

    /**
     * Add a new insight node
     */
    const addInsightNode = useCallback((insightData: {
        title: string;
        summary: string;
        relevance: string;
        sourceUrl?: string;
        sourceName?: string;
        linkedQuestionId?: string;
    }) => {
        const position = calculateInsightPosition(insightData.linkedQuestionId);

        const newNode: InsightNodeData = {
            id: uuidv4(),
            type: 'insight',
            title: insightData.title,
            summary: insightData.summary,
            relevance: insightData.relevance,
            sourceUrl: insightData.sourceUrl,
            sourceName: insightData.sourceName,
            linkedQuestionIds: insightData.linkedQuestionId ? [insightData.linkedQuestionId] : [],
            createdAt: Date.now(),
            position,
            isExpanded: false,
            state: 'appearing',
        };

        setInsightNodes(prev => [...prev, newNode]);

        // Transition to visible after animation
        setTimeout(() => {
            setInsightNodes(prev =>
                prev.map(n =>
                    n.id === newNode.id ? { ...n, state: 'visible' as const } : n
                )
            );
        }, 500);

        return newNode.id;
    }, [calculateInsightPosition, setInsightNodes]);

    /**
     * Toggle insight node expansion
     */
    const toggleInsightExpanded = useCallback((nodeId: string) => {
        setInsightNodes(prev =>
            prev.map(n =>
                n.id === nodeId ? { ...n, isExpanded: !n.isExpanded } : n
            )
        );
    }, [setInsightNodes]);

    /**
     * Dismiss an insight node
     */
    const dismissInsight = useCallback((nodeId: string) => {
        setInsightNodes(prev =>
            prev.map(n =>
                n.id === nodeId ? { ...n, state: 'dismissed' as const } : n
            )
        );

        // Remove after animation
        setTimeout(() => {
            setInsightNodes(prev => prev.filter(n => n.id !== nodeId));
        }, 300);
    }, [setInsightNodes]);

    /**
     * Update insight node position (after drag)
     */
    const updateInsightPosition = useCallback((nodeId: string, position: Position) => {
        setInsightNodes(prev =>
            prev.map(n =>
                n.id === nodeId ? { ...n, position } : n
            )
        );
    }, [setInsightNodes]);

    /**
     * Check for insights after an answer is submitted
     * Uses SSE stream to call the InsightAgent backend
     */
    const checkForInsights = useCallback(async (
        questionId: string,
        question: string,
        answer: string
    ) => {
        // Rate limiting
        const now = Date.now();
        if (now - lastInsightCheck.current < INSIGHT_COOLDOWN_MS) {
            console.log('[useInsightNodes] Cooldown active, skipping insight check');
            return;
        }

        if (!session?.draft?.statement) {
            console.log('[useInsightNodes] No session statement, skipping insight check');
            return;
        }

        // Cancel any pending request
        if (pendingRequest.current) {
            pendingRequest.current.abort();
        }

        lastInsightCheck.current = now;

        // Build Q&A history from thought nodes
        const qaHistory = thoughtNodes
            .filter(n => n.state === 'RESOLVED' && n.answer)
            .map(n => ({
                id: n.id,
                question: n.question,
                answer: n.answer || '',
            }));

        // Add current answer
        qaHistory.push({
            id: questionId,
            question,
            answer,
        });

        try {
            const controller = new AbortController();
            pendingRequest.current = controller;

            console.log('[useInsightNodes] Checking for insights...');

            const response = await fetch(INSIGHT_STREAM_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'analyze_context',
                    payload: {
                        decisionStatement: session.draft.statement,
                        qaHistory,
                        currentQuestionId: questionId,
                    },
                }),
                signal: controller.signal,
            });

            if (!response.ok) {
                throw new Error(`Insight check failed: ${response.status}`);
            }

            // Handle SSE stream
            const reader = response.body?.getReader();
            if (!reader) return;

            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));

                            if (data.type === 'insight' && data.insight) {
                                console.log('[useInsightNodes] Received insight:', data.insight.title);
                                addInsightNode({
                                    title: data.insight.title,
                                    summary: data.insight.summary,
                                    relevance: data.insight.relevance,
                                    sourceUrl: data.insight.sourceUrl,
                                    sourceName: data.insight.sourceName,
                                    linkedQuestionId: data.insight.linkedQuestionId,
                                });
                            }
                        } catch (parseError) {
                            console.warn('[useInsightNodes] Failed to parse SSE data:', parseError);
                        }
                    }
                }
            }
        } catch (error) {
            if ((error as Error).name === 'AbortError') {
                console.log('[useInsightNodes] Request aborted');
            } else {
                console.error('[useInsightNodes] Insight check error:', error);
            }
        } finally {
            pendingRequest.current = null;
        }
    }, [session, thoughtNodes, addInsightNode]);

    /**
     * Clear all insight nodes (for new session)
     */
    const clearInsights = useCallback(() => {
        setInsightNodes([]);
        lastInsightCheck.current = 0;
        if (pendingRequest.current) {
            pendingRequest.current.abort();
            pendingRequest.current = null;
        }
    }, [setInsightNodes]);

    /**
     * Add a mock insight for testing
     */
    const addMockInsight = useCallback((linkedQuestionId?: string) => {
        return addInsightNode({
            title: '📊 Average decision timeline',
            summary: 'Research shows most career decisions take 2-4 weeks of active consideration. Rushing often leads to regret, but excessive deliberation can create analysis paralysis.',
            relevance: 'This helps calibrate your timeline expectations for this decision.',
            sourceName: 'Harvard Business Review',
            sourceUrl: 'https://hbr.org/example',
            linkedQuestionId,
        });
    }, [addInsightNode]);

    return {
        // State
        insightNodes,
        visibleInsightNodes: insightNodes.filter(n => n.state !== 'dismissed'),

        // Actions
        addInsightNode,
        toggleInsightExpanded,
        dismissInsight,
        updateInsightPosition,
        checkForInsights,
        clearInsights,
        addMockInsight,
    };
}

export default useInsightNodes;
