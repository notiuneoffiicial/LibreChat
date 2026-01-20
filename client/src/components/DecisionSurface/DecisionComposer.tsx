import { memo, useCallback, useRef, useState, useEffect, useContext } from 'react';
import { animated, useSpring } from '@react-spring/web';
import { TextareaAutosize, ThemeContext, isDark } from '@librechat/client';
import { Paperclip, Mic } from 'lucide-react';
import { cn, removeFocusRings } from '~/utils';
import { COMPOSER } from './nodeMotionConfig';
import type { DecisionComposerProps } from '~/common/DecisionSession.types';

/**
 * DecisionComposer - The centered thought input
 *
 * Visual characteristics:
 * - Pill-shaped, centered on the field
 * - Minimal icons (attach/mic, muted initially)
 * - Glides down 64px on submit
 * - Compresses slightly as micro-feedback
 */
function DecisionComposer({
    onSubmit,
    placeholder = 'What are you deciding?',
    isSubmitting,
    hasSubmitted,
    animateIn = false,
    anchorPosition,
}: DecisionComposerProps) {
    const textAreaRef = useRef<HTMLTextAreaElement>(null);
    const [value, setValue] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    const [hasAnimatedIn, setHasAnimatedIn] = useState(!animateIn);

    // Theme context for dark/light mode
    const { theme } = useContext(ThemeContext);
    const isCurrentlyDark = isDark(theme);

    // Spring animation for position and scale
    const [springStyle, api] = useSpring(() => ({
        y: 0,
        scale: animateIn ? 0.95 : 1,
        opacity: animateIn ? 0 : 1,
        config: {
            tension: 180,
            friction: 24,
        },
    }));

    // Entrance animation effect
    useEffect(() => {
        if (animateIn && !hasAnimatedIn) {
            // Delay slightly for smoother transition after button fades
            const timer = setTimeout(() => {
                api.start({
                    scale: 1,
                    opacity: 1,
                    config: { tension: 200, friction: 20 },
                    onRest: () => {
                        setHasAnimatedIn(true);
                        // Focus input after animation
                        textAreaRef.current?.focus();
                    },
                });
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [animateIn, hasAnimatedIn, api]);

    // Handle submit with animation
    const handleSubmit = useCallback(
        (e?: React.FormEvent) => {
            e?.preventDefault();

            if (!value.trim() || isSubmitting) return;

            // Micro-compression feedback
            api.start({
                scale: 0.98,
                config: { tension: 300, friction: 10 },
            });

            // Then glide down
            setTimeout(() => {
                api.start({
                    y: COMPOSER.GLIDE_DOWN_DISTANCE,
                    scale: 1,
                    config: {
                        tension: 180,
                        friction: 24,
                    },
                });
            }, 80);

            // Submit after animation starts
            setTimeout(() => {
                onSubmit(value.trim());
                setValue('');
            }, 100);
        },
        [value, isSubmitting, api, onSubmit],
    );

    // Handle key down
    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
            }
        },
        [handleSubmit],
    );

    // Calculate position based on anchor or fallback to center
    const positionStyle = anchorPosition
        ? {
            left: `${anchorPosition.x}px`,
            top: hasSubmitted ? `${anchorPosition.y + 32}px` : `${anchorPosition.y - 24}px`,
            transform: 'translate(-50%, 0)',
        }
        : {
            left: '50%',
            top: hasSubmitted ? 'calc(50% + 32px)' : 'calc(50% - 24px)',
            transform: 'translate(-50%, 0)',
        };

    return (
        <animated.div
            className="absolute"
            style={{
                ...positionStyle,
                y: springStyle.y,
                scale: springStyle.scale,
                opacity: springStyle.opacity,
                transition: 'top 0.3s ease-out, left 0.3s ease-out',
            }}
        >
            <form onSubmit={handleSubmit}>
                <div
                    className={cn(
                        'relative flex items-center gap-2',
                        'rounded-full border px-4 py-3',
                        'backdrop-blur-md',
                        'transition-all duration-200',
                        isCurrentlyDark
                            ? 'bg-white/5 border-white/10'
                            : 'bg-white/80 border-black/10',
                        isFocused
                            ? isCurrentlyDark
                                ? 'border-white/20 shadow-lg shadow-white/5'
                                : 'border-black/20 shadow-lg shadow-black/5'
                            : isCurrentlyDark
                                ? 'shadow-md shadow-white/2'
                                : 'shadow-md shadow-black/5',
                        'min-w-[320px] max-w-[480px]',
                    )}
                >
                    <button
                        type="button"
                        className={cn(
                            'flex-shrink-0 p-1.5 rounded-full',
                            'transition-colors duration-150',
                            isCurrentlyDark
                                ? 'text-white/30 hover:text-white/50 focus:ring-white/20'
                                : 'text-black/30 hover:text-black/50 focus:ring-black/20',
                            'focus:outline-none focus:ring-1',
                        )}
                        tabIndex={-1}
                    >
                        <Paperclip className="h-4 w-4" />
                    </button>

                    {/* Text input */}
                    <TextareaAutosize
                        ref={textAreaRef}
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onFocus={() => setIsFocused(true)}
                        onBlur={() => setIsFocused(false)}
                        placeholder={placeholder}
                        disabled={isSubmitting}
                        rows={1}
                        maxRows={4}
                        className={cn(
                            'flex-1 resize-none bg-transparent',
                            isCurrentlyDark
                                ? 'text-white/90 placeholder-white/40'
                                : 'text-black/90 placeholder-black/40',
                            'text-sm leading-relaxed',
                            removeFocusRings,
                            'disabled:cursor-not-allowed disabled:opacity-50',
                        )}
                        style={{ minHeight: '24px' }}
                    />

                    <button
                        type="button"
                        className={cn(
                            'flex-shrink-0 p-1.5 rounded-full',
                            'transition-colors duration-150',
                            isCurrentlyDark
                                ? 'text-white/30 hover:text-white/50 focus:ring-white/20'
                                : 'text-black/30 hover:text-black/50 focus:ring-black/20',
                            'focus:outline-none focus:ring-1',
                        )}
                        tabIndex={-1}
                    >
                        <Mic className="h-4 w-4" />
                    </button>

                    {value.trim() && !isSubmitting && (
                        <div
                            className={cn(
                                'absolute -right-1 -top-1',
                                'h-2 w-2 rounded-full',
                                isCurrentlyDark ? 'bg-white/30' : 'bg-black/30',
                                'animate-pulse',
                            )}
                        />
                    )}
                </div>
            </form>
        </animated.div>
    );
}

export default memo(DecisionComposer);
