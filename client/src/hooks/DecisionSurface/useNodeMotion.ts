/**
 * OptimismAI - Living Decision Surface
 * useNodeMotion - Hook for managing node position and animation
 *
 * Provides smooth animations for:
 * - Idle drift (subtle alive movement)
 * - Engage/disengage transitions
 * - Spawn animations
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSpring, config } from '@react-spring/web';
import {
    DRIFT,
    ENGAGE,
    DISENGAGE,
    SPAWN,
    getRandomDriftAmplitude,
    getRandomDriftPeriod,
} from '~/components/DecisionSurface/nodeMotionConfig';
import type { Position, NodeState } from '~/common/DecisionSession.types';

interface UseNodeMotionOptions {
    /** Node's base position */
    basePosition: Position;
    /** Current node state */
    state: NodeState;
    /** Whether this node is currently active */
    isActive: boolean;
    /** Position of the anchor (composer center) */
    anchorPosition: Position;
    /** Whether another node is active (for disengage) */
    otherNodeActive: boolean;
    /** Whether drift should be disabled (during merges, etc) */
    disableDrift?: boolean;
}

interface NodeMotionResult {
    /** Animated position for rendered node */
    animatedPosition: { x: any; y: any };
    /** Animated opacity */
    opacity: any;
    /** Animated scale */
    scale: any;
    /** Animated border alpha */
    borderAlpha: any;
}

/**
 * useNodeMotion - Manages all node animation states
 */
export function useNodeMotion({
    basePosition,
    state,
    isActive,
    anchorPosition,
    otherNodeActive,
    disableDrift = false,
}: UseNodeMotionOptions): NodeMotionResult {
    // Generate stable random drift parameters
    const driftParams = useMemo(
        () => ({
            amplitudeX: getRandomDriftAmplitude(),
            amplitudeY: getRandomDriftAmplitude(),
            periodX: getRandomDriftPeriod(),
            periodY: getRandomDriftPeriod(),
            phaseX: Math.random() * Math.PI * 2,
            phaseY: Math.random() * Math.PI * 2,
        }),
        [],
    );

    // Drift offset state
    const [driftOffset, setDriftOffset] = useState({ x: 0, y: 0 });
    const animationFrameRef = useRef<number>();
    const startTimeRef = useRef<number>(Date.now());

    // Calculate target position based on state
    const targetPosition = useMemo(() => {
        if (state === 'MERGED') {
            return basePosition; // Will be hidden anyway
        }

        if (isActive) {
            // Move toward anchor by ENGAGE.TOWARD_ANCHOR_DISTANCE
            const dx = anchorPosition.x - basePosition.x;
            const dy = anchorPosition.y - basePosition.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance === 0) return basePosition;

            const ratio = Math.min(ENGAGE.TOWARD_ANCHOR_DISTANCE / distance, 1);
            return {
                x: basePosition.x + dx * ratio,
                y: basePosition.y + dy * ratio,
            };
        }

        if (otherNodeActive && state === 'DORMANT') {
            // Move away from anchor by DISENGAGE.AWAY_FROM_ANCHOR_DISTANCE
            const dx = basePosition.x - anchorPosition.x;
            const dy = basePosition.y - anchorPosition.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance === 0) return basePosition;

            const ratio = DISENGAGE.AWAY_FROM_ANCHOR_DISTANCE / distance;
            return {
                x: basePosition.x + dx * ratio,
                y: basePosition.y + dy * ratio,
            };
        }

        return basePosition;
    }, [basePosition, state, isActive, anchorPosition, otherNodeActive]);

    // Idle drift animation loop
    useEffect(() => {
        if (disableDrift || isActive || state === 'MERGED') {
            setDriftOffset({ x: 0, y: 0 });
            return;
        }

        const animate = () => {
            const elapsed = Date.now() - startTimeRef.current;

            const offsetX =
                Math.sin((elapsed / driftParams.periodX) * Math.PI * 2 + driftParams.phaseX) *
                driftParams.amplitudeX;
            const offsetY =
                Math.sin((elapsed / driftParams.periodY) * Math.PI * 2 + driftParams.phaseY) *
                driftParams.amplitudeY;

            setDriftOffset({ x: offsetX, y: offsetY });
            animationFrameRef.current = requestAnimationFrame(animate);
        };

        animationFrameRef.current = requestAnimationFrame(animate);

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [disableDrift, isActive, state, driftParams]);

    // Spring for position
    const [positionSpring] = useSpring(
        () => ({
            x: targetPosition.x + (disableDrift || isActive ? 0 : driftOffset.x),
            y: targetPosition.y + (disableDrift || isActive ? 0 : driftOffset.y),
            config: {
                tension: ENGAGE.SPRING_CONFIG.tension,
                friction: ENGAGE.SPRING_CONFIG.friction,
            },
        }),
        [targetPosition, driftOffset, disableDrift, isActive],
    );

    // Spring for visual properties
    const [visualSpring] = useSpring(
        () => ({
            opacity: state === 'MERGED' ? 0 : isActive ? ENGAGE.ACTIVE_OPACITY : otherNodeActive ? DISENGAGE.DIMMED_OPACITY : 1,
            scale: state === 'MERGED' ? 0.96 : 1,
            borderAlpha: isActive ? ENGAGE.ACTIVE_BORDER_ALPHA : ENGAGE.DORMANT_BORDER_ALPHA,
            config: {
                tension: ENGAGE.SPRING_CONFIG.tension,
                friction: ENGAGE.SPRING_CONFIG.friction,
            },
        }),
        [state, isActive, otherNodeActive],
    );

    return {
        animatedPosition: { x: positionSpring.x, y: positionSpring.y },
        opacity: visualSpring.opacity,
        scale: visualSpring.scale,
        borderAlpha: visualSpring.borderAlpha,
    };
}

export default useNodeMotion;
