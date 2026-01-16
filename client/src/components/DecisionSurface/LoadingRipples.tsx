/**
 * OptimismAI - Living Decision Surface
 * LoadingRipples - Animated ripples that emanate from composer toward node spawn positions
 *
 * Creates anticipation during the delay between user submit and SSE response.
 * Ripples travel from the anchor point toward the 3 spawn directions.
 */

import { memo, useEffect, useState } from 'react';
import { animated, useSpring, useSprings, config } from '@react-spring/web';
import { cn } from '~/utils';
import { SPAWN } from './nodeMotionConfig';
import type { Position } from '~/common/DecisionSession.types';

// ============================================================================
// Types
// ============================================================================

interface LoadingRipplesProps {
    /** Whether ripples should be animating */
    active: boolean;
    /** Center point from which ripples emanate */
    anchorPosition: Position;
}

// ============================================================================
// Constants
// ============================================================================

const RIPPLE_CONFIG = {
    /** Number of concentric ripples to show */
    RIPPLE_COUNT: 3,
    /** Maximum radius ripples expand to (px) */
    MAX_RADIUS: 180,
    /** Duration of one ripple cycle (ms) */
    CYCLE_DURATION: 1200,
    /** Delay between each ripple start (ms) */
    STAGGER_DELAY: 300,
    /** Opacity at ripple start */
    START_OPACITY: 0.4,
    /** Border width of ripple rings */
    BORDER_WIDTH: 1.5,
    /** Color of ripple rings */
    RIPPLE_COLOR: 'rgba(255, 255, 255, 0.3)',
} as const;

const DIRECTIONAL_PULSE_CONFIG = {
    /** Number of pulses per direction */
    PULSE_COUNT: 3,
    /** How far pulses travel (px) */
    TRAVEL_DISTANCE: SPAWN.RADIUS - 40,
    /** Duration of pulse travel (ms) */
    TRAVEL_DURATION: 800,
    /** Stagger between pulses (ms) */
    STAGGER: 200,
    /** Size of pulse dot (px) */
    DOT_SIZE: 6,
} as const;

// ============================================================================
// Concentric Ripple Component
// ============================================================================

interface RippleRingProps {
    active: boolean;
    delay: number;
    anchorPosition: Position;
}

function RippleRing({ active, delay, anchorPosition }: RippleRingProps) {
    const [springProps, api] = useSpring(() => ({
        scale: 0,
        opacity: 0,
        config: { duration: RIPPLE_CONFIG.CYCLE_DURATION },
    }));

    useEffect(() => {
        if (active) {
            const animateRipple = () => {
                api.start({
                    from: { scale: 0, opacity: RIPPLE_CONFIG.START_OPACITY },
                    to: { scale: 1, opacity: 0 },
                    config: { duration: RIPPLE_CONFIG.CYCLE_DURATION },
                    onRest: () => {
                        if (active) {
                            animateRipple();
                        }
                    },
                });
            };

            const timer = setTimeout(animateRipple, delay);
            return () => clearTimeout(timer);
        } else {
            api.start({ scale: 0, opacity: 0 });
        }
    }, [active, delay, api]);

    return (
        <animated.div
            className="pointer-events-none absolute rounded-full"
            style={{
                left: anchorPosition.x,
                top: anchorPosition.y,
                width: RIPPLE_CONFIG.MAX_RADIUS * 2,
                height: RIPPLE_CONFIG.MAX_RADIUS * 2,
                transform: springProps.scale.to(
                    (s) => `translate(-50%, -50%) scale(${s})`,
                ),
                opacity: springProps.opacity,
                border: `${RIPPLE_CONFIG.BORDER_WIDTH}px solid ${RIPPLE_CONFIG.RIPPLE_COLOR}`,
            }}
        />
    );
}

// ============================================================================
// Directional Pulse Component
// ============================================================================

interface DirectionalPulseProps {
    active: boolean;
    anchorPosition: Position;
    angleDeg: number;
    delay: number;
}

function DirectionalPulse({ active, anchorPosition, angleDeg, delay }: DirectionalPulseProps) {
    const angleRad = (angleDeg * Math.PI) / 180;
    const endX = Math.cos(angleRad) * DIRECTIONAL_PULSE_CONFIG.TRAVEL_DISTANCE;
    const endY = Math.sin(angleRad) * DIRECTIONAL_PULSE_CONFIG.TRAVEL_DISTANCE;

    const [springProps, api] = useSpring(() => ({
        progress: 0,
        opacity: 0,
        config: { duration: DIRECTIONAL_PULSE_CONFIG.TRAVEL_DURATION },
    }));

    useEffect(() => {
        if (active) {
            const animatePulse = () => {
                api.start({
                    from: { progress: 0, opacity: 0.6 },
                    to: { progress: 1, opacity: 0 },
                    config: {
                        duration: DIRECTIONAL_PULSE_CONFIG.TRAVEL_DURATION,
                        easing: (t) => t * (2 - t), // ease-out quad
                    },
                    onRest: () => {
                        if (active) {
                            setTimeout(animatePulse, 100);
                        }
                    },
                });
            };

            const timer = setTimeout(animatePulse, delay);
            return () => clearTimeout(timer);
        } else {
            api.start({ progress: 0, opacity: 0 });
        }
    }, [active, delay, api]);

    return (
        <animated.div
            className="pointer-events-none absolute rounded-full bg-white/60"
            style={{
                width: DIRECTIONAL_PULSE_CONFIG.DOT_SIZE,
                height: DIRECTIONAL_PULSE_CONFIG.DOT_SIZE,
                left: springProps.progress.to(
                    (p) => anchorPosition.x + endX * p - DIRECTIONAL_PULSE_CONFIG.DOT_SIZE / 2,
                ),
                top: springProps.progress.to(
                    (p) => anchorPosition.y + endY * p - DIRECTIONAL_PULSE_CONFIG.DOT_SIZE / 2,
                ),
                opacity: springProps.opacity,
                boxShadow: '0 0 8px 2px rgba(255, 255, 255, 0.3)',
            }}
        />
    );
}

// ============================================================================
// Main Component
// ============================================================================

function LoadingRipples({ active, anchorPosition }: LoadingRipplesProps) {
    // Don't render if anchor position isn't set yet
    if (anchorPosition.x === 0 && anchorPosition.y === 0) {
        return null;
    }

    return (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {/* Concentric ripples from center */}
            {Array.from({ length: RIPPLE_CONFIG.RIPPLE_COUNT }).map((_, i) => (
                <RippleRing
                    key={`ripple-${i}`}
                    active={active}
                    delay={i * RIPPLE_CONFIG.STAGGER_DELAY}
                    anchorPosition={anchorPosition}
                />
            ))}

            {/* Directional pulses toward spawn positions */}
            {SPAWN.ANGLES.map((angle, angleIndex) =>
                Array.from({ length: DIRECTIONAL_PULSE_CONFIG.PULSE_COUNT }).map((_, pulseIndex) => (
                    <DirectionalPulse
                        key={`pulse-${angleIndex}-${pulseIndex}`}
                        active={active}
                        anchorPosition={anchorPosition}
                        angleDeg={angle}
                        delay={
                            angleIndex * 100 + // Stagger by direction
                            pulseIndex * DIRECTIONAL_PULSE_CONFIG.STAGGER + // Stagger pulses
                            200 // Initial delay after ripples start
                        }
                    />
                )),
            )}

            {/* Central glow that pulses while loading */}
            <CentralGlow active={active} anchorPosition={anchorPosition} />
        </div>
    );
}

// ============================================================================
// Central Glow Component
// ============================================================================

interface CentralGlowProps {
    active: boolean;
    anchorPosition: Position;
}

function CentralGlow({ active, anchorPosition }: CentralGlowProps) {
    const [springProps, api] = useSpring(() => ({
        scale: 1,
        opacity: 0,
        config: config.gentle,
    }));

    useEffect(() => {
        if (active) {
            // Breathing animation
            const breathe = () => {
                api.start({
                    from: { scale: 0.9, opacity: 0.15 },
                    to: async (next) => {
                        while (active) {
                            await next({ scale: 1.1, opacity: 0.25 });
                            await next({ scale: 0.9, opacity: 0.15 });
                        }
                    },
                    config: { duration: 1000 },
                });
            };
            breathe();
        } else {
            api.start({ scale: 0.8, opacity: 0, config: { duration: 200 } });
        }
    }, [active, api]);

    return (
        <animated.div
            className="pointer-events-none absolute rounded-full"
            style={{
                left: anchorPosition.x,
                top: anchorPosition.y,
                width: 80,
                height: 80,
                transform: springProps.scale.to(
                    (s) => `translate(-50%, -50%) scale(${s})`,
                ),
                opacity: springProps.opacity,
                background: 'radial-gradient(circle, rgba(255,255,255,0.3) 0%, transparent 70%)',
            }}
        />
    );
}

export default memo(LoadingRipples);
