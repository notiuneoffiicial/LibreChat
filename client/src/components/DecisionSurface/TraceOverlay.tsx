/**
 * OptimismAI - Living Decision Surface
 * TraceOverlay - Timeline of thinking moments
 *
 * "Timeline is hidden by default... reinforces trust without polluting the present"
 */

import { memo, useCallback } from 'react';
import { animated, useSpring, useTransition } from '@react-spring/web';
import { X, Clock, Lightbulb, Ban, CheckCircle, GitMerge, TrendingUp } from 'lucide-react';
import { cn } from '~/utils';
import type { TraceOverlayProps, MilestoneType } from '~/common/DecisionSession.types';

/**
 * Icon mapping for milestone types
 */
const MILESTONE_ICONS: Record<MilestoneType, typeof Clock> = {
    constraint_identified: Clock,
    option_removed: Ban,
    assumption_resolved: CheckCircle,
    insight_formed: Lightbulb,
    nodes_merged: GitMerge,
    leaning_shifted: TrendingUp,
};

/**
 * Label mapping for milestone types
 */
const MILESTONE_LABELS: Record<MilestoneType, string> = {
    constraint_identified: 'Constraint identified',
    option_removed: 'Option removed',
    assumption_resolved: 'Assumption resolved',
    insight_formed: 'Insight formed',
    nodes_merged: 'Paths merged',
    leaning_shifted: 'Leaning shifted',
};

/**
 * TraceOverlay - The thinking timeline
 *
 * Visual characteristics:
 * - Hidden by default, thin affordance at bottom
 * - When opened, overlays the surface
 * - Shows moments, not messages
 * - Click to jump back to that state
 */
function TraceOverlay({ milestones, onJumpTo, isOpen, onToggle }: TraceOverlayProps) {
    // Overlay animation
    const [overlaySpring] = useSpring(
        () => ({
            opacity: isOpen ? 1 : 0,
            y: isOpen ? 0 : 100,
            config: {
                tension: 200,
                friction: 25,
            },
        }),
        [isOpen],
    );

    // Milestone transitions for staggered appearance
    const milestoneTransitions = useTransition(isOpen ? milestones : [], {
        keys: (item) => item.id,
        from: { opacity: 0, x: -20 },
        enter: { opacity: 1, x: 0 },
        leave: { opacity: 0, x: 20 },
        trail: 50,
        config: { tension: 200, friction: 20 },
    });

    // Handle milestone click
    const handleMilestoneClick = useCallback(
        (milestoneId: string) => {
            onJumpTo(milestoneId);
        },
        [onJumpTo],
    );

    // Format timestamp
    const formatTime = useCallback((timestamp: number) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }, []);

    if (!isOpen && milestones.length === 0) {
        return null;
    }

    return (
        <>
            {/* Overlay backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
                    onClick={onToggle}
                />
            )}

            {/* Trace panel */}
            <animated.div
                className={cn(
                    'fixed bottom-0 left-0 right-0 z-50',
                    'rounded-t-2xl',
                    'bg-surface-primary/95 backdrop-blur-md',
                    'border-t border-white/10',
                    'shadow-2xl',
                    'max-h-[60vh] overflow-hidden',
                )}
                style={{
                    opacity: overlaySpring.opacity,
                    transform: overlaySpring.y.to((y) => `translateY(${y}%)`),
                    pointerEvents: isOpen ? 'auto' : 'none',
                }}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
                    <h2 className="text-sm font-medium text-white/90">Thinking Trace</h2>
                    <button
                        onClick={onToggle}
                        className={cn(
                            'p-1.5 rounded-full',
                            'text-white/50 hover:text-white/80',
                            'hover:bg-white/10',
                            'transition-colors duration-150',
                        )}
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Milestones list */}
                <div className="overflow-y-auto max-h-[calc(60vh-60px)] py-4">
                    {milestones.length === 0 ? (
                        <div className="px-6 py-8 text-center text-white/40 text-sm">
                            No milestones yet. Start exploring to create your thinking trace.
                        </div>
                    ) : (
                        <div className="relative px-6">
                            {/* Timeline line */}
                            <div className="absolute left-9 top-0 bottom-0 w-px bg-white/10" />

                            {/* Milestone items */}
                            {milestoneTransitions((style, milestone) => {
                                const Icon = MILESTONE_ICONS[milestone.type];
                                const label = MILESTONE_LABELS[milestone.type];

                                return (
                                    <animated.div
                                        key={milestone.id}
                                        style={style}
                                        className={cn(
                                            'relative flex items-start gap-4 py-3',
                                            'cursor-pointer',
                                            'hover:bg-white/5 -mx-4 px-4 rounded-lg',
                                            'transition-colors duration-150',
                                        )}
                                        onClick={() => handleMilestoneClick(milestone.id)}
                                    >
                                        {/* Icon */}
                                        <div
                                            className={cn(
                                                'relative z-10 flex items-center justify-center',
                                                'h-6 w-6 rounded-full',
                                                'bg-white/10',
                                            )}
                                        >
                                            <Icon className="h-3 w-3 text-white/60" />
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-xs font-medium text-white/70">
                                                    {label}
                                                </span>
                                                <span className="text-[10px] text-white/40">
                                                    {formatTime(milestone.timestamp)}
                                                </span>
                                            </div>
                                            <p className="mt-0.5 text-sm text-white/90 truncate">
                                                {milestone.label}
                                            </p>
                                        </div>
                                    </animated.div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </animated.div>
        </>
    );
}

export default memo(TraceOverlay);
