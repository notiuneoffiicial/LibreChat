/**
 * OptimismAI - Living Decision Surface
 * SatelliteNode - Small follow-up question nodes
 *
 * Satellites spawn from active nodes for follow-up questions.
 * They are smaller, closer, and auto-collapse once answered.
 */

import { memo, useCallback, useMemo, useEffect, useState } from 'react';
import { animated, useSpring } from '@react-spring/web';
import { cn } from '~/utils';
import { SATELLITE } from './nodeMotionConfig';
import type { SatelliteNodeProps } from '~/common/DecisionSession.types';

/**
 * SatelliteNode - A small follow-up thought
 *
 * Visual characteristics:
 * - Smaller than primary nodes (0.92 scale)
 * - Spawns at 70px radius from parent
 * - Fades in 140ms, fades out 180ms after answered
 * - Auto-dims to 40% after 2 min inactivity
 */
function SatelliteNode({ satellite, parentPosition, onAnswer }: SatelliteNodeProps) {
    const [isInactive, setIsInactive] = useState(false);

    // Calculate position relative to parent
    const position = useMemo(() => {
        // Position is already calculated when satellite is created
        return satellite.position;
    }, [satellite.position]);

    // Inactivity timer
    useEffect(() => {
        if (satellite.answered) return;

        const timer = setTimeout(() => {
            setIsInactive(true);
        }, SATELLITE.INACTIVITY_TIMEOUT);

        return () => clearTimeout(timer);
    }, [satellite.answered, satellite.createdAt]);

    // Spring animation for appearance/disappearance
    const [springStyle] = useSpring(
        () => ({
            opacity: satellite.answered
                ? 0
                : isInactive
                    ? SATELLITE.INACTIVE_OPACITY
                    : 1,
            scale: satellite.answered ? 0.9 : SATELLITE.SCALE,
            config: {
                tension: 200,
                friction: 20,
                duration: satellite.answered
                    ? SATELLITE.FADE_OUT_DURATION
                    : SATELLITE.FADE_IN_DURATION,
            },
        }),
        [satellite.answered, isInactive],
    );

    // Handle click to answer
    const handleClick = useCallback(() => {
        if (!satellite.answered) {
            onAnswer(satellite.id);
        }
    }, [satellite.id, satellite.answered, onAnswer]);

    // Don't render if already faded out
    if (satellite.answered) {
        return null;
    }

    return (
        <animated.div
            className={cn(
                'absolute cursor-pointer',
                'transform -translate-x-1/2 -translate-y-1/2',
            )}
            style={{
                left: position.x,
                top: position.y,
                opacity: springStyle.opacity,
                scale: springStyle.scale,
            }}
            onClick={handleClick}
        >
            {/* Satellite container */}
            <div
                className={cn(
                    'relative px-3 py-2 rounded-xl',
                    'bg-white/3 backdrop-blur-sm',
                    'border border-white/8',
                    'transition-all duration-150',
                    'hover:bg-white/5 hover:border-white/12',
                )}
                style={{
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                }}
            >
                {/* Question text (smaller) */}
                <span className="text-xs leading-relaxed text-white/70">
                    {satellite.question}
                </span>
            </div>

            {/* Connecting line to parent (very subtle) */}
            <svg
                className="pointer-events-none absolute"
                style={{
                    left: '50%',
                    top: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: SATELLITE.SPAWN_RADIUS * 2 + 40,
                    height: SATELLITE.SPAWN_RADIUS * 2 + 40,
                    overflow: 'visible',
                }}
            >
                <line
                    x1="50%"
                    y1="50%"
                    x2={50 + ((parentPosition.x - position.x) / (SATELLITE.SPAWN_RADIUS * 2 + 40)) * 100 + '%'}
                    y2={50 + ((parentPosition.y - position.y) / (SATELLITE.SPAWN_RADIUS * 2 + 40)) * 100 + '%'}
                    stroke="rgba(255, 255, 255, 0.08)"
                    strokeWidth="1"
                    strokeDasharray="4,4"
                />
            </svg>
        </animated.div>
    );
}

export default memo(SatelliteNode);
