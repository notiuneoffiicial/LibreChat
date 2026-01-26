/**
 * OptimismAI - Living Decision Surface
 * ThrowZoneOverlay - Visual feedback for directional throw gestures
 *
 * Shows glowing edge zones when user drags a node:
 * - LEFT zone: Red glow (dismiss action)
 * - RIGHT zone: Green glow (regenerate action)
 */

import { memo, useMemo } from 'react';
import { animated, useSpring } from '@react-spring/web';
import type { ThrowZone } from '~/hooks/DecisionSurface/useDragToThrow';

interface ThrowZoneOverlayProps {
    /** Which zone is active, or null if none */
    activeZone: ThrowZone;
    /** Whether any node is being dragged */
    isDragging: boolean;
}

/**
 * ThrowZoneOverlay - Edge glow zones for throw feedback
 */
function ThrowZoneOverlay({ activeZone, isDragging }: ThrowZoneOverlayProps) {
    // Spring animation for zone opacity
    const leftZoneSpring = useSpring({
        opacity: activeZone === 'dismiss' ? 0.7 : isDragging ? 0.15 : 0,
        config: { tension: 280, friction: 24 },
    });

    const rightZoneSpring = useSpring({
        opacity: activeZone === 'regenerate' ? 0.7 : isDragging ? 0.15 : 0,
        config: { tension: 280, friction: 24 },
    });

    // Zone styles
    const leftZoneStyle = useMemo(() => ({
        background: `linear-gradient(to right, 
            rgba(239, 68, 68, 0.6) 0%, 
            rgba(239, 68, 68, 0.3) 30%,
            transparent 100%)`,
        boxShadow: activeZone === 'dismiss'
            ? 'inset 0 0 60px rgba(239, 68, 68, 0.5)'
            : 'none',
    }), [activeZone]);

    const rightZoneStyle = useMemo(() => ({
        background: `linear-gradient(to left, 
            rgba(34, 197, 94, 0.6) 0%, 
            rgba(34, 197, 94, 0.3) 30%,
            transparent 100%)`,
        boxShadow: activeZone === 'regenerate'
            ? 'inset 0 0 60px rgba(34, 197, 94, 0.5)'
            : 'none',
    }), [activeZone]);

    return (
        <>
            {/* Left zone - Dismiss (red) */}
            <animated.div
                className="pointer-events-none fixed left-0 top-0 bottom-0 w-32 z-50"
                style={{
                    ...leftZoneStyle,
                    opacity: leftZoneSpring.opacity,
                }}
            >
                {/* Icon hint when active */}
                {activeZone === 'dismiss' && (
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-red-400">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="32"
                            height="32"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            className="animate-pulse"
                        >
                            <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                        <span className="text-sm font-medium mt-2 block">Dismiss</span>
                    </div>
                )}
            </animated.div>

            {/* Right zone - Regenerate (green) */}
            <animated.div
                className="pointer-events-none fixed right-0 top-0 bottom-0 w-32 z-50"
                style={{
                    ...rightZoneStyle,
                    opacity: rightZoneSpring.opacity,
                }}
            >
                {/* Icon hint when active */}
                {activeZone === 'regenerate' && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-green-400 text-right">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="32"
                            height="32"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            className="animate-spin-slow ml-auto"
                        >
                            <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                            <path d="M3 3v5h5" />
                            <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                            <path d="M16 16h5v5" />
                        </svg>
                        <span className="text-sm font-medium mt-2 block">Better Q</span>
                    </div>
                )}
            </animated.div>
        </>
    );
}

export default memo(ThrowZoneOverlay);
