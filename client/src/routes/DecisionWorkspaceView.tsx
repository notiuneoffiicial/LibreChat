/**
 * OptimismAI - Living Decision Surface
 * DecisionWorkspaceView - Route component for the decision surface
 *
 * Replaces ChatView when decision workspace mode is active.
 * Minimal wrapper — no sidebars, no header by default.
 */

import { memo, useEffect, useCallback, useState, useContext } from 'react';
import { useParams, useOutletContext } from 'react-router-dom';
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil';
import { Spinner, ThemeContext, isDark } from '@librechat/client';
import { Sun, Moon } from 'lucide-react';
import type { ContextType } from '~/common';
import {
    ThinkingField,
    TraceOverlay,
    LeaningIndicator,
    SessionEndingCard,
    CommandMenu,
    DecisionToolbar,
} from '~/components/DecisionSurface';
import Settings from '~/components/Nav/Settings';
import { useDecisionSession } from '~/hooks/DecisionSurface';
import { useAuthContext } from '~/hooks';
import store from '~/store';
import { cn } from '~/utils';

/**
 * Theme Toggle Button - switches between dark and light mode
 * Positioned in the bottom right corner of the decision workspace
 */
function ThemeToggleButton() {
    const { theme, setTheme } = useContext(ThemeContext);
    const isCurrentlyDark = isDark(theme);

    const toggleTheme = useCallback(() => {
        setTheme(isCurrentlyDark ? 'light' : 'dark');
    }, [isCurrentlyDark, setTheme]);

    return (
        <button
            onClick={toggleTheme}
            className={cn(
                'absolute bottom-4 right-4 z-50',
                'flex h-10 w-10 items-center justify-center',
                'rounded-full transition-all duration-300',
                'backdrop-blur-md',
                isCurrentlyDark
                    ? 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
                    : 'bg-black/10 text-black/70 hover:bg-black/20 hover:text-black',
                'shadow-lg',
                'focus:outline-none focus:ring-2 focus:ring-offset-2',
                isCurrentlyDark ? 'focus:ring-white/30' : 'focus:ring-black/30',
            )}
            aria-label={isCurrentlyDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
            {isCurrentlyDark ? (
                <Sun className="h-5 w-5" />
            ) : (
                <Moon className="h-5 w-5" />
            )}
        </button>
    );
}

/**
 * DecisionWorkspaceView - The living decision surface route
 *
 * Features:
 * - Full-screen ThinkingField
 * - Minimal top bar (thread title + menu)
 * - Trace overlay (hidden by default)
 * - Leaning indicator (when applicable)
 * - Session ending card
 */
function DecisionWorkspaceView() {
    const { sessionId } = useParams<{ sessionId?: string }>();
    const { isAuthenticated, user } = useAuthContext();
    const { setNavVisible } = useOutletContext<ContextType>();

    // Theme context
    const { theme } = useContext(ThemeContext);

    // Hide sidebar when entering decision workspace
    useEffect(() => {
        setNavVisible(false);
    }, [setNavVisible]);

    // State
    const [traceOpen, setTraceOpen] = useRecoilState(store.traceOverlayOpenAtom);
    const sessionEndingState = useRecoilValue(store.sessionEndingStateAtom);
    const setDecisionWorkspaceEnabled = useSetRecoilState(store.decisionWorkspaceEnabledAtom);
    const setSessionEndingState = useSetRecoilState(store.sessionEndingStateAtom);
    const setFieldSettling = useSetRecoilState(store.fieldSettlingAtom);

    // Session hook
    const { session, phase, milestones, leaning, initSession, endSession } = useDecisionSession();

    // Local state for ending card dismissal
    const [endingCardVisible, setEndingCardVisible] = useState(false);

    // Settings modal state
    const [settingsOpen, setSettingsOpen] = useState(false);

    // Show ending card when session ends
    useEffect(() => {
        if (sessionEndingState) {
            setEndingCardVisible(true);
        }
    }, [sessionEndingState]);

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
    const handleTraceToggle = useCallback(() => {
        setTraceOpen((prev) => !prev);
    }, [setTraceOpen]);

    // Handle trace jump
    const handleTraceJumpTo = useCallback(
        (milestoneId: string) => {
            console.log('[DecisionWorkspaceView] Jump to milestone:', milestoneId);
            // TODO: Implement jump-back behavior
            setTraceOpen(false);
        },
        [setTraceOpen],
    );

    // Handle ending card dismissal
    const handleEndingCardDismiss = useCallback(() => {
        setEndingCardVisible(false);
        setSessionEndingState(null);
        setFieldSettling(false);
    }, [setSessionEndingState, setFieldSettling]);

    // Generate ending message based on state
    const getEndingMessage = () => {
        const coreInsight = session?.insights?.[0] || 'You have explored this decision.';

        switch (sessionEndingState) {
            case 'clarity':
                return `You know what to do. ${coreInsight}`;
            case 'conditional_clarity':
                return `The path is clear, pending one thing. ${coreInsight}`;
            case 'rest':
                return `This decision needs time. Come back when you have more information.`;
            default:
                return coreInsight;
        }
    };

    // Get detail for conditional clarity
    const getEndingDetail = () => {
        if (sessionEndingState !== 'conditional_clarity') return undefined;
        const firstAssumption = session?.assumptions?.find((a) => !a.resolved);
        return firstAssumption?.text || 'Test your key assumption first.';
    };

    // Get next step suggestion
    const getNextStep = () => {
        if (!leaning) return undefined;
        switch (sessionEndingState) {
            case 'clarity':
                return `Take action: ${leaning.direction}`;
            case 'conditional_clarity':
                return 'Validate the condition, then decide.';
            case 'rest':
                return 'Schedule a reminder to revisit this.';
            default:
                return undefined;
        }
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
        <div
            className="relative flex h-full w-full flex-col overflow-hidden"
            onClick={endingCardVisible ? handleEndingCardDismiss : undefined}
        >
            {/* Left toolbar */}
            <DecisionToolbar
                onNewDecision={() => {
                    console.log('[DecisionWorkspaceView] New decision requested');
                    // TODO: Reset session
                }}
                onOpenFiles={() => {
                    console.log('[DecisionWorkspaceView] Files panel requested');
                    // TODO: Open files panel
                }}
                onOpenMemory={() => {
                    console.log('[DecisionWorkspaceView] Memory viewer requested');
                    // TODO: Open memory viewer
                }}
            />

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
                    <h1 className={cn(
                        'text-sm font-medium',
                        isDark(theme) ? 'text-white/50' : 'text-black/50',
                    )}>
                        {user?.name ? `${user.name}'s decision space` : 'Decision space'}
                    </h1>
                </div>

                {/* Right: Command Menu */}
                <div className="pointer-events-auto">
                    <CommandMenu
                        onOpenSettings={() => setSettingsOpen(true)}
                        onToggleTrace={handleTraceToggle}
                        onEndSession={() => setSessionEndingState('clarity')}
                        traceOpen={traceOpen}
                    />
                </div>
            </header>

            {/* Main thinking field */}
            <main className="flex-1">
                <ThinkingField sessionId={session?.id} conversationId={session?.conversationId} />
            </main>

            {/* Leaning indicator */}
            <LeaningIndicator
                leaning={leaning ?? undefined}
                visible={phase === 'SETTLING' || phase === 'SILENT'}
            />

            {/* Trace overlay */}
            <TraceOverlay
                milestones={milestones}
                onJumpTo={handleTraceJumpTo}
                isOpen={traceOpen}
                onToggle={handleTraceToggle}
            />

            {/* Session ending card */}
            {sessionEndingState && (
                <SessionEndingCard
                    endingState={sessionEndingState}
                    message={getEndingMessage()}
                    detail={getEndingDetail()}
                    nextStep={getNextStep()}
                    visible={endingCardVisible}
                />
            )}

            {/* Phase indicator (dev mode) */}
            {process.env.NODE_ENV === 'development' && (
                <div className="absolute bottom-14 right-4 z-50">
                    <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] text-white/40">
                        Phase: {phase}
                    </span>
                </div>
            )}

            {/* Dark/Light Mode Toggle */}
            <ThemeToggleButton />

            {/* Settings modal */}
            <Settings open={settingsOpen} onOpenChange={setSettingsOpen} />
        </div>
    );
}

export default memo(DecisionWorkspaceView);
