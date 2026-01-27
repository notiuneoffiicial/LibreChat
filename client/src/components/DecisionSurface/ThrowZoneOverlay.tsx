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
 * 
 * Position-based: Zones light up when node is actually INSIDE the zone area
 * This provides clear feedback that releasing will trigger the action
 */
function ThrowZoneOverlay({ activeZone, isDragging }: ThrowZoneOverlayProps) {
    // Spring animation for zone opacity - stronger glow when active
    const leftZoneSpring = useSpring({
        opacity: activeZone === 'dismiss' ? 1 : isDragging ? 0.2 : 0,
        scale: activeZone === 'dismiss' ? 1.05 : 1,
        config: { tension: 300, friction: 20 },
    });

    const rightZoneSpring = useSpring({
        opacity: activeZone === 'regenerate' ? 1 : isDragging ? 0.2 : 0,
        scale: activeZone === 'regenerate' ? 1.05 : 1,
        config: { tension: 300, friction: 20 },
    });

    // Zone styles with stronger glow when active
    const leftZoneStyle = useMemo(() => ({
        background: activeZone === 'dismiss'
            ? `linear-gradient(to right, 
                rgba(239, 68, 68, 0.8) 0%, 
                rgba(239, 68, 68, 0.5) 40%,
                transparent 100%)`
            : `linear-gradient(to right, 
                rgba(239, 68, 68, 0.4) 0%, 
                rgba(239, 68, 68, 0.2) 30%,
                transparent 100%)`,
        boxShadow: activeZone === 'dismiss'
            ? 'inset 0 0 80px rgba(239, 68, 68, 0.7), 0 0 40px rgba(239, 68, 68, 0.3)'
            : 'none',
    }), [activeZone]);

    const rightZoneStyle = useMemo(() => ({
        background: activeZone === 'regenerate'
            ? `linear-gradient(to left, 
                rgba(34, 197, 94, 0.8) 0%, 
                rgba(34, 197, 94, 0.5) 40%,
                transparent 100%)`
            : `linear-gradient(to left, 
                rgba(34, 197, 94, 0.4) 0%, 
                rgba(34, 197, 94, 0.2) 30%,
                transparent 100%)`,
        boxShadow: activeZone === 'regenerate'
            ? 'inset 0 0 80px rgba(34, 197, 94, 0.7), 0 0 40px rgba(34, 197, 94, 0.3)'
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
                    transform: leftZoneSpring.scale.to(s => `scaleX(${s})`),
                    transformOrigin: 'left center',
                }}
            >
                {/* Icon hint - shown during drag, prominent when active */}
                {isDragging && (
                    <div
                        className={`absolute left-4 top-1/2 -translate-y-1/2 transition-all duration-200 ${activeZone === 'dismiss'
                                ? 'text-red-300 scale-110'
                                : 'text-red-400/50 scale-100'
                            }`}
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width={activeZone === 'dismiss' ? 40 : 28}
                            height={activeZone === 'dismiss' ? 40 : 28}
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            className={activeZone === 'dismiss' ? 'animate-pulse' : ''}
                        >
                            <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                        <span className={`text-sm font-medium mt-2 block transition-opacity ${activeZone === 'dismiss' ? 'opacity-100' : 'opacity-50'
                            }`}>
                            Dismiss
                        </span>
                    </div>
                )}
            </animated.div>

            {/* Right zone - Regenerate (green) */}
            <animated.div
                className="pointer-events-none fixed right-0 top-0 bottom-0 w-32 z-50"
                style={{
                    ...rightZoneStyle,
                    opacity: rightZoneSpring.opacity,
                    transform: rightZoneSpring.scale.to(s => `scaleX(${s})`),
                    transformOrigin: 'right center',
                }}
            >
                {/* Icon hint - shown during drag, prominent when active */}
                {isDragging && (
                    <div
                        className={`absolute right-4 top-1/2 -translate-y-1/2 text-right transition-all duration-200 ${activeZone === 'regenerate'
                                ? 'text-green-300 scale-110'
                                : 'text-green-400/50 scale-100'
                            }`}
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width={activeZone === 'regenerate' ? 40 : 28}
                            height={activeZone === 'regenerate' ? 40 : 28}
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            className={`ml-auto ${activeZone === 'regenerate' ? 'animate-spin-slow' : ''}`}
                        >
                            <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                            <path d="M3 3v5h5" />
                            <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                            <path d="M16 16h5v5" />
                        </svg>
                        <span className={`text-sm font-medium mt-2 block transition-opacity ${activeZone === 'regenerate' ? 'opacity-100' : 'opacity-50'
                            }`}>
                            Better Q
                        </span>
                    </div>
                )}
            </animated.div>
        </>
    );
}

export default memo(ThrowZoneOverlay);
