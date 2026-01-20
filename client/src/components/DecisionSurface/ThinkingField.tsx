/**
 * OptimismAI - Living Decision Surface
 * ThinkingField - The full-screen canvas for decision exploration
 *
 * "A calm, almost empty field... the system responds to me, not the other way around"
 */

import { memo, useCallback, useEffect, useMemo, useRef, useState, useContext } from 'react';
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil';
import { animated, useSpring } from '@react-spring/web';
import { ThemeContext, isDark } from '@librechat/client';
import { cn } from '~/utils';
import store from '~/store';
import { useDecisionSession, useTensionProbe, useDecisionChat, useMagneticField } from '~/hooks/DecisionSurface';
import { FIELD, COMPOSER, THROW } from './nodeMotionConfig';
import type { ThinkingFieldProps, TopicKey } from '~/common/DecisionSession.types';
import DecisionComposer from './DecisionComposer';
import ThoughtNode from './ThoughtNode';
import AnswerInput from './AnswerInput';
import ContextNode from './ContextNode';
import StartSessionButton from './StartSessionButton';
import LoadingRipples from './LoadingRipples';

/**
 * ThinkingField - The living decision surface
 */
function ThinkingField({ sessionId, conversationId }: ThinkingFieldProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

    // Theme context for dark/light mode
    const { theme } = useContext(ThemeContext);
    const isCurrentlyDark = isDark(theme);

    // State from store
    const [composerSubmitted, setComposerSubmitted] = useRecoilState(store.composerSubmittedAtom);
    const [anchorPosition, setAnchorPosition] = useRecoilState(store.anchorPositionAtom);
    const sessionPhase = useRecoilValue(store.sessionPhaseAtom);
    const [thoughtNodes, setThoughtNodes] = useRecoilState(store.thoughtNodesAtom);
    const activeNodeId = useRecoilValue(store.activeNodeIdAtom);
    const setActiveNodeId = useSetRecoilState(store.activeNodeIdAtom);
    const isMerging = useRecoilValue(store.isMergingAtom);
    const vignetteIntensity = useRecoilValue(store.vignetteIntensityAtom);
    const fieldSettling = useRecoilValue(store.fieldSettlingAtom);
    const setTraceOverlayOpen = useSetRecoilState(store.traceOverlayOpenAtom);

    // Composer visibility - controls empty-state UX
    const [composerVisible, setComposerVisible] = useRecoilState(store.composerVisibleAtom);

    // Context nodes
    const contextNodes = useRecoilValue(store.contextNodesAtom);

    const [softConfirmation, setSoftConfirmation] = useRecoilState(store.softConfirmationAtom);

    // Session state machine hook
    const { submitDecision, selectNode, session, endSession, reopenSession } = useDecisionSession(conversationId);

    // Question engine hook
    const { processAnswer, isProcessing, regenerateQuestion, selectNextProbe } = useTensionProbe();

    // Field dynamics hook
    const { isActive: isFieldActive } = useMagneticField();

    // Chat integration hook for message persistence
    const { storeAnswer } = useDecisionChat({ conversationId });

    // Get active node for answer input
    const activeNode = useMemo(
        () => thoughtNodes.find((n) => n.id === activeNodeId) || null,
        [thoughtNodes, activeNodeId],
    );

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
                const anchorY = rect.height / 2;
                const anchorX = rect.width / 2;
                setAnchorPosition({ x: anchorX, y: anchorY });
            }
        };

        updateDimensions();
        window.addEventListener('resize', updateDimensions);
        return () => window.removeEventListener('resize', updateDimensions);
    }, [setAnchorPosition]);

    // Handle node selection via state machine
    const handleNodeSelect = useCallback(
        (nodeId: string) => {
            selectNode(nodeId);
        },
        [selectNode],
    );

    // Handle composer submit via state machine
    const handleComposerSubmit = useCallback(
        (message: string) => {
            console.log('[ThinkingField] Composer submitted:', message);
            submitDecision(message);
        },
        [submitDecision],
    );

    // Handle answer submission for main nodes
    const handleAnswerSubmit = useCallback(
        async (nodeId: string, answer: string) => {
            console.log('[ThinkingField] Answer submitted for node:', nodeId);

            const node = thoughtNodes.find((n) => n.id === nodeId);
            if (!node) return;

            // Store the answer as a LibreChat message
            storeAnswer(nodeId, node.question, answer);

            // Process answer via question engine
            await processAnswer(nodeId, node.question, answer);

            setActiveNodeId(null);
        },
        [thoughtNodes, storeAnswer, processAnswer, setActiveNodeId],
    );

    // Handle answer dismiss
    const handleAnswerDismiss = useCallback(() => {
        setActiveNodeId(null);
    }, [setActiveNodeId]);

    // Open trace overlay
    const handleOpenTrace = useCallback(() => {
        setTraceOverlayOpen(true);
    }, [setTraceOverlayOpen]);

    // Handle node throw-out for regeneration
    const handleNodeThrowOut = useCallback(
        async (nodeId: string, category: TopicKey) => {
            console.log('[ThinkingField] Node thrown out:', nodeId, 'category:', category);

            // 1. Mark node as exiting (triggers exit animation)
            setThoughtNodes((prev) =>
                prev.map((n) =>
                    n.id === nodeId ? { ...n, state: 'EXITING' as const } : n,
                ),
            );

            // 2. Wait for exit animation to complete
            await new Promise((resolve) => setTimeout(resolve, THROW.EXIT_DURATION));

            // 3. Remove the old node
            setThoughtNodes((prev) => prev.filter((n) => n.id !== nodeId));

            // 4. Regenerate a new question for the same category
            const statement = session?.draft?.statement || '';
            await regenerateQuestion(category, statement);
        },
        [setThoughtNodes, session, regenerateQuestion],
    );

    // Check if any node is active
    const hasActiveNode = activeNodeId !== null;
    const isAnswering = hasActiveNode;

    return (
        <div
            ref={containerRef}
            className={cn(
                'relative h-full w-full overflow-hidden',
                'transition-all duration-500',
                fieldSettling && 'opacity-95',
                // Apply animated gradient class for light mode
                !isCurrentlyDark && 'optimism-animated-gradient',
            )}
            style={{
                backgroundColor: isCurrentlyDark
                    ? FIELD.BACKGROUND_COLOR_DARK
                    : FIELD.BACKGROUND_COLOR_LIGHT,
            }}
        >
            {/* Grain texture */}
            <div
                className="pointer-events-none absolute inset-0"
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
                    opacity: FIELD.GRAIN_OPACITY,
                    mixBlendMode: 'overlay',
                }}
            />

            {/* Soft grid - only show in dark mode */}
            {isCurrentlyDark && (
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
            )}

            {/* Vignette - only show in dark mode */}
            {isCurrentlyDark && (
                <animated.div
                    className="pointer-events-none absolute inset-0"
                    style={{
                        background: `radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.6) 100%)`,
                        opacity: vignetteSpring.opacity,
                    }}
                />
            )}

            {/* Loading ripples - shown during INTAKE phase, fades out when nodes appear */}
            <LoadingRipples
                active={sessionPhase === 'INTAKE'}
                fadeOut={thoughtNodes.length > 0}
                anchorPosition={anchorPosition}
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
                        onThrowOut={handleNodeThrowOut}
                        otherNodeActive={hasActiveNode && node.id !== activeNodeId}
                        disableDrift={isMerging}
                    />
                ))}

                {/* Context nodes */}
                {contextNodes.map((contextNode) => (
                    <ContextNode key={contextNode.id} node={contextNode} />
                ))}
            </div>

            {/* Start Session Button or Decision Composer */}
            {!isAnswering && (
                composerVisible ? (
                    <DecisionComposer
                        onSubmit={handleComposerSubmit}
                        isSubmitting={sessionPhase === 'INTAKE'}
                        hasSubmitted={composerSubmitted}
                        placeholder="What are you deciding?"
                        animateIn={true}
                        anchorPosition={anchorPosition}
                    />
                ) : (
                    <StartSessionButton onStart={() => setComposerVisible(true)} anchorPosition={anchorPosition} />
                )
            )}

            {/* Answer Input for main nodes */}
            <AnswerInput
                node={activeNode}
                onSubmit={handleAnswerSubmit}
                onDismiss={handleAnswerDismiss}
                isProcessing={isProcessing}
            />

            {/* Trace overlay affordance */}
            {sessionPhase !== 'IDLE' && !isAnswering && (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 transform">
                    <button
                        className={cn(
                            'text-xs transition-colors duration-200',
                            isCurrentlyDark
                                ? 'text-white/30 hover:text-white/50 focus:ring-white/20'
                                : 'text-black/30 hover:text-black/50 focus:ring-black/20',
                            'focus:outline-none focus:ring-1',
                        )}
                        onClick={handleOpenTrace}
                    >
                        Trace my thinking
                    </button>
                </div>
            )}

            {/* Soft Confirmation Overlay */}
            {softConfirmation && (
                <div className="absolute bottom-20 left-1/2 -translate-x-1/2 transform z-50">
                    <div className={cn(
                        "px-6 py-4 rounded-xl shadow-lg border backdrop-blur-md transition-all duration-300",
                        isCurrentlyDark
                            ? "bg-black/40 border-white/10 text-white"
                            : "bg-white/60 border-black/5 text-slate-800"
                    )}>
                        <p className="text-sm font-medium mb-3">{softConfirmation.statement}</p>
                        <div className="flex gap-2 justify-center">
                            <button
                                onClick={() => endSession('clarity')}
                                className={cn(
                                    "px-3 py-1.5 text-xs rounded-md transition-colors",
                                    isCurrentlyDark
                                        ? "bg-white/10 hover:bg-white/20"
                                        : "bg-black/5 hover:bg-black/10"
                                )}
                            >
                                Yes, summarize
                            </button>
                            <button
                                onClick={() => setSoftConfirmation(null)}
                                className="px-3 py-1.5 text-xs opacity-50 hover:opacity-100 transition-opacity"
                            >
                                Not yet
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Escape Hatch (only in SILENT phase) */}
            {sessionPhase === 'SILENT' && (
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 transform z-40 animate-in fade-in duration-1000">
                    <button
                        onClick={() => reopenSession()}
                        className={cn(
                            "text-xs transition-colors duration-300",
                            isCurrentlyDark ? "text-white/20 hover:text-white/40" : "text-black/20 hover:text-black/40"
                        )}
                    >
                        I have more to say...
                    </button>
                </div>
            )}

            {/* Debug indicator */}
            {process.env.NODE_ENV === 'development' && (
                <div className="absolute top-4 left-4 z-50">
                    <span className={cn(
                        'rounded px-2 py-1 text-[10px]',
                        isCurrentlyDark
                            ? 'bg-white/10 text-white/40'
                            : 'bg-black/10 text-black/40',
                    )}>
                        {sessionPhase} | Nodes: {thoughtNodes.length} |
                        Satellites: {thoughtNodes.reduce((acc, n) => acc + n.satellites.length, 0)}
                    </span>
                </div>
            )}
        </div>
    );
}

export default memo(ThinkingField);
