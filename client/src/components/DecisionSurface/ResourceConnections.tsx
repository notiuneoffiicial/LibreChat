/**
 * OptimismAI - Resource Connections
 * SVG overlay for visual connections between resource nodes and question nodes
 * 
 * Supports:
 * - Memory nodes ↔ Question nodes (proximity-based, indigo)
 * - File nodes ↔ Question nodes (proximity-based, emerald)
 * - Insight nodes → Question nodes (explicit linkedQuestionIds, purple)
 * - Context nodes → Question nodes (explicit linkedQuestionIds, amber)
 */

import { memo, useMemo, useContext } from 'react';
import { useRecoilValue } from 'recoil';
import { ThemeContext, isDark } from '@librechat/client';
import store from '~/store';

interface ResourceConnectionsProps {
    containerWidth: number;
    containerHeight: number;
}

type ConnectionType = 'memory' | 'file' | 'insight' | 'context';

interface Connection {
    id: string;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    type: ConnectionType;
}

/**
 * Calculate distance between two points
 */
function distance(x1: number, y1: number, x2: number, y2: number): number {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

/**
 * Generate SVG path for a curved connection line
 */
function generateCurvePath(x1: number, y1: number, x2: number, y2: number): string {
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;

    // Add slight curve offset based on distance
    const dist = distance(x1, y1, x2, y2);
    const curveOffset = Math.min(dist * 0.1, 30);

    // Control point offset perpendicular to line
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;

    const cpX = midX - (dy / len) * curveOffset;
    const cpY = midY + (dx / len) * curveOffset;

    return `M ${x1} ${y1} Q ${cpX} ${cpY} ${x2} ${y2}`;
}

/**
 * ResourceConnections - Visual connection lines between resource and question nodes
 */
function ResourceConnections({ containerWidth, containerHeight }: ResourceConnectionsProps) {
    // Theme
    const { theme } = useContext(ThemeContext);
    const isCurrentlyDark = isDark(theme);

    // Get all node positions
    const memoryNodes = useRecoilValue(store.memoryNodesAtom);
    const fileNodes = useRecoilValue(store.fileNodesAtom);
    const thoughtNodes = useRecoilValue(store.thoughtNodesAtom);
    const insightNodes = useRecoilValue(store.insightNodesAtom);
    const contextNodes = useRecoilValue(store.contextNodesAtom);
    const explicitConnections = useRecoilValue(store.resourceConnectionsAtom);

    // Calculate all connections
    const connections = useMemo(() => {
        const result: Connection[] = [];

        const proximityThreshold = 200; // pixels

        // 1. Memory nodes - proximity-based
        memoryNodes.forEach((memNode) => {
            thoughtNodes.forEach((thoughtNode) => {
                const dist = distance(
                    memNode.position.x,
                    memNode.position.y,
                    thoughtNode.position?.x || 0,
                    thoughtNode.position?.y || 0
                );
                if (dist < proximityThreshold && dist > 50) {
                    result.push({
                        id: `mem-${memNode.id}-thought-${thoughtNode.id}`,
                        x1: memNode.position.x,
                        y1: memNode.position.y,
                        x2: thoughtNode.position?.x || 0,
                        y2: thoughtNode.position?.y || 0,
                        type: 'memory',
                    });
                }
            });
        });

        // 2. File nodes - proximity-based
        fileNodes.forEach((fileNode) => {
            thoughtNodes.forEach((thoughtNode) => {
                const dist = distance(
                    fileNode.position.x,
                    fileNode.position.y,
                    thoughtNode.position?.x || 0,
                    thoughtNode.position?.y || 0
                );
                if (dist < proximityThreshold && dist > 50) {
                    result.push({
                        id: `file-${fileNode.id}-thought-${thoughtNode.id}`,
                        x1: fileNode.position.x,
                        y1: fileNode.position.y,
                        x2: thoughtNode.position?.x || 0,
                        y2: thoughtNode.position?.y || 0,
                        type: 'file',
                    });
                }
            });
        });

        // 3. Insight nodes - explicit linkedQuestionIds
        insightNodes.forEach((insightNode) => {
            if (insightNode.state === 'dismissed') return;

            insightNode.linkedQuestionIds.forEach((questionId) => {
                const linkedQuestion = thoughtNodes.find(n => n.id === questionId);
                if (linkedQuestion && linkedQuestion.position) {
                    result.push({
                        id: `insight-${insightNode.id}-thought-${questionId}`,
                        x1: insightNode.position.x + 110, // Center of insight card
                        y1: insightNode.position.y + 40,
                        x2: linkedQuestion.position.x,
                        y2: linkedQuestion.position.y,
                        type: 'insight',
                    });
                }
            });
        });

        // 4. Context nodes - explicit linkedQuestionIds
        contextNodes.forEach((contextNode) => {
            if (!contextNode.linkedQuestionIds) return;

            contextNode.linkedQuestionIds.forEach((questionId) => {
                const linkedQuestion = thoughtNodes.find(n => n.id === questionId);
                if (linkedQuestion && linkedQuestion.position) {
                    result.push({
                        id: `context-${contextNode.id}-thought-${questionId}`,
                        x1: contextNode.position.x + 100, // Center of context card
                        y1: contextNode.position.y + 30,
                        x2: linkedQuestion.position.x,
                        y2: linkedQuestion.position.y,
                        type: 'context',
                    });
                }
            });
        });

        return result;
    }, [memoryNodes, fileNodes, thoughtNodes, insightNodes, contextNodes, explicitConnections]);

    // Get gradient ID for connection type
    const getGradientId = (type: ConnectionType): string => {
        switch (type) {
            case 'memory': return 'memoryConnectionGradient';
            case 'file': return 'fileConnectionGradient';
            case 'insight': return 'insightConnectionGradient';
            case 'context': return 'contextConnectionGradient';
        }
    };

    // Get stroke style for connection type
    const getStrokeStyle = (type: ConnectionType) => {
        switch (type) {
            case 'insight':
                return { strokeDasharray: '8 4', strokeWidth: 2.5 };
            case 'context':
                return { strokeDasharray: '6 3', strokeWidth: 2 };
            default:
                return { strokeDasharray: '4 4', strokeWidth: 2 };
        }
    };

    // Don't render if no connections
    if (connections.length === 0) return null;

    return (
        <svg
            className="absolute inset-0 pointer-events-none z-10"
            width={containerWidth}
            height={containerHeight}
        >
            <defs>
                {/* Gradient for memory connections (indigo) */}
                <linearGradient id="memoryConnectionGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop
                        offset="0%"
                        stopColor={isCurrentlyDark ? 'rgba(129, 140, 248, 0.5)' : 'rgba(99, 102, 241, 0.4)'}
                    />
                    <stop
                        offset="100%"
                        stopColor={isCurrentlyDark ? 'rgba(129, 140, 248, 0.15)' : 'rgba(99, 102, 241, 0.1)'}
                    />
                </linearGradient>

                {/* Gradient for file connections (emerald) */}
                <linearGradient id="fileConnectionGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop
                        offset="0%"
                        stopColor={isCurrentlyDark ? 'rgba(52, 211, 153, 0.5)' : 'rgba(16, 185, 129, 0.4)'}
                    />
                    <stop
                        offset="100%"
                        stopColor={isCurrentlyDark ? 'rgba(52, 211, 153, 0.15)' : 'rgba(16, 185, 129, 0.1)'}
                    />
                </linearGradient>

                {/* Gradient for insight connections (purple) */}
                <linearGradient id="insightConnectionGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop
                        offset="0%"
                        stopColor={isCurrentlyDark ? 'rgba(168, 85, 247, 0.6)' : 'rgba(139, 92, 246, 0.5)'}
                    />
                    <stop
                        offset="100%"
                        stopColor={isCurrentlyDark ? 'rgba(168, 85, 247, 0.2)' : 'rgba(139, 92, 246, 0.15)'}
                    />
                </linearGradient>

                {/* Gradient for context connections (amber) */}
                <linearGradient id="contextConnectionGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop
                        offset="0%"
                        stopColor={isCurrentlyDark ? 'rgba(251, 191, 36, 0.6)' : 'rgba(217, 119, 6, 0.5)'}
                    />
                    <stop
                        offset="100%"
                        stopColor={isCurrentlyDark ? 'rgba(251, 191, 36, 0.2)' : 'rgba(217, 119, 6, 0.15)'}
                    />
                </linearGradient>
            </defs>

            {connections.map((conn) => {
                const style = getStrokeStyle(conn.type);
                return (
                    <path
                        key={conn.id}
                        d={generateCurvePath(conn.x1, conn.y1, conn.x2, conn.y2)}
                        stroke={`url(#${getGradientId(conn.type)})`}
                        strokeWidth={style.strokeWidth}
                        strokeDasharray={style.strokeDasharray}
                        fill="none"
                        opacity={0.7}
                    />
                );
            })}
        </svg>
    );
}

export default memo(ResourceConnections);
