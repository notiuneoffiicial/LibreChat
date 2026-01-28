/**
 * OptimismAI - useDragToConnect Hook
 * Manages the drag-to-connect interaction for linking nodes
 * 
 * Usage:
 * 1. Source node (e.g., ContextNode) calls startConnecting(sourceId, sourcePosition)
 * 2. While dragging, updateConnectionTarget(cursorPosition) updates the preview line
 * 3. On drop over target node, completeConnection(targetId) creates the link
 * 4. cancelConnection() aborts the connection attempt
 */

import { useCallback, useState } from 'react';
import { useSetRecoilState, useRecoilValue } from 'recoil';
import store from '~/store';
import type { Position } from '~/common/DecisionSession.types';

interface ConnectionState {
    isConnecting: boolean;
    sourceNodeId: string | null;
    sourceNodeType: 'context' | 'insight' | null;
    sourcePosition: Position | null;
    cursorPosition: Position | null;
    hoveredTargetId: string | null;
}

const initialState: ConnectionState = {
    isConnecting: false,
    sourceNodeId: null,
    sourceNodeType: null,
    sourcePosition: null,
    cursorPosition: null,
    hoveredTargetId: null,
};

/**
 * Hook for managing drag-to-connect interactions
 */
export function useDragToConnect() {
    const [state, setState] = useState<ConnectionState>(initialState);
    const setContextNodes = useSetRecoilState(store.contextNodesAtom);
    const setInsightNodes = useSetRecoilState(store.insightNodesAtom);
    const thoughtNodes = useRecoilValue(store.thoughtNodesAtom);

    /**
     * Start a connection drag from a source node
     */
    const startConnecting = useCallback((
        sourceId: string,
        sourceType: 'context' | 'insight',
        sourcePosition: Position
    ) => {
        console.log('[useDragToConnect] Starting connection from:', sourceId);
        setState({
            isConnecting: true,
            sourceNodeId: sourceId,
            sourceNodeType: sourceType,
            sourcePosition,
            cursorPosition: sourcePosition,
            hoveredTargetId: null,
        });
    }, []);

    /**
     * Update cursor position while dragging
     */
    const updateCursorPosition = useCallback((position: Position) => {
        setState(prev => ({
            ...prev,
            cursorPosition: position,
        }));
    }, []);

    /**
     * Set hovered target when cursor is over a question node
     */
    const setHoveredTarget = useCallback((targetId: string | null) => {
        setState(prev => ({
            ...prev,
            hoveredTargetId: targetId,
        }));
    }, []);

    /**
     * Check if a position is over a question node
     * Returns the node ID if over a valid target, null otherwise
     */
    const checkDropTarget = useCallback((position: Position): string | null => {
        const hitRadius = 60; // pixels

        for (const node of thoughtNodes) {
            if (!node.position) continue;

            const dx = position.x - node.position.x;
            const dy = position.y - node.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < hitRadius) {
                return node.id;
            }
        }

        return null;
    }, [thoughtNodes]);

    /**
     * Complete the connection by linking source to target
     */
    const completeConnection = useCallback((targetId: string) => {
        if (!state.sourceNodeId || !state.sourceNodeType) {
            console.log('[useDragToConnect] No source node, cannot complete');
            setState(initialState);
            return;
        }

        console.log('[useDragToConnect] Completing connection:', state.sourceNodeId, '->', targetId);

        if (state.sourceNodeType === 'context') {
            setContextNodes(prev => prev.map(node => {
                if (node.id === state.sourceNodeId) {
                    const existingLinks = node.linkedQuestionIds || [];
                    // Don't add duplicate
                    if (existingLinks.includes(targetId)) {
                        return node;
                    }
                    return {
                        ...node,
                        linkedQuestionIds: [...existingLinks, targetId],
                    };
                }
                return node;
            }));
        } else if (state.sourceNodeType === 'insight') {
            setInsightNodes(prev => prev.map(node => {
                if (node.id === state.sourceNodeId) {
                    const existingLinks = node.linkedQuestionIds || [];
                    if (existingLinks.includes(targetId)) {
                        return node;
                    }
                    return {
                        ...node,
                        linkedQuestionIds: [...existingLinks, targetId],
                    };
                }
                return node;
            }));
        }

        setState(initialState);
    }, [state.sourceNodeId, state.sourceNodeType, setContextNodes, setInsightNodes]);

    /**
     * Cancel the connection attempt
     */
    const cancelConnection = useCallback(() => {
        console.log('[useDragToConnect] Connection cancelled');
        setState(initialState);
    }, []);

    return {
        // State
        isConnecting: state.isConnecting,
        sourceNodeId: state.sourceNodeId,
        sourceNodeType: state.sourceNodeType,
        sourcePosition: state.sourcePosition,
        cursorPosition: state.cursorPosition,
        hoveredTargetId: state.hoveredTargetId,

        // Actions
        startConnecting,
        updateCursorPosition,
        setHoveredTarget,
        checkDropTarget,
        completeConnection,
        cancelConnection,
    };
}

export default useDragToConnect;
