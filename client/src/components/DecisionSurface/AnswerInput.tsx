/**
 * OptimismAI - Living Decision Surface
 * AnswerInput - Panel for answering a selected question node
 *
 * Appears when a node is selected (ACTIVE state).
 * Enables focused, one-at-a-time answering.
 */

import { memo, useCallback, useRef, useState, useEffect } from 'react';
import { animated, useSpring } from '@react-spring/web';
import { Send, X } from 'lucide-react';
import { TextareaAutosize } from '@librechat/client';
import { cn, removeFocusRings } from '~/utils';
import type { ThoughtNodeData } from '~/common/DecisionSession.types';

interface AnswerInputProps {
    /** The active node being answered */
    node: ThoughtNodeData | null;
    /** Called when user submits an answer */
    onSubmit: (nodeId: string, answer: string) => void;
    /** Called when user dismisses without answering */
    onDismiss: () => void;
    /** Whether answer is being processed */
    isProcessing?: boolean;
}

/**
 * Topic-specific prompts to guide the user
 */
const TOPIC_HINTS: Record<string, string> = {
    reality: 'Share the facts, constraints, or resources you know...',
    values: 'Describe what feels right or wrong about this...',
    options: 'List any alternatives or variations you can think of...',
};

/**
 * AnswerInput - Focused answer panel
 *
 * Visual characteristics:
 * - Slides up from bottom when a node is active
 * - Shows the question being answered
 * - Minimal, focused input area
 * - Submit sends answer to processing
 */
function AnswerInput({
    node,
    onSubmit,
    onDismiss,
    isProcessing = false,
}: AnswerInputProps) {
    const textAreaRef = useRef<HTMLTextAreaElement>(null);
    const [value, setValue] = useState('');

    // Reset value when node changes
    useEffect(() => {
        setValue('');
        if (node && textAreaRef.current) {
            textAreaRef.current.focus();
        }
    }, [node?.id]);

    // Slide-up animation
    const [spring] = useSpring(() => ({
        opacity: node ? 1 : 0,
        y: node ? 0 : 100,
        config: { tension: 200, friction: 25 },
    }), [node]);

    // Handle submit
    const handleSubmit = useCallback(() => {
        if (!node || !value.trim() || isProcessing) return;
        onSubmit(node.id, value.trim());
        setValue('');
    }, [node, value, isProcessing, onSubmit]);

    // Handle key down
    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
            }
            if (e.key === 'Escape') {
                onDismiss();
            }
        },
        [handleSubmit, onDismiss],
    );

    if (!node) return null;

    return (
        <animated.div
            className={cn(
                'fixed bottom-0 left-0 right-0 z-40',
                'pointer-events-auto',
            )}
            style={{
                opacity: spring.opacity,
                transform: spring.y.to((y) => `translateY(${y}%)`),
            }}
        >
            {/* Panel */}
            <div
                className={cn(
                    'mx-auto max-w-2xl',
                    'rounded-t-2xl px-6 py-5',
                    'bg-surface-primary/95 backdrop-blur-xl',
                    'border border-white/10 border-b-0',
                    'shadow-2xl',
                )}
            >
                {/* Header with question */}
                <div className="mb-4 flex items-start justify-between gap-4">
                    <div className="flex-1">
                        {/* Topic badge */}
                        <span
                            className={cn(
                                'inline-block rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider',
                                'bg-white/10 text-white/60 mb-2',
                            )}
                        >
                            {node.topicKey}
                        </span>
                        {/* Question */}
                        <p className="text-sm font-medium text-white/90 leading-relaxed">
                            {node.question}
                        </p>
                    </div>

                    {/* Dismiss button */}
                    <button
                        onClick={onDismiss}
                        className={cn(
                            'flex-shrink-0 p-1.5 rounded-full',
                            'text-white/40 hover:text-white/60',
                            'hover:bg-white/10',
                            'transition-colors duration-150',
                        )}
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Input area */}
                <div
                    className={cn(
                        'relative flex items-end gap-3',
                        'rounded-xl border px-4 py-3',
                        'bg-white/5',
                        'border-white/10 focus-within:border-white/20',
                        'transition-colors duration-200',
                    )}
                >
                    <TextareaAutosize
                        ref={textAreaRef}
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={TOPIC_HINTS[node.topicKey] || 'Type your response...'}
                        disabled={isProcessing}
                        rows={2}
                        maxRows={6}
                        className={cn(
                            'flex-1 resize-none bg-transparent',
                            'text-white/90 placeholder-white/40',
                            'text-sm leading-relaxed',
                            removeFocusRings,
                            'disabled:cursor-not-allowed disabled:opacity-50',
                        )}
                    />

                    {/* Submit button */}
                    <button
                        onClick={handleSubmit}
                        disabled={!value.trim() || isProcessing}
                        className={cn(
                            'flex-shrink-0 p-2 rounded-lg',
                            'transition-all duration-150',
                            value.trim() && !isProcessing
                                ? 'bg-white/20 text-white hover:bg-white/30'
                                : 'bg-white/5 text-white/30 cursor-not-allowed',
                        )}
                    >
                        <Send className="h-4 w-4" />
                    </button>
                </div>

                {/* Processing indicator */}
                {isProcessing && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-white/50">
                        <div className="h-2 w-2 rounded-full bg-white/40 animate-pulse" />
                        Processing your response...
                    </div>
                )}

                {/* Hint */}
                <p className="mt-3 text-[10px] text-white/30">
                    Press Enter to submit • Shift+Enter for new line • Esc to dismiss
                </p>
            </div>
        </animated.div>
    );
}

export default memo(AnswerInput);
