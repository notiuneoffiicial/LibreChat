/**
 * OptimismAI - Session History Panel
 * Slide-in panel for viewing and managing decision session history
 */

import { memo, useCallback, useContext, useState } from 'react';
import { animated, useSpring } from '@react-spring/web';
import { X, Trash2, Clock, CheckCircle, PauseCircle, Play } from 'lucide-react';
import { ThemeContext, isDark } from '@librechat/client';
import { cn } from '~/utils';
import type { SessionSummary } from '~/store/decisionSession';

interface SessionHistoryPanelProps {
    isOpen: boolean;
    sessions: SessionSummary[];
    activeSessionId: string | null;
    isLoading: boolean;
    onClose: () => void;
    onSelectSession: (sessionId: string) => void;
    onDeleteSession: (sessionId: string) => void;
    onNewSession: () => void;
}

/**
 * Format relative time for display
 */
function formatRelativeTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
}

/**
 * Get phase icon and color
 */
function getPhaseDisplay(phase: string, endingState?: string): { icon: React.ReactNode; label: string; color: string } {
    if (endingState === 'clarity') {
        return { icon: <CheckCircle size={12} />, label: 'Clarity reached', color: 'text-green-500' };
    }
    if (endingState === 'conditional_clarity') {
        return { icon: <CheckCircle size={12} />, label: 'Conditional clarity', color: 'text-yellow-500' };
    }
    if (endingState === 'rest') {
        return { icon: <PauseCircle size={12} />, label: 'Needs rest', color: 'text-blue-500' };
    }

    switch (phase) {
        case 'EXPLORING':
            return { icon: <Play size={12} />, label: 'Exploring', color: 'text-purple-400' };
        case 'SETTLING':
            return { icon: <Clock size={12} />, label: 'Settling', color: 'text-orange-400' };
        case 'SILENT':
            return { icon: <CheckCircle size={12} />, label: 'Complete', color: 'text-green-400' };
        default:
            return { icon: <Clock size={12} />, label: 'In progress', color: 'text-gray-400' };
    }
}

function SessionHistoryPanel({
    isOpen,
    sessions,
    activeSessionId,
    isLoading,
    onClose,
    onSelectSession,
    onDeleteSession,
    onNewSession,
}: SessionHistoryPanelProps) {
    const { theme } = useContext(ThemeContext);
    const isCurrentlyDark = isDark(theme);
    const [hoveredId, setHoveredId] = useState<string | null>(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

    // Slide-in animation
    const slideSpring = useSpring({
        transform: isOpen ? 'translateX(0%)' : 'translateX(-100%)',
        opacity: isOpen ? 1 : 0,
        config: { tension: 280, friction: 26 },
    });

    // Handle session click
    const handleSessionClick = useCallback((sessionId: string) => {
        if (sessionId !== activeSessionId) {
            onSelectSession(sessionId);
        }
    }, [activeSessionId, onSelectSession]);

    // Handle delete with confirmation
    const handleDeleteClick = useCallback((e: React.MouseEvent, sessionId: string) => {
        e.stopPropagation();
        if (deleteConfirmId === sessionId) {
            onDeleteSession(sessionId);
            setDeleteConfirmId(null);
        } else {
            setDeleteConfirmId(sessionId);
            // Reset confirm after 3 seconds
            setTimeout(() => setDeleteConfirmId(null), 3000);
        }
    }, [deleteConfirmId, onDeleteSession]);

    return (
        <animated.div
            style={slideSpring}
            className={cn(
                'fixed left-0 top-0 bottom-0 z-50',
                'w-80 max-w-[85vw]',
                'flex flex-col',
                'backdrop-blur-xl shadow-2xl',
                isCurrentlyDark
                    ? 'bg-black/80 border-r border-white/10'
                    : 'bg-white/90 border-r border-black/10',
            )}
        >
            {/* Header */}
            <div className={cn(
                'flex items-center justify-between px-4 py-3 border-b',
                isCurrentlyDark ? 'border-white/10' : 'border-black/10',
            )}>
                <h2 className={cn(
                    'text-sm font-medium',
                    isCurrentlyDark ? 'text-white/80' : 'text-black/80',
                )}>
                    Session History
                </h2>
                <button
                    onClick={onClose}
                    className={cn(
                        'p-1.5 rounded-md transition-colors',
                        isCurrentlyDark
                            ? 'text-white/40 hover:text-white/70 hover:bg-white/10'
                            : 'text-black/40 hover:text-black/70 hover:bg-black/10',
                    )}
                >
                    <X size={18} />
                </button>
            </div>

            {/* New Session Button */}
            <div className="px-3 py-2">
                <button
                    onClick={onNewSession}
                    className={cn(
                        'w-full px-3 py-2 rounded-lg text-sm font-medium',
                        'transition-colors duration-150',
                        isCurrentlyDark
                            ? 'bg-white/10 text-white/80 hover:bg-white/20'
                            : 'bg-black/5 text-black/80 hover:bg-black/10',
                    )}
                >
                    + New Decision
                </button>
            </div>

            {/* Session List */}
            <div className="flex-1 overflow-y-auto px-2 py-1">
                {isLoading ? (
                    <div className={cn(
                        'flex items-center justify-center py-8',
                        isCurrentlyDark ? 'text-white/40' : 'text-black/40',
                    )}>
                        <span className="text-sm">Loading...</span>
                    </div>
                ) : sessions.length === 0 ? (
                    <div className={cn(
                        'flex flex-col items-center justify-center py-8 px-4 text-center',
                        isCurrentlyDark ? 'text-white/40' : 'text-black/40',
                    )}>
                        <Clock size={24} className="mb-2 opacity-50" />
                        <span className="text-sm">No sessions yet</span>
                        <span className="text-xs mt-1 opacity-70">Start a decision to see it here</span>
                    </div>
                ) : (
                    sessions.map((session) => {
                        const isActive = session.sessionId === activeSessionId;
                        const isHovered = hoveredId === session.sessionId;
                        const phaseDisplay = getPhaseDisplay(session.phase, session.endingState);

                        return (
                            <div
                                key={session.sessionId}
                                onClick={() => handleSessionClick(session.sessionId)}
                                onMouseEnter={() => setHoveredId(session.sessionId)}
                                onMouseLeave={() => setHoveredId(null)}
                                className={cn(
                                    'relative px-3 py-2.5 my-1 rounded-lg cursor-pointer',
                                    'transition-all duration-150',
                                    isActive
                                        ? isCurrentlyDark
                                            ? 'bg-white/15 border border-white/20'
                                            : 'bg-black/10 border border-black/15'
                                        : isCurrentlyDark
                                            ? 'hover:bg-white/5'
                                            : 'hover:bg-black/5',
                                )}
                            >
                                {/* Title */}
                                <h3 className={cn(
                                    'text-sm font-medium truncate pr-6',
                                    isActive
                                        ? isCurrentlyDark ? 'text-white' : 'text-black'
                                        : isCurrentlyDark ? 'text-white/70' : 'text-black/70',
                                )}>
                                    {session.title || 'Untitled Decision'}
                                </h3>

                                {/* Metadata row */}
                                <div className={cn(
                                    'flex items-center gap-2 mt-1 text-xs',
                                    isCurrentlyDark ? 'text-white/40' : 'text-black/40',
                                )}>
                                    <span>{formatRelativeTime(session.updatedAt)}</span>
                                    <span>•</span>
                                    <span className={cn('flex items-center gap-1', phaseDisplay.color)}>
                                        {phaseDisplay.icon}
                                        {phaseDisplay.label}
                                    </span>
                                </div>

                                {/* Active indicator */}
                                {isActive && (
                                    <div className={cn(
                                        'absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r',
                                        isCurrentlyDark ? 'bg-white/60' : 'bg-black/60',
                                    )} />
                                )}

                                {/* Delete button (on hover, not for active) */}
                                {isHovered && !isActive && (
                                    <button
                                        onClick={(e) => handleDeleteClick(e, session.sessionId)}
                                        className={cn(
                                            'absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded',
                                            'transition-colors',
                                            deleteConfirmId === session.sessionId
                                                ? 'bg-red-500/20 text-red-500'
                                                : isCurrentlyDark
                                                    ? 'text-white/30 hover:text-red-400 hover:bg-white/10'
                                                    : 'text-black/30 hover:text-red-500 hover:bg-black/10',
                                        )}
                                        title={deleteConfirmId === session.sessionId ? 'Click again to confirm' : 'Delete session'}
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </animated.div>
    );
}

export default memo(SessionHistoryPanel);
