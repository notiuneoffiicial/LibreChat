/**
 * OptimismAI - Living Decision Surface
 * DecisionWorkspaceView - Route component for the decision surface
 *
 * Replaces ChatView when decision workspace mode is active.
 * Minimal wrapper — no sidebars, no header by default.
 */

import { memo, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useRecoilState, useSetRecoilState } from 'recoil';
import { Spinner } from '@librechat/client';
import { ThinkingField, TraceOverlay, LeaningIndicator } from '~/components/DecisionSurface';
import { useDecisionSession } from '~/hooks/DecisionSurface';
import { useAuthContext } from '~/hooks';
import store from '~/store';
import { cn } from '~/utils';

/**
 * DecisionWorkspaceView - The living decision surface route
 *
 * Features:
 * - Full-screen ThinkingField
 * - Minimal top bar (thread title + menu)
 * - Trace overlay (hidden by default)
 * - Leaning indicator (when applicable)
 */
function DecisionWorkspaceView() {
    const { sessionId } = useParams<{ sessionId?: string }>();
    const { isAuthenticated, user } = useAuthContext();

    // State
    const [traceOpen, setTraceOpen] = useRecoilState(store.traceOverlayOpenAtom);
    const leaningVisible = store.leaningVisibleSelector;
    const setDecisionWorkspaceEnabled = useSetRecoilState(store.decisionWorkspaceEnabledAtom);

    // Session hook
    const { session, phase, milestones, leaning, initSession } = useDecisionSession();

    // Initialize session on mount if needed
    useEffect(() => {
        setDecisionWorkspaceEnabled(true);

        // If no session exists, create one
        if (!session && isAuthenticated) {
            const convoId = sessionId || `decision-${Date.now()}`;
            initSession(convoId);
        }

        return () => {
            setDecisionWorkspaceEnabled(false);
        };
    }, [session, sessionId, isAuthenticated, initSession, setDecisionWorkspaceEnabled]);

    // Handle trace toggle
    const handleTraceToggle = () => {
        setTraceOpen((prev) => !prev);
    };

    // Handle trace jump
    const handleTraceJumpTo = (milestoneId: string) => {
        console.log('[DecisionWorkspaceView] Jump to milestone:', milestoneId);
        // TODO: Implement jump-back behavior
        setTraceOpen(false);
    };

    // Loading state
    if (!isAuthenticated) {
        return (
            <div className="flex h-full min-h-screen items-center justify-center bg-surface-primary">
                <Spinner className="text-text-secondary" />
            </div>
        );
    }

    return (
        <div className="relative flex h-full w-full flex-col overflow-hidden">
            {/* Minimal header */}
            <header
                className={cn(
                    'absolute left-0 right-0 top-0 z-30',
                    'flex items-center justify-between px-4 py-3',
                    'pointer-events-none',
                )}
            >
                {/* Left: User greeting or session title */}
                <div className="pointer-events-auto">
                    <h1 className="text-sm font-medium text-white/50">
                        {user?.name ? `${user.name}'s decision space` : 'Decision space'}
                    </h1>
                </div>

                {/* Right: Menu (placeholder) */}
                <div className="pointer-events-auto">
                    <button
                        className={cn(
                            'p-2 rounded-full',
                            'text-white/40 hover:text-white/60',
                            'hover:bg-white/5',
                            'transition-colors duration-150',
                        )}
                        title="Menu"
                    >
                        <svg
                            className="h-5 w-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1.5}
                                d="M4 6h16M4 12h16M4 18h16"
                            />
                        </svg>
                    </button>
                </div>
            </header>

            {/* Main thinking field */}
            <main className="flex-1">
                <ThinkingField
                    sessionId={session?.id}
                    conversationId={session?.conversationId}
                />
            </main>

            {/* Leaning indicator */}
            <LeaningIndicator leaning={leaning ?? undefined} visible={phase === 'SYNTHESIS' || phase === 'CONVERGENCE'} />

            {/* Trace overlay */}
            <TraceOverlay
                milestones={milestones}
                onJumpTo={handleTraceJumpTo}
                isOpen={traceOpen}
                onToggle={handleTraceToggle}
            />

            {/* Phase indicator (dev mode) */}
            {process.env.NODE_ENV === 'development' && (
                <div className="absolute bottom-4 right-4 z-50">
                    <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] text-white/40">
                        Phase: {phase}
                    </span>
                </div>
            )}
        </div>
    );
}

export default memo(DecisionWorkspaceView);
