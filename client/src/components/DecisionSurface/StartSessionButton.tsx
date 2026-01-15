/**
 * OptimismAI - Living Decision Surface
 * StartSessionButton - The initial call-to-action when no session exists
 *
 * "A gentle invitation to begin thinking..."
 */

import { memo, useCallback, useState } from 'react';
import { animated, useSpring } from '@react-spring/web';
import { Plus } from 'lucide-react';
import { cn } from '~/utils';

interface StartSessionButtonProps {
    /** Called when the user clicks to start a session */
    onStart: () => void;
}

/**
 * StartSessionButton - The empty-state CTA
 *
 * Visual characteristics:
 * - Pill-shaped, centered on the field (matches DecisionComposer)
 * - Minimal, calm aesthetic
 * - Micro-scale feedback on click, then fades out
 */
function StartSessionButton({ onStart }: StartSessionButtonProps) {
    const [isPressed, setIsPressed] = useState(false);
    const [isExiting, setIsExiting] = useState(false);

    // Spring animation for press feedback and exit
    const [springStyle] = useSpring(
        () => ({
            scale: isPressed ? 0.97 : 1,
            opacity: isExiting ? 0 : 1,
            config: isExiting
                ? { tension: 200, friction: 20 }
                : { tension: 300, friction: 15 },
        }),
        [isPressed, isExiting],
    );

    // Handle click with animation sequence
    const handleClick = useCallback(() => {
        setIsPressed(true);

        // Release press and start exit
        setTimeout(() => {
            setIsPressed(false);
            setIsExiting(true);
        }, 80);

        // Trigger onStart after exit animation begins
        setTimeout(() => {
            onStart();
        }, 200);
    }, [onStart]);

    return (
        <animated.button
            type="button"
            onClick={handleClick}
            onMouseDown={() => setIsPressed(true)}
            onMouseUp={() => setIsPressed(false)}
            onMouseLeave={() => setIsPressed(false)}
            className={cn(
                'absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
                'flex items-center gap-3 px-6 py-4',
                'rounded-full border',
                'bg-white/5 backdrop-blur-md',
                'border-white/10 hover:border-white/20',
                'text-white/60 hover:text-white/80',
                'transition-colors duration-200',
                'cursor-pointer',
                'focus:outline-none focus:ring-2 focus:ring-white/20',
            )}
            style={{
                scale: springStyle.scale,
                opacity: springStyle.opacity,
            }}
        >
            <Plus className="h-5 w-5" strokeWidth={1.5} />
            <span className="text-sm font-medium tracking-wide">
                Start a new decision
            </span>
        </animated.button>
    );
}

export default memo(StartSessionButton);
