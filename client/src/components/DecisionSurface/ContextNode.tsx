/**
 * OptimismAI - Context Node
 * A draggable context block that can be added to the thinking surface
 */

import { memo, useState, useCallback, useRef, useEffect } from 'react';
import { useSetRecoilState } from 'recoil';
import { animated, useSpring } from '@react-spring/web';
import { X } from 'lucide-react';
import { cn } from '~/utils';
import store from '~/store';
import type { ContextNodeData } from '~/store/decisionSession';

interface ContextNodeProps {
    node: ContextNodeData;
}

/**
 * ContextNode - A context block on the thinking surface
 * 
 * Features:
 * - Editable text area for adding context
 * - Glass-morphism styling matching existing nodes
 * - Delete button to remove from surface
 */
function ContextNode({ node }: ContextNodeProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const setContextNodes = useSetRecoilState(store.contextNodesAtom);
    const [content, setContent] = useState(node.content);
    const [isFocused, setIsFocused] = useState(false);

    // Appear animation
    const [spring] = useSpring(() => ({
        from: { opacity: 0, scale: 0.9 },
        to: { opacity: 1, scale: 1 },
        config: { tension: 200, friction: 20 },
    }));

    // Focus animation
    const focusSpring = useSpring({
        borderColor: isFocused ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.1)',
        boxShadow: isFocused
            ? '0 0 20px rgba(255, 255, 255, 0.1)'
            : '0 0 10px rgba(0, 0, 0, 0.3)',
        config: { tension: 200, friction: 20 },
    });

    // Auto-focus on mount for new nodes
    useEffect(() => {
        if (!node.content && textareaRef.current) {
            textareaRef.current.focus();
        }
    }, [node.content]);

    // Update content in store
    const handleContentChange = useCallback(
        (e: React.ChangeEvent<HTMLTextAreaElement>) => {
            const newContent = e.target.value;
            setContent(newContent);
            setContextNodes((prev) =>
                prev.map((n) => (n.id === node.id ? { ...n, content: newContent } : n)),
            );
        },
        [node.id, setContextNodes],
    );

    // Delete context node
    const handleDelete = useCallback(() => {
        setContextNodes((prev) => prev.filter((n) => n.id !== node.id));
    }, [node.id, setContextNodes]);

    return (
        <animated.div
            style={{
                ...spring,
                ...focusSpring,
                position: 'absolute',
                left: node.position.x,
                top: node.position.y,
                transform: 'translate(-50%, -50%)',
            }}
            className={cn(
                'w-64 min-h-[100px]',
                'rounded-xl',
                'bg-white/5 backdrop-blur-md',
                'border border-dashed',
                'transition-colors duration-200',
            )}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
                <span className="text-xs font-medium text-white/40 uppercase tracking-wider">
                    Context
                </span>
                <button
                    onClick={handleDelete}
                    className={cn(
                        'p-1 rounded',
                        'text-white/30 hover:text-white/60 hover:bg-white/10',
                        'transition-colors duration-150',
                        'focus:outline-none',
                    )}
                    aria-label="Remove context"
                >
                    <X size={14} />
                </button>
            </div>

            {/* Content area */}
            <textarea
                ref={textareaRef}
                value={content}
                onChange={handleContentChange}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                placeholder="Add context to inform your decision..."
                className={cn(
                    'w-full min-h-[80px] p-3',
                    'bg-transparent border-none resize-none',
                    'text-sm text-white/70 placeholder:text-white/30',
                    'focus:outline-none',
                )}
                rows={3}
            />
        </animated.div>
    );
}

export default memo(ContextNode);
