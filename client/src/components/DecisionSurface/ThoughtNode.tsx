/**
 * OptimismAI - Living Decision Surface
 * ThoughtNode - A floating, alive thought-seed
 *
 * "Each node is a thought-seed with one high-leverage question,
 * lightly labeled, not titled like a feature."
 */

import { memo, useCallback, useMemo } from 'react';
import { animated, useSpring } from '@react-spring/web';
import { cn } from '~/utils';
import {
    SPAWN,
    ENGAGE,
    DISENGAGE,
    DRIFT,
    getRandomDriftAmplitude,
    getRandomDriftPeriod,
} from './nodeMotionConfig';
import type { ThoughtNodeProps, NodeSignal } from '~/common/DecisionSession.types';
import { SIGNAL_GLYPHS } from '~/common/DecisionSession.types';

/**
 * Topic key glyphs
 * ◌ reality | ◌ values | ◌ options
 */
const TOPIC_GLYPHS: Record<string, string> = {
    reality: '◌',
    values: '◌',
    options: '◌',
};

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
function ThoughtNode({ node, isActive, anchorPosition, onSelect }: ThoughtNodeProps) {
    // Generate random drift parameters (stable per node via useMemo)
    const driftParams = useMemo(
        () => ({
            amplitude: getRandomDriftAmplitude(),
            period: getRandomDriftPeriod(),
            phaseX: Math.random() * Math.PI * 2,
            phaseY: Math.random() * Math.PI * 2,
        }),
        [],
    );

    // Calculate target position based on active state
    const targetPosition = useMemo(() => {
        if (isActive) {
            // Move toward anchor
            const dx = anchorPosition.x - node.position.x;
            const dy = anchorPosition.y - node.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const ratio = ENGAGE.TOWARD_ANCHOR_DISTANCE / distance;

            return {
                x: node.position.x + dx * ratio,
                y: node.position.y + dy * ratio,
            };
        } else if (node.state === 'DORMANT') {
            // If another node is active, move away slightly
            // For now just use base position
            return node.position;
        }

        return node.position;
    }, [isActive, node.position, anchorPosition, node.state]);

    // Spring for position and opacity
    const [springStyle] = useSpring(
        () => ({
            x: targetPosition.x,
            y: targetPosition.y,
            opacity: isActive ? ENGAGE.ACTIVE_OPACITY : node.state === 'DORMANT' ? 1.0 : DISENGAGE.DIMMED_OPACITY,
            scale: node.state === 'MERGED' ? 0 : 1,
            borderAlpha: isActive ? ENGAGE.ACTIVE_BORDER_ALPHA : ENGAGE.DORMANT_BORDER_ALPHA,
            config: {
                tension: ENGAGE.SPRING_CONFIG.tension,
                friction: ENGAGE.SPRING_CONFIG.friction,
            },
        }),
        [targetPosition, isActive, node.state],
    );

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
                left: springStyle.x,
                top: springStyle.y,
                opacity: springStyle.opacity,
                scale: springStyle.scale,
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
                    borderColor: springStyle.borderAlpha.to((a) => `rgba(255, 255, 255, ${a})`),
                    boxShadow: isActive
                        ? '0 8px 32px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05)'
                        : '0 4px 16px rgba(0, 0, 0, 0.2)',
                }}
            >
                {/* Topic glyph */}
                <span className="mr-2 text-xs text-white/40">{TOPIC_GLYPHS[node.topicKey]}</span>

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
