/**
 * OptimismAI - Living Decision Surface
 * DecisionComposer - The centered input that "feels like thought"
 *
 * Minimal, centered input that glides down on submit
 * and triggers the field "breathe" effect.
 */

import { memo, useCallback, useRef, useState } from 'react';
import { animated, useSpring } from '@react-spring/web';
import { TextareaAutosize } from '@librechat/client';
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
}: DecisionComposerProps) {
    const textAreaRef = useRef<HTMLTextAreaElement>(null);
    const [value, setValue] = useState('');
    const [isFocused, setIsFocused] = useState(false);

    // Spring animation for position and scale
    const [springStyle, api] = useSpring(() => ({
        y: 0,
        scale: 1,
        config: {
            tension: 180,
            friction: 24,
        },
    }));

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

    return (
        <animated.div
            className="absolute left-1/2 -translate-x-1/2"
            style={{
                top: hasSubmitted ? 'calc(50% + 32px)' : 'calc(50% - 24px)',
                y: springStyle.y,
                scale: springStyle.scale,
                transition: 'top 0.3s ease-out',
            }}
        >
            <form onSubmit={handleSubmit}>
                <div
                    className={cn(
                        'relative flex items-center gap-2',
                        'rounded-full border px-4 py-3',
                        'bg-white/5 backdrop-blur-md',
                        'transition-all duration-200',
                        isFocused
                            ? 'border-white/20 shadow-lg shadow-white/5'
                            : 'border-white/10 shadow-md shadow-white/2',
                        'min-w-[320px] max-w-[480px]',
                    )}
                >
                    {/* Attach icon (muted) */}
                    <button
                        type="button"
                        className={cn(
                            'flex-shrink-0 p-1.5 rounded-full',
                            'text-white/30 hover:text-white/50',
                            'transition-colors duration-150',
                            'focus:outline-none focus:ring-1 focus:ring-white/20',
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
                            'text-white/90 placeholder-white/40',
                            'text-sm leading-relaxed',
                            removeFocusRings,
                            'disabled:cursor-not-allowed disabled:opacity-50',
                        )}
                        style={{ minHeight: '24px' }}
                    />

                    {/* Mic icon (muted) */}
                    <button
                        type="button"
                        className={cn(
                            'flex-shrink-0 p-1.5 rounded-full',
                            'text-white/30 hover:text-white/50',
                            'transition-colors duration-150',
                            'focus:outline-none focus:ring-1 focus:ring-white/20',
                        )}
                        tabIndex={-1}
                    >
                        <Mic className="h-4 w-4" />
                    </button>

                    {/* Submit indicator (subtle) */}
                    {value.trim() && !isSubmitting && (
                        <div
                            className={cn(
                                'absolute -right-1 -top-1',
                                'h-2 w-2 rounded-full',
                                'bg-white/30',
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
