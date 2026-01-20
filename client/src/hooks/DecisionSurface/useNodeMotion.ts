/**
 * OptimismAI - Living Decision Surface
 * useNodeMotion - Hook for managing node position and animation
 *
 * Provides smooth animations for:
 * - Idle drift (subtle alive movement)
 * - Engage/disengage transitions
 * - Spawn animations
 * - Session ending slowdown
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSpring, config } from '@react-spring/web';
import { useRecoilValue } from 'recoil';
import store from '~/store';
import {
    DRIFT,
    ENGAGE,
    DISENGAGE,
    SPAWN,
    ENDING,
    TENSION, // Added
    FADING,  // Added
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
    /** Node creation timestamp for stagger */
    createdAt?: number;
    /** Node tension intensity (0-1) */
    intensity?: number;
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
    createdAt = 0,
    intensity = 0.5,
}: UseNodeMotionOptions): NodeMotionResult {
    // Session state for slowdown
    const sessionPhase = useRecoilValue(store.sessionPhaseAtom);
    const fieldSettling = useRecoilValue(store.fieldSettlingAtom);

    // Track spawn state
    const [hasSpawned, setHasSpawned] = useState(false);

    // Trigger spawn animation on mount
    useEffect(() => {
        const now = Date.now();

        // If created long ago (restored session), show immediately
        // (Use 2000ms threshold to distinguish "just now" from "stored")
        if (createdAt < now - 2000) {
            setHasSpawned(true);
            return;
        }

        // Calculate delay:
        // 1. If createdAt is in future (staggered batch), wait until then
        // 2. If createdAt is now/past (streaming), show almost immediately
        const timeUntilSpawn = createdAt - now;
        const delay = Math.max(0, timeUntilSpawn) + 50; // Small buffer for render

        const timer = setTimeout(() => {
            setHasSpawned(true);
        }, delay);

        return () => clearTimeout(timer);
    }, [createdAt]);

    // Calculate slowdown factor based on session state
    const slowdownFactor = useMemo(() => {
        if (fieldSettling || sessionPhase === 'SILENT') {
            return ENDING.FINAL_DRIFT_AMPLITUDE / DRIFT.AMPLITUDE_MAX; // ~0.1
        }
        return 1;
    }, [fieldSettling, sessionPhase]);

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
        if (state === 'MERGED' || state === 'DISSOLVED') {
            return basePosition; // Will be hidden anyway
        }

        if (state === 'PROBING' || isActive) {
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

        if (otherNodeActive && (state === 'DORMANT' || state === 'LATENT')) {
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

    // Idle drift animation loop with slowdown support
    useEffect(() => {
        if (disableDrift || isActive || state === 'PROBING' || state === 'MERGED' || !hasSpawned) {
            setDriftOffset({ x: 0, y: 0 });
            return;
        }

        const animate = () => {
            const elapsed = Date.now() - startTimeRef.current;

            // Apply slowdown factor to amplitude
            const effectiveAmplitudeX = driftParams.amplitudeX * slowdownFactor;
            const effectiveAmplitudeY = driftParams.amplitudeY * slowdownFactor;

            // Increase period when slowing down (slower movement)
            const periodMultiplier = slowdownFactor < 1 ? 2 : 1;
            const effectivePeriodX = driftParams.periodX * periodMultiplier;
            const effectivePeriodY = driftParams.periodY * periodMultiplier;

            const offsetX =
                Math.sin((elapsed / effectivePeriodX) * Math.PI * 2 + driftParams.phaseX) *
                effectiveAmplitudeX;
            const offsetY =
                Math.sin((elapsed / effectivePeriodY) * Math.PI * 2 + driftParams.phaseY) *
                effectiveAmplitudeY;

            setDriftOffset({ x: offsetX, y: offsetY });
            animationFrameRef.current = requestAnimationFrame(animate);
        };

        animationFrameRef.current = requestAnimationFrame(animate);

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [disableDrift, isActive, state, driftParams, slowdownFactor, hasSpawned]);

    // Spring for position
    const [positionSpring] = useSpring(
        () => ({
            x: targetPosition.x + (disableDrift || isActive || state === 'PROBING' ? 0 : driftOffset.x),
            y: targetPosition.y + (disableDrift || isActive || state === 'PROBING' ? 0 : driftOffset.y),
            config: {
                tension: ENGAGE.SPRING_CONFIG.tension,
                friction: ENGAGE.SPRING_CONFIG.friction,
            },
        }),
        [targetPosition, driftOffset, disableDrift, isActive, state],
    );

    // Spring for visual properties with settling support
    const [visualSpring] = useSpring(
        () => {
            // Calculate opacity
            let targetOpacity = 0;
            if (!hasSpawned) targetOpacity = 0;
            else if (state === 'MERGED' || state === 'DISSOLVED') targetOpacity = 0;
            else if (state === 'FADING') targetOpacity = 0;
            else if (isActive || state === 'PROBING') targetOpacity = TENSION.PROBING_OPACITY;
            else if (otherNodeActive) targetOpacity = DISENGAGE.DIMMED_OPACITY;
            else if (fieldSettling) targetOpacity = 0.85;
            else {
                // Tension-based opacity
                targetOpacity = TENSION.MIN_OPACITY + (intensity * (TENSION.MAX_OPACITY - TENSION.MIN_OPACITY));
            }

            // Calculate scale
            let targetScale = 1;
            if (!hasSpawned) targetScale = SPAWN.INITIAL_SCALE * 0.9;
            else if (state === 'MERGED' || state === 'DISSOLVED') targetScale = 0.96;
            else if (state === 'FADING') targetScale = 0.85;
            else if (isActive || state === 'PROBING') targetScale = TENSION.PROBING_SCALE_BOOST;
            else if (fieldSettling) targetScale = 0.98;
            else {
                // Tension-based scale
                targetScale = TENSION.MIN_SCALE + (intensity * (TENSION.MAX_SCALE - TENSION.MIN_SCALE));
            }

            // Calculate border (glow)
            let targetBorderAlpha = 0;
            if (isActive || state === 'PROBING') targetBorderAlpha = TENSION.MAX_BORDER_ALPHA;
            else {
                targetBorderAlpha = TENSION.MIN_BORDER_ALPHA + (intensity * (TENSION.MAX_BORDER_ALPHA - TENSION.MIN_BORDER_ALPHA));
            }

            return {
                opacity: targetOpacity,
                scale: targetScale,
                borderAlpha: targetBorderAlpha,
                config: {
                    tension: !hasSpawned ? 120 : fieldSettling ? 80 : ENGAGE.SPRING_CONFIG.tension,
                    friction: !hasSpawned ? 20 : fieldSettling ? 30 : ENGAGE.SPRING_CONFIG.friction,
                },
            };
        },
        [state, isActive, otherNodeActive, fieldSettling, hasSpawned, intensity],
    );

    return {
        animatedPosition: { x: positionSpring.x, y: positionSpring.y },
        opacity: visualSpring.opacity,
        scale: visualSpring.scale,
        borderAlpha: visualSpring.borderAlpha,
    };
}

export default useNodeMotion;
