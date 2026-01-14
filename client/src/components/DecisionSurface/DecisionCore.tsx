/**
 * OptimismAI - Living Decision Surface
 * DecisionCore - The stable center that emerges after convergence
 *
 * "There is no decision card at the start.
 * Only after convergence does something new appear"
 */

import { memo } from 'react';
import { animated, useSpring } from '@react-spring/web';
import { cn } from '~/utils';
import type { DecisionCore as DecisionCoreType, LeaningVector } from '~/common/DecisionSession.types';

interface DecisionCoreProps {
    /** The decision core data */
    core: DecisionCoreType;
    /** Whether visible */
    visible: boolean;
    /** Position on the field */
    position: { x: number; y: number };
}

/**
 * DecisionCore - The central insight node
 *
 * Visual characteristics:
 * - Calmer, more stable than thought nodes
 * - Less translucent (more solid)
 * - Contains the hinge statement
 * - Shows leaning direction if present
 */
function DecisionCore({ core, visible, position }: DecisionCoreProps) {
    // Appearance animation
    const [spring] = useSpring(() => ({
        opacity: visible ? 1 : 0,
        scale: visible ? 1 : 0.95,
        config: { tension: 150, friction: 20 },
    }), [visible]);

    if (!visible) return null;

    return (
        <animated.div
            className={cn(
                'absolute -translate-x-1/2 -translate-y-1/2',
                'pointer-events-auto',
            )}
            style={{
                left: position.x,
                top: position.y,
                opacity: spring.opacity,
                scale: spring.scale,
            }}
        >
            {/* Core container - more solid than thought nodes */}
            <div
                className={cn(
                    'relative px-6 py-5 rounded-3xl',
                    'bg-white/15 backdrop-blur-xl',
                    'border border-white/25',
                    'shadow-2xl',
                    'max-w-sm',
                )}
            >
                {/* Core icon */}
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/20 text-amber-400">
                        <span className="text-xs">◆</span>
                    </div>
                </div>

                {/* Statement */}
                <p className="mt-2 text-center text-sm font-medium text-white/95 leading-relaxed">
                    {core.statement}
                </p>

                {/* Hinges on */}
                {core.hingesOn.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-white/10">
                        <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1">
                            Hinges on
                        </p>
                        <div className="flex flex-wrap gap-1">
                            {core.hingesOn.map((hinge, idx) => (
                                <span
                                    key={idx}
                                    className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/70"
                                >
                                    {hinge}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Leaning direction */}
                {core.leaning && (
                    <div className="mt-3 pt-3 border-t border-white/10">
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-white/50">Leaning toward</span>
                            <span className="text-xs font-medium text-white/80">
                                {core.leaning.direction}
                            </span>
                        </div>
                        {/* Mini confidence bar */}
                        <div className="mt-1.5 h-1 rounded-full bg-white/10 overflow-hidden">
                            <div
                                className="h-full rounded-full bg-gradient-to-r from-amber-500/50 to-amber-400/70"
                                style={{ width: `${core.leaning.confidence * 100}%` }}
                            />
                        </div>
                    </div>
                )}
            </div>
        </animated.div>
    );
}

export default memo(DecisionCore);
