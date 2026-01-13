/**
 * OptimismAI - Living Decision Surface
 * ThinkingField - The full-screen canvas for decision exploration
 *
 * "A calm, almost empty field... the system responds to me, not the other way around"
 */

import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil';
import { animated, useSpring } from '@react-spring/web';
import { cn } from '~/utils';
import store from '~/store';
import { FIELD, COMPOSER } from './nodeMotionConfig';
import type { ThinkingFieldProps } from '~/common/DecisionSession.types';
import DecisionComposer from './DecisionComposer';
import ThoughtNode from './ThoughtNode';

/**
 * ThinkingField - The living decision surface
 *
 * Visual characteristics:
 * - Full-screen, dark canvas with subtle grain/texture
 * - No obvious "UI layout"
 * - Centered input that responds to thought
 * - Nodes float and drift naturally
 */
function ThinkingField({ sessionId, conversationId }: ThinkingFieldProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

    // State
    const [composerSubmitted, setComposerSubmitted] = useRecoilState(store.composerSubmittedAtom);
    const [anchorPosition, setAnchorPosition] = useRecoilState(store.anchorPositionAtom);
    const sessionPhase = useRecoilValue(store.sessionPhaseAtom);
    const thoughtNodes = useRecoilValue(store.thoughtNodesAtom);
    const activeNodeId = useRecoilValue(store.activeNodeIdAtom);
    const setActiveNodeId = useSetRecoilState(store.activeNodeIdAtom);
    const vignetteIntensity = useRecoilValue(store.vignetteIntensityAtom);
    const fieldSettling = useRecoilValue(store.fieldSettlingAtom);

    // Vignette "breathe" animation
    const [vignetteSpring, vignetteApi] = useSpring(() => ({
        opacity: vignetteIntensity,
        config: { tension: 120, friction: 14 },
    }));

    // Trigger breathe effect when composer submits
    useEffect(() => {
        if (composerSubmitted) {
            vignetteApi.start({
                opacity: FIELD.VIGNETTE_BREATHE_INTENSITY,
                config: { duration: COMPOSER.BREATHE_DURATION / 2 },
            });
            setTimeout(() => {
                vignetteApi.start({
                    opacity: FIELD.VIGNETTE_INTENSITY,
                    config: { duration: COMPOSER.BREATHE_DURATION / 2 },
                });
            }, COMPOSER.BREATHE_DURATION / 2);
        }
    }, [composerSubmitted, vignetteApi]);

    // Update dimensions on resize
    useEffect(() => {
        const updateDimensions = () => {
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                setDimensions({ width: rect.width, height: rect.height });

                // Set anchor position to center (slightly above for composer)
                const anchorY = rect.height / 2;
                const anchorX = rect.width / 2;
                setAnchorPosition({ x: anchorX, y: anchorY });
            }
        };

        updateDimensions();
        window.addEventListener('resize', updateDimensions);
        return () => window.removeEventListener('resize', updateDimensions);
    }, [setAnchorPosition]);

    // Handle node selection
    const handleNodeSelect = useCallback(
        (nodeId: string) => {
            setActiveNodeId(nodeId);
        },
        [setActiveNodeId],
    );

    // Handle composer submit
    const handleComposerSubmit = useCallback(
        (message: string) => {
            console.log('[ThinkingField] Composer submitted:', message);
            setComposerSubmitted(true);

            // TODO: Dispatch to session state machine
            // This will trigger IDLE → INTAKE transition
        },
        [setComposerSubmitted],
    );

    return (
        <div
            ref={containerRef}
            className={cn(
                'relative h-full w-full overflow-hidden',
                'transition-all duration-500',
                fieldSettling && 'opacity-95',
            )}
            style={{
                backgroundColor: FIELD.BACKGROUND_COLOR,
            }}
        >
            {/* Subtle grain texture overlay */}
            <div
                className="pointer-events-none absolute inset-0"
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
                    opacity: FIELD.GRAIN_OPACITY,
                    mixBlendMode: 'overlay',
                }}
            />

            {/* Soft grid (very subtle) */}
            <div
                className="pointer-events-none absolute inset-0"
                style={{
                    backgroundImage: `
            linear-gradient(rgba(255,255,255,${FIELD.GRID_OPACITY}) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,${FIELD.GRID_OPACITY}) 1px, transparent 1px)
          `,
                    backgroundSize: '64px 64px',
                    backgroundPosition: 'center center',
                }}
            />

            {/* Vignette overlay */}
            <animated.div
                className="pointer-events-none absolute inset-0"
                style={{
                    background: `radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.6) 100%)`,
                    opacity: vignetteSpring.opacity,
                }}
            />

            {/* Thought nodes */}
            <div className="absolute inset-0">
                {thoughtNodes.map((node) => (
                    <ThoughtNode
                        key={node.id}
                        node={node}
                        isActive={node.id === activeNodeId}
                        anchorPosition={anchorPosition}
                        onSelect={handleNodeSelect}
                    />
                ))}
            </div>

            {/* Decision Composer */}
            <DecisionComposer
                onSubmit={handleComposerSubmit}
                isSubmitting={sessionPhase === 'INTAKE'}
                hasSubmitted={composerSubmitted}
                placeholder="What are you deciding?"
            />

            {/* Trace overlay affordance */}
            {sessionPhase !== 'IDLE' && (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 transform">
                    <button
                        className={cn(
                            'text-xs text-white/30 transition-colors duration-200',
                            'hover:text-white/50',
                            'focus:outline-none focus:ring-1 focus:ring-white/20 focus:ring-offset-2 focus:ring-offset-transparent',
                        )}
                        onClick={() => {
                            // TODO: Open trace overlay
                        }}
                    >
                        Trace my thinking
                    </button>
                </div>
            )}
        </div>
    );
}

export default memo(ThinkingField);
