/**
 * OptimismAI - Living Decision Surface
 * SessionEndingCard - Visual closure when a decision session ends
 *
 * "A session ends in one of three felt states:
 * Clarity, Conditional clarity, or Rest"
 */

import { memo } from 'react';
import { animated, useSpring } from '@react-spring/web';
import { CheckCircle, AlertCircle, Moon } from 'lucide-react';
import { cn } from '~/utils';

type EndingState = 'clarity' | 'conditional_clarity' | 'rest';

interface SessionEndingCardProps {
    /** The ending state type */
    endingState: EndingState;
    /** Primary message */
    message: string;
    /** Secondary detail (e.g., condition for conditional_clarity) */
    detail?: string;
    /** Next step suggestion */
    nextStep?: string;
    /** Whether visible */
    visible: boolean;
}

const ENDING_CONFIG: Record<EndingState, {
    icon: typeof CheckCircle;
    iconColor: string;
    bgGradient: string;
    title: string;
}> = {
    clarity: {
        icon: CheckCircle,
        iconColor: 'text-emerald-400',
        bgGradient: 'from-emerald-500/10 to-transparent',
        title: 'Clarity reached',
    },
    conditional_clarity: {
        icon: AlertCircle,
        iconColor: 'text-amber-400',
        bgGradient: 'from-amber-500/10 to-transparent',
        title: 'Conditional clarity',
    },
    rest: {
        icon: Moon,
        iconColor: 'text-blue-400',
        bgGradient: 'from-blue-500/10 to-transparent',
        title: 'Time to rest',
    },
};

/**
 * SessionEndingCard - Gentle closure for a thinking session
 */
function SessionEndingCard({
    endingState,
    message,
    detail,
    nextStep,
    visible,
}: SessionEndingCardProps) {
    const config = ENDING_CONFIG[endingState];
    const Icon = config.icon;

    // Appearance animation
    const [spring] = useSpring(() => ({
        opacity: visible ? 1 : 0,
        y: visible ? 0 : 20,
        config: { tension: 120, friction: 14 },
    }), [visible]);

    if (!visible) return null;

    return (
        <animated.div
            className="fixed inset-0 flex items-center justify-center z-40 p-4"
            style={{
                opacity: spring.opacity,
            }}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

            {/* Card */}
            <animated.div
                className={cn(
                    'relative max-w-md w-full',
                    'rounded-3xl p-8',
                    'bg-surface-primary/95 backdrop-blur-xl',
                    'border border-white/10',
                    'shadow-2xl',
                )}
                style={{ y: spring.y }}
            >
                {/* Gradient accent */}
                <div
                    className={cn(
                        'absolute inset-0 rounded-3xl opacity-50',
                        `bg-gradient-to-br ${config.bgGradient}`,
                    )}
                />

                {/* Content */}
                <div className="relative flex flex-col items-center text-center">
                    {/* Icon */}
                    <div className={cn(
                        'flex items-center justify-center',
                        'h-14 w-14 rounded-full',
                        'bg-white/10 mb-4',
                    )}>
                        <Icon className={cn('h-7 w-7', config.iconColor)} />
                    </div>

                    {/* Title */}
                    <h2 className="text-lg font-medium text-white/90 mb-2">
                        {config.title}
                    </h2>

                    {/* Message */}
                    <p className="text-sm text-white/70 leading-relaxed mb-4">
                        {message}
                    </p>

                    {/* Detail (for conditional clarity) */}
                    {detail && (
                        <div className="w-full rounded-xl bg-white/5 p-4 mb-4">
                            <p className="text-xs text-white/50 uppercase tracking-wider mb-1">
                                {endingState === 'conditional_clarity' ? 'If this is confirmed' : 'Note'}
                            </p>
                            <p className="text-sm text-white/80">{detail}</p>
                        </div>
                    )}

                    {/* Next step */}
                    {nextStep && (
                        <div className="w-full pt-4 border-t border-white/10">
                            <p className="text-xs text-white/40 mb-2">Suggested next step</p>
                            <p className="text-sm font-medium text-white/90">{nextStep}</p>
                        </div>
                    )}

                    {/* Close hint */}
                    <p className="mt-6 text-[10px] text-white/30">
                        Click anywhere to continue
                    </p>
                </div>
            </animated.div>
        </animated.div>
    );
}

export default memo(SessionEndingCard);
