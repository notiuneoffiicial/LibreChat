/**
 * OptimismAI - Resource Connections
 * SVG overlay for visual connections between resource nodes and question nodes
 */

import { memo, useMemo, useContext } from 'react';
import { useRecoilValue } from 'recoil';
import { ThemeContext, isDark } from '@librechat/client';
import store from '~/store';

interface ResourceConnectionsProps {
    containerWidth: number;
    containerHeight: number;
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
    const explicitConnections = useRecoilValue(store.resourceConnectionsAtom);

    // Calculate proximity-based connections
    const connections = useMemo(() => {
        const result: Array<{
            id: string;
            x1: number;
            y1: number;
            x2: number;
            y2: number;
            type: 'memory' | 'file';
        }> = [];

        const proximityThreshold = 200; // pixels

        // Check memory nodes
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

        // Check file nodes
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

        return result;
    }, [memoryNodes, fileNodes, thoughtNodes, explicitConnections]);

    // Don't render if no connections
    if (connections.length === 0) return null;

    return (
        <svg
            className="absolute inset-0 pointer-events-none z-10"
            width={containerWidth}
            height={containerHeight}
        >
            <defs>
                {/* Gradient for memory connections */}
                <linearGradient id="memoryConnectionGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop
                        offset="0%"
                        stopColor={isCurrentlyDark ? 'rgba(129, 140, 248, 0.4)' : 'rgba(99, 102, 241, 0.3)'}
                    />
                    <stop
                        offset="100%"
                        stopColor={isCurrentlyDark ? 'rgba(129, 140, 248, 0.1)' : 'rgba(99, 102, 241, 0.1)'}
                    />
                </linearGradient>
                {/* Gradient for file connections */}
                <linearGradient id="fileConnectionGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop
                        offset="0%"
                        stopColor={isCurrentlyDark ? 'rgba(52, 211, 153, 0.4)' : 'rgba(16, 185, 129, 0.3)'}
                    />
                    <stop
                        offset="100%"
                        stopColor={isCurrentlyDark ? 'rgba(52, 211, 153, 0.1)' : 'rgba(16, 185, 129, 0.1)'}
                    />
                </linearGradient>
            </defs>

            {connections.map((conn) => (
                <path
                    key={conn.id}
                    d={generateCurvePath(conn.x1, conn.y1, conn.x2, conn.y2)}
                    stroke={`url(#${conn.type === 'memory' ? 'memoryConnectionGradient' : 'fileConnectionGradient'})`}
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    fill="none"
                    opacity={0.6}
                />
            ))}
        </svg>
    );
}

export default memo(ResourceConnections);
