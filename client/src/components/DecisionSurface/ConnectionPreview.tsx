/**
 * OptimismAI - ConnectionPreview
 * SVG overlay showing the drag-to-connect preview line
 * 
 * Displays a curved dashed line from source node to cursor
 * while user is dragging to create a connection
 */

import { memo, useContext } from 'react';
import { ThemeContext, isDark } from '@librechat/client';
import type { Position } from '~/common/DecisionSession.types';

interface ConnectionPreviewProps {
    isActive: boolean;
    sourcePosition: Position | null;
    cursorPosition: Position | null;
    sourceType: 'context' | 'insight' | null;
    containerWidth: number;
    containerHeight: number;
}

/**
 * Generate curved path between two points
 */
function generatePreviewPath(x1: number, y1: number, x2: number, y2: number): string {
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;

    // Calculate curve offset
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const curveOffset = Math.min(len * 0.15, 40);

    // Control point perpendicular to line
    const cpX = midX - (dy / len) * curveOffset;
    const cpY = midY + (dx / len) * curveOffset;

    return `M ${x1} ${y1} Q ${cpX} ${cpY} ${x2} ${y2}`;
}

/**
 * ConnectionPreview - Shows preview line while connecting
 */
function ConnectionPreview({
    isActive,
    sourcePosition,
    cursorPosition,
    sourceType,
    containerWidth,
    containerHeight,
}: ConnectionPreviewProps) {
    const { theme } = useContext(ThemeContext);
    const isCurrentlyDark = isDark(theme);

    if (!isActive || !sourcePosition || !cursorPosition) {
        return null;
    }

    // Get color based on source type
    const getStrokeColor = () => {
        if (sourceType === 'context') {
            return isCurrentlyDark ? '#fbbf24' : '#d97706'; // Amber
        }
        return isCurrentlyDark ? '#a855f7' : '#8b5cf6'; // Purple for insight
    };

    const strokeColor = getStrokeColor();
    const path = generatePreviewPath(
        sourcePosition.x,
        sourcePosition.y,
        cursorPosition.x,
        cursorPosition.y
    );

    return (
        <svg
            className="absolute inset-0 pointer-events-none z-50"
            width={containerWidth}
            height={containerHeight}
        >
            <defs>
                {/* Animated gradient for the preview line */}
                <linearGradient id="connectionPreviewGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor={strokeColor} stopOpacity={0.8} />
                    <stop offset="100%" stopColor={strokeColor} stopOpacity={0.4} />
                </linearGradient>

                {/* Glow filter */}
                <filter id="connectionGlow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
            </defs>

            {/* Glow effect */}
            <path
                d={path}
                stroke={strokeColor}
                strokeWidth={6}
                strokeOpacity={0.2}
                fill="none"
                filter="url(#connectionGlow)"
            />

            {/* Main preview line */}
            <path
                d={path}
                stroke="url(#connectionPreviewGradient)"
                strokeWidth={3}
                strokeDasharray="10 5"
                strokeLinecap="round"
                fill="none"
            >
                {/* Animated dash offset for "flowing" effect */}
                <animate
                    attributeName="stroke-dashoffset"
                    from="0"
                    to="-30"
                    dur="1s"
                    repeatCount="indefinite"
                />
            </path>

            {/* Cursor indicator */}
            <circle
                cx={cursorPosition.x}
                cy={cursorPosition.y}
                r={8}
                fill={strokeColor}
                fillOpacity={0.3}
                stroke={strokeColor}
                strokeWidth={2}
            >
                <animate
                    attributeName="r"
                    values="6;10;6"
                    dur="1s"
                    repeatCount="indefinite"
                />
            </circle>
        </svg>
    );
}

export default memo(ConnectionPreview);
