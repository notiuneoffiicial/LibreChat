/**
 * OptimismAI - Living Decision Surface
 * LeaningIndicator - Shows directional sense, not a verdict
 *
 * Appears only when meaningful convergence has occurred.
 * Shifts are damped to feel gradual, not jarring.
 */

import { memo, useMemo } from 'react';
import { animated, useSpring } from '@react-spring/web';
import { cn } from '~/utils';
import { LEANING } from './nodeMotionConfig';
import type { LeaningIndicatorProps } from '~/common/DecisionSession.types';

/**
 * LeaningIndicator - The directional compass
 *
 * Visual characteristics:
 * - Appears only after 1 merge or <= 3 options
 * - Slides down 12px + fades in 240ms
 * - Dot on a scale, shifts smoothly
 * - Never feels like a verdict
 */
function LeaningIndicator({ leaning, visible }: LeaningIndicatorProps) {
    // Spring for appearance
    const [appearSpring] = useSpring(
        () => ({
            opacity: visible ? 1 : 0,
            y: visible ? 0 : -LEANING.SLIDE_DISTANCE,
            config: {
                tension: 150,
                friction: 20,
                duration: LEANING.FADE_IN_DURATION,
            },
        }),
        [visible],
    );

    // Spring for leaning position (damped)
    const [leanSpring] = useSpring(
        () => ({
            position: leaning ? leaning.confidence * 100 : 50,
            config: {
                tension: 100,
                friction: 30,
            },
        }),
        [leaning?.confidence],
    );

    // Calculate color based on confidence
    const indicatorColor = useMemo(() => {
        if (!leaning) return 'rgba(255, 255, 255, 0.4)';

        const confidence = leaning.confidence;
        // More confident = more visible
        const alpha = 0.3 + confidence * 0.4;
        return `rgba(255, 255, 255, ${alpha})`;
    }, [leaning]);

    if (!visible && !leaning) {
        return null;
    }

    return (
        <animated.div
            className={cn(
                'absolute bottom-20 left-1/2 -translate-x-1/2',
                'pointer-events-none',
            )}
            style={{
                opacity: appearSpring.opacity,
                y: appearSpring.y,
            }}
        >
            {/* Container */}
            <div className="flex flex-col items-center gap-2">
                {/* Direction label (if leaning) */}
                {leaning && leaning.direction && (
                    <animated.span
                        className="text-xs text-white/50 text-center max-w-[200px]"
                        style={{
                            opacity: appearSpring.opacity,
                        }}
                    >
                        {leaning.direction}
                    </animated.span>
                )}

                {/* Scale track */}
                <div
                    className={cn(
                        'relative w-48 h-1 rounded-full',
                        'bg-white/10',
                        'overflow-visible',
                    )}
                >
                    {/* Leaning indicator dot */}
                    <animated.div
                        className="absolute top-1/2 -translate-y-1/2"
                        style={{
                            left: leanSpring.position.to((p) => `${p}%`),
                            transform: 'translate(-50%, -50%)',
                        }}
                    >
                        <div
                            className={cn(
                                'h-3 w-3 rounded-full',
                                'transition-all duration-300',
                                'shadow-lg',
                            )}
                            style={{
                                backgroundColor: indicatorColor,
                                boxShadow: `0 0 8px ${indicatorColor}`,
                            }}
                        />
                    </animated.div>

                    {/* Center mark (neutral) */}
                    <div
                        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                    >
                        <div className="h-2 w-0.5 bg-white/20 rounded-full" />
                    </div>
                </div>

                {/* Confidence label */}
                {leaning && (
                    <span className="text-[10px] text-white/30">
                        {Math.round(leaning.confidence * 100)}% confidence
                    </span>
                )}
            </div>
        </animated.div>
    );
}

export default memo(LeaningIndicator);
