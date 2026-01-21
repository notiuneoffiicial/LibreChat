/**
 * OptimismAI - Living Decision Surface
 * StartSessionButton - The initial call-to-action when no session exists
 *
 * "A gentle invitation to begin thinking..."
 */

import { memo, useCallback, useState, useContext } from 'react';
import { animated, useSpring } from '@react-spring/web';
import { Plus } from 'lucide-react';
import { ThemeContext, isDark } from '@librechat/client';
import { cn } from '~/utils';

interface StartSessionButtonProps {
    /** Called when the user clicks to start a session */
    onStart: () => void;
    /** Anchor position for centering (from ThinkingField container) */
    anchorPosition?: { x: number; y: number };
}

/**
 * StartSessionButton - The empty-state CTA
 *
 * Visual characteristics:
 * - Pill-shaped, centered on the field (matches DecisionComposer)
 * - Minimal, calm aesthetic
 * - Micro-scale feedback on click, then fades out
 */
function StartSessionButton({ onStart, anchorPosition }: StartSessionButtonProps) {
    const [isPressed, setIsPressed] = useState(false);
    const [isExiting, setIsExiting] = useState(false);

    // Theme context
    const { theme } = useContext(ThemeContext);
    const isCurrentlyDark = isDark(theme);

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

    // Calculate position based on anchor or fallback to center
    const positionStyle = anchorPosition
        ? {
            left: `${anchorPosition.x}px`,
            top: `${anchorPosition.y}px`,
            transform: 'translate(-50%, -50%)',
        }
        : {
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
        };

    return (
        <animated.button
            type="button"
            onClick={handleClick}
            onMouseDown={() => setIsPressed(true)}
            onMouseUp={() => setIsPressed(false)}
            onMouseLeave={() => setIsPressed(false)}
            className={cn(
                'absolute',
                'flex items-center gap-3 px-6 py-4',
                'rounded-full border',
                'backdrop-blur-md',
                'transition-colors duration-200',
                'cursor-pointer',
                isCurrentlyDark
                    ? 'bg-white/5 border-white/10 hover:border-white/20 text-white/60 hover:text-white/80 focus:ring-white/20'
                    : 'bg-white/80 border-black/10 hover:border-black/20 text-slate-600 hover:text-slate-800 focus:ring-black/20',
                'focus:outline-none focus:ring-2',
            )}
            style={{
                ...positionStyle,
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

