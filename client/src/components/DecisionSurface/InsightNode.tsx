/**
 * OptimismAI - InsightNode Component
 * AI-generated insight cards that surface relevant resources
 * 
 * Visual design:
 * - Purple/indigo theme to distinguish from question nodes
 * - Lightbulb icon for insights
 * - Expandable card showing summary
 * - Click to open source URL
 * - Subtle pop-in animation
 * - Draggable for repositioning
 */

import { memo, useCallback, useContext, useState } from 'react';
import { animated, useSpring } from '@react-spring/web';
import { ThemeContext, isDark } from '@librechat/client';
import { cn } from '~/utils';
import type { InsightNodeData, Position } from '~/common/DecisionSession.types';

interface InsightNodeProps {
    node: InsightNodeData;
    onToggleExpand: (nodeId: string) => void;
    onDismiss: (nodeId: string) => void;
    onUpdatePosition: (nodeId: string, position: Position) => void;
}

/**
 * InsightNode - AI-generated insight card
 */
function InsightNode({
    node,
    onToggleExpand,
    onDismiss,
    onUpdatePosition,
}: InsightNodeProps) {
    const { theme } = useContext(ThemeContext);
    const isCurrentlyDark = isDark(theme);

    // Drag state
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
    const [offset, setOffset] = useState({ x: 0, y: 0 });

    // Animation state
    const isAppearing = node.state === 'appearing';
    const isDismissed = node.state === 'dismissed';

    // Spring animation for appearance
    const springProps = useSpring({
        opacity: isDismissed ? 0 : 1,
        scale: isDismissed ? 0.8 : isAppearing ? 0.95 : 1,
        y: isAppearing ? -10 : 0,
        config: { tension: 280, friction: 20 },
    });

    // Handle drag start
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setIsDragging(true);
        setDragStart({ x: e.clientX, y: e.clientY });
    }, []);

    // Handle drag move
    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isDragging || !dragStart) return;

        setOffset({
            x: e.clientX - dragStart.x,
            y: e.clientY - dragStart.y,
        });
    }, [isDragging, dragStart]);

    // Handle drag end
    const handleMouseUp = useCallback(() => {
        if (isDragging && (offset.x !== 0 || offset.y !== 0)) {
            onUpdatePosition(node.id, {
                x: node.position.x + offset.x,
                y: node.position.y + offset.y,
            });
        }
        setIsDragging(false);
        setDragStart(null);
        setOffset({ x: 0, y: 0 });
    }, [isDragging, offset, node.id, node.position, onUpdatePosition]);

    // Attach global mouse listeners when dragging
    useState(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            return () => {
                window.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('mouseup', handleMouseUp);
            };
        }
    });

    // Open source URL
    const handleOpenSource = useCallback(() => {
        if (node.sourceUrl) {
            window.open(node.sourceUrl, '_blank', 'noopener,noreferrer');
        }
    }, [node.sourceUrl]);

    return (
        <animated.div
            className={cn(
                'absolute select-none',
                'rounded-xl shadow-lg',
                'border-2',
                'transition-shadow duration-200',
                isDragging ? 'cursor-grabbing z-50' : 'cursor-grab',
                isCurrentlyDark
                    ? 'bg-gradient-to-br from-purple-900/90 to-indigo-900/90 border-purple-500/40'
                    : 'bg-gradient-to-br from-purple-100 to-indigo-100 border-purple-400/50',
                'backdrop-blur-md',
                isDragging && 'shadow-xl shadow-purple-500/20'
            )}
            style={{
                left: node.position.x + offset.x,
                top: node.position.y + offset.y,
                width: node.isExpanded ? 320 : 220,
                opacity: springProps.opacity,
                scale: springProps.scale,
                y: springProps.y,
                transformOrigin: 'center center',
            }}
            onMouseDown={handleMouseDown}
        >
            {/* Header */}
            <div className="flex items-start gap-2 p-3">
                {/* Lightbulb icon */}
                <div className={cn(
                    'flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center',
                    isCurrentlyDark
                        ? 'bg-yellow-500/20 text-yellow-300'
                        : 'bg-yellow-400/30 text-yellow-600'
                )}>
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
                        <path d="M9 18h6" />
                        <path d="M10 22h4" />
                    </svg>
                </div>

                {/* Title */}
                <div className="flex-1 min-w-0">
                    <h4 className={cn(
                        'font-semibold text-sm leading-tight',
                        isCurrentlyDark ? 'text-white' : 'text-slate-800'
                    )}>
                        {node.title}
                    </h4>
                    {node.sourceName && (
                        <p className={cn(
                            'text-xs mt-0.5',
                            isCurrentlyDark ? 'text-purple-300/70' : 'text-purple-600/70'
                        )}>
                            {node.sourceName}
                        </p>
                    )}
                </div>

                {/* Close button */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onDismiss(node.id);
                    }}
                    className={cn(
                        'flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center',
                        'transition-colors',
                        isCurrentlyDark
                            ? 'hover:bg-white/10 text-white/50 hover:text-white'
                            : 'hover:bg-black/10 text-black/50 hover:text-black'
                    )}
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                    >
                        <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                </button>
            </div>

            {/* Relevance (always visible) */}
            <div className={cn(
                'px-3 pb-2 text-xs',
                isCurrentlyDark ? 'text-purple-200/80' : 'text-purple-700/80'
            )}>
                {node.relevance}
            </div>

            {/* Expanded content */}
            {node.isExpanded && (
                <div className={cn(
                    'px-3 pb-3 border-t',
                    isCurrentlyDark ? 'border-white/10' : 'border-black/10'
                )}>
                    <p className={cn(
                        'text-sm mt-2 leading-relaxed',
                        isCurrentlyDark ? 'text-white/80' : 'text-slate-700'
                    )}>
                        {node.summary}
                    </p>

                    {node.sourceUrl && (
                        <button
                            onClick={handleOpenSource}
                            className={cn(
                                'mt-3 px-3 py-1.5 rounded-lg text-xs font-medium',
                                'flex items-center gap-1',
                                'transition-colors',
                                isCurrentlyDark
                                    ? 'bg-purple-500/30 text-purple-200 hover:bg-purple-500/40'
                                    : 'bg-purple-200 text-purple-700 hover:bg-purple-300'
                            )}
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="12"
                                height="12"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                            >
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                <polyline points="15 3 21 3 21 9" />
                                <line x1="10" y1="14" x2="21" y2="3" />
                            </svg>
                            Open Source
                        </button>
                    )}
                </div>
            )}

            {/* Expand/collapse toggle */}
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    onToggleExpand(node.id);
                }}
                className={cn(
                    'w-full py-1.5 text-xs font-medium',
                    'border-t rounded-b-xl',
                    'transition-colors',
                    isCurrentlyDark
                        ? 'border-white/10 text-purple-300/70 hover:bg-white/5 hover:text-purple-200'
                        : 'border-black/10 text-purple-600/70 hover:bg-black/5 hover:text-purple-700'
                )}
            >
                {node.isExpanded ? 'Show less' : 'Read more'}
            </button>
        </animated.div>
    );
}

export default memo(InsightNode);
