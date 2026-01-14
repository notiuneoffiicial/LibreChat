/**
 * OptimismAI - Living Decision Surface
 * ThoughtNode - A floating, alive thought-seed
 *
 * "Each node is a thought-seed with one high-leverage question,
 * lightly labeled, not titled like a feature."
 */

import { memo, useCallback } from 'react';
import { animated } from '@react-spring/web';
import { cn } from '~/utils';
import { useNodeMotion } from '~/hooks/DecisionSurface';
import type { ThoughtNodeProps, NodeSignal } from '~/common/DecisionSession.types';
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
 */
function ThoughtNode({
    node,
    isActive,
    anchorPosition,
    onSelect,
    otherNodeActive = false,
    disableDrift = false,
}: ExtendedThoughtNodeProps) {
    // Use the motion hook for all animation
    const { animatedPosition, opacity, scale, borderAlpha } = useNodeMotion({
        basePosition: node.position,
        state: node.state,
        isActive,
        anchorPosition,
        otherNodeActive,
        disableDrift,
    });

    // Handle click
    const handleClick = useCallback(() => {
        if (node.state !== 'MERGED') {
            onSelect(node.id);
        }
    }, [node.id, node.state, onSelect]);

    // Don't render merged nodes
    if (node.state === 'MERGED') {
        return null;
    }

    return (
        <animated.div
            className={cn(
                'absolute cursor-pointer',
                'transform -translate-x-1/2 -translate-y-1/2',
                'transition-shadow duration-200',
            )}
            style={{
                left: animatedPosition.x,
                top: animatedPosition.y,
                opacity: opacity,
                scale: scale,
            }}
            onClick={handleClick}
        >
            {/* Node container */}
            <animated.div
                className={cn(
                    'relative px-4 py-3 rounded-2xl',
                    'bg-white/5 backdrop-blur-md',
                    'border transition-all duration-200',
                    isActive && 'ring-1 ring-white/10',
                )}
                style={{
                    borderColor: borderAlpha.to((a: number) => `rgba(255, 255, 255, ${a})`),
                    boxShadow: isActive
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
