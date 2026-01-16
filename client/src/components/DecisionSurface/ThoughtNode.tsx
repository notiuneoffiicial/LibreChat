/**
 * OptimismAI - Living Decision Surface
 * ThoughtNode - A floating, alive thought-seed
 *
 * "Each node is a thought-seed with one high-leverage question,
 * lightly labeled, not titled like a feature."
 */

import { memo, useCallback, useRef } from 'react';
import { animated, useSpring } from '@react-spring/web';
import { cn } from '~/utils';
import { useNodeMotion, useDragToThrow } from '~/hooks/DecisionSurface';
import { THROW } from './nodeMotionConfig';
import type { ThoughtNodeProps, NodeSignal, TopicKey } from '~/common/DecisionSession.types';
import { SIGNAL_GLYPHS } from '~/common/DecisionSession.types';

/**
 * Topic key glyphs - distinct visual markers for each inquiry path
 */
const TOPIC_GLYPHS: Record<string, string> = {
    reality: '◇',  // Diamond for facts/constraints
    values: '○',   // Circle for alignment/values
    options: '△',  // Triangle for alternatives
};

/**
 * Topic colors for subtle differentiation
 */
const TOPIC_COLORS: Record<string, string> = {
    reality: 'rgba(147, 197, 253, 0.6)',   // Blue tint
    values: 'rgba(252, 211, 77, 0.6)',     // Amber tint
    options: 'rgba(167, 243, 208, 0.6)',   // Green tint
};

interface ExtendedThoughtNodeProps extends ThoughtNodeProps {
    /** Whether another node (not this one) is currently active */
    otherNodeActive?: boolean;
    /** Whether drift animation should be disabled (during merges) */
    disableDrift?: boolean;
    /** Callback when node is thrown out for regeneration */
    onThrowOut?: (nodeId: string, category: TopicKey) => void;
    /** Whether drag-to-throw is enabled (default: true) */
    enableDrag?: boolean;
}

/**
 * ThoughtNode - A single floating thought
 *
 * Visual characteristics:
 * - Rounded, translucent shape (backdrop-blur)
 * - One line of text (the question)
 * - Tiny glyph indicating topic type
 * - Subtle idle drift animation
 * - Engage/disengage motion on selection
 * - Drag-to-throw gesture for regeneration
 */
function ThoughtNode({
    node,
    isActive,
    anchorPosition,
    onSelect,
    otherNodeActive = false,
    disableDrift = false,
    onThrowOut,
    enableDrag = true,
}: ExtendedThoughtNodeProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    // Use the motion hook for all animation
    const { animatedPosition, opacity, scale, borderAlpha } = useNodeMotion({
        basePosition: node.position,
        state: node.state,
        isActive,
        anchorPosition,
        otherNodeActive,
        disableDrift,
        createdAt: node.createdAt,
    });

    // Drag-to-throw hook
    const { dragHandlers, dragOffset, isDragging, isExiting } = useDragToThrow({
        nodeId: node.id,
        onThrowOut: (nodeId) => {
            onThrowOut?.(nodeId, node.topicKey);
        },
        enabled: enableDrag && !isActive && node.state === 'DORMANT',
    });

    // Spring for drag offset animation
    const [dragSpring] = useSpring(
        () => ({
            x: isExiting ? dragOffset.x : isDragging ? dragOffset.x : 0,
            y: isExiting ? dragOffset.y : isDragging ? dragOffset.y : 0,
            opacity: isExiting ? THROW.EXIT_OPACITY : isDragging ? THROW.DRAG_OPACITY : 1,
            scale: isExiting ? THROW.EXIT_SCALE : 1,
            config: isExiting ? THROW.SPRING_CONFIG : THROW.SNAP_BACK_CONFIG,
        }),
        [dragOffset, isDragging, isExiting],
    );

    // Handle click - only trigger if not dragging
    const handleClick = useCallback((e: React.MouseEvent) => {
        // Prevent click from firing after drag
        if (isDragging) {
            e.stopPropagation();
            return;
        }
        if (node.state !== 'MERGED' && node.state !== 'EXITING') {
            onSelect(node.id);
        }
    }, [node.id, node.state, onSelect, isDragging]);

    // Don't render merged or fully exited nodes
    if (node.state === 'MERGED') {
        return null;
    }

    // Determine if drag is currently enabled for this node
    const canDrag = enableDrag && !isActive && node.state === 'DORMANT';

    return (
        <animated.div
            ref={containerRef}
            className={cn(
                'absolute',
                'transform -translate-x-1/2 -translate-y-1/2',
                'transition-shadow duration-200',
                canDrag && !isDragging && 'cursor-grab',
                isDragging && 'cursor-grabbing',
                !canDrag && 'cursor-pointer',
            )}
            style={{
                left: animatedPosition.x.to((x: number) => x + dragSpring.x.get()),
                top: animatedPosition.y.to((y: number) => y + dragSpring.y.get()),
                opacity: opacity.to((o: number) => o * dragSpring.opacity.get()),
                scale: scale.to((s: number) => s * dragSpring.scale.get()),
                zIndex: isDragging ? 100 : 1,
                touchAction: 'none', // Prevent browser touch gestures
            }}
            onClick={handleClick}
            {...(canDrag ? dragHandlers : {})}
        >
            {/* Node container */}
            <animated.div
                className={cn(
                    'relative px-4 py-3 rounded-2xl',
                    'bg-white/5 backdrop-blur-md',
                    'border transition-all duration-200',
                    isActive && 'ring-1 ring-white/10',
                    isDragging && 'ring-2 ring-white/20',
                    'select-none', // Prevent text selection during drag
                )}
                style={{
                    borderColor: borderAlpha.to((a: number) => `rgba(255, 255, 255, ${a})`),
                    boxShadow: isDragging
                        ? '0 16px 48px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1)'
                        : isActive
                            ? '0 8px 32px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05)'
                            : '0 4px 16px rgba(0, 0, 0, 0.2)',
                }}
            >
                {/* Topic glyph with color */}
                <span
                    className="mr-2 text-xs"
                    style={{ color: TOPIC_COLORS[node.topicKey] || 'rgba(255,255,255,0.4)' }}
                >
                    {TOPIC_GLYPHS[node.topicKey]}
                </span>

                {/* Question text */}
                <span
                    className={cn(
                        'text-sm leading-relaxed',
                        isActive ? 'text-white/95' : 'text-white/80',
                        'transition-colors duration-200',
                    )}
                >
                    {node.question}
                </span>

                {/* Answer indicator (if resolved) */}
                {node.state === 'RESOLVED' && node.answer && (
                    <div className="mt-2 pt-2 border-t border-white/10">
                        <span className="text-xs text-white/50 line-clamp-2">
                            {node.answer}
                        </span>
                    </div>
                )}

                {/* Signal indicators */}
                {node.signals.length > 0 && (
                    <div className="absolute -right-1 -top-1 flex gap-0.5">
                        {node.signals.map((signal, idx) => (
                            <SignalIndicator key={idx} signal={signal} />
                        ))}
                    </div>
                )}

                {/* Drag hint - shows when node is draggable but not being dragged */}
                {canDrag && !isDragging && (
                    <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-[10px] text-white/30 whitespace-nowrap">
                            Drag to regenerate
                        </span>
                    </div>
                )}
            </animated.div>
        </animated.div>
    );
}

/**
 * SignalIndicator - Tiny ambient signal glyph
 * Shows on hover with tooltip
 */
function SignalIndicator({ signal }: { signal: NodeSignal }) {
    return (
        <span
            className={cn(
                'inline-flex items-center justify-center',
                'h-4 w-4 rounded-full',
                'bg-white/10 text-[10px] text-white/50',
                'cursor-help',
            )}
            title={signal.description}
        >
            {SIGNAL_GLYPHS[signal.type]}
        </span>
    );
}

export default memo(ThoughtNode);

