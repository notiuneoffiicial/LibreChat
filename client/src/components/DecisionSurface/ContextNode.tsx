/**
 * OptimismAI - Context Node
 * A draggable context block that can be added to the thinking surface
 */

import { memo, useState, useCallback, useRef, useEffect, useContext } from 'react';
import { useSetRecoilState } from 'recoil';
import { animated, useSpring } from '@react-spring/web';
import { X, Link2 } from 'lucide-react';
import { ThemeContext, isDark } from '@librechat/client';
import { cn } from '~/utils';
import store from '~/store';
import type { ContextNodeData } from '~/store/decisionSession';
import type { Position } from '~/common/DecisionSession.types';

interface ContextNodeProps {
    node: ContextNodeData;
    /** Callback to start a connection drag */
    onStartConnect?: (nodeId: string, position: Position) => void;
}

/**
 * ContextNode - A context block on the thinking surface
 * 
 * Features:
 * - Editable text area for adding context
 * - Draggable positioning
 * - Glass-morphism styling matching existing nodes
 * - Delete button to remove from surface
 * - Connection handle to link to question nodes
 */
function ContextNode({ node, onStartConnect }: ContextNodeProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const setContextNodes = useSetRecoilState(store.contextNodesAtom);
    const [content, setContent] = useState(node.content);
    const [isFocused, setIsFocused] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [position, setPosition] = useState(node.position);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [isHoveringHandle, setIsHoveringHandle] = useState(false);

    // Theme
    const { theme } = useContext(ThemeContext);
    const isCurrentlyDark = isDark(theme);

    // Appear animation
    const [spring] = useSpring(() => ({
        from: { opacity: 0, scale: 0.9 },
        to: { opacity: 1, scale: 1 },
        config: { tension: 200, friction: 20 },
    }));

    // Focus animation
    const focusSpring = useSpring({
        borderColor: isFocused
            ? (isCurrentlyDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.2)')
            : (isCurrentlyDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'),
        boxShadow: isFocused
            ? (isCurrentlyDark ? '0 0 20px rgba(255, 255, 255, 0.1)' : '0 0 20px rgba(0, 0, 0, 0.1)')
            : (isCurrentlyDark ? '0 0 10px rgba(0, 0, 0, 0.3)' : '0 0 10px rgba(0, 0, 0, 0.1)'),
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
    const handleDelete = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        setContextNodes((prev) => prev.filter((n) => n.id !== node.id));
    }, [node.id, setContextNodes]);

    // Drag handling
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        // Don't start drag if clicking on textarea or delete button
        if (
            e.target instanceof HTMLTextAreaElement ||
            e.target instanceof HTMLButtonElement
        ) {
            return;
        }
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
        setDragOffset({
            x: e.clientX - position.x,
            y: e.clientY - position.y,
        });
    }, [position]);

    // Attach global mouse events for dragging using useEffect
    useEffect(() => {
        if (!isDragging) return;

        const handleMouseMove = (e: MouseEvent) => {
            const newPos = {
                x: e.clientX - dragOffset.x,
                y: e.clientY - dragOffset.y,
            };
            setPosition(newPos);
            setContextNodes((prev) =>
                prev.map((n) => (n.id === node.id ? { ...n, position: newPos } : n))
            );
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, dragOffset, node.id, setContextNodes]);

    return (
        <animated.div
            style={{
                ...spring,
                ...focusSpring,
                position: 'absolute',
                left: position.x,
                top: position.y,
                transform: 'translate(-50%, -50%)',
                cursor: isDragging ? 'grabbing' : 'grab',
                zIndex: isDragging ? 100 : 10,
            }}
            onMouseDown={handleMouseDown}
            className={cn(
                'w-64 min-h-[100px]',
                'rounded-xl',
                'backdrop-blur-md',
                'border border-dashed',
                'transition-colors duration-200',
                isCurrentlyDark
                    ? 'bg-white/5'
                    : 'bg-black/5',
            )}
        >
            {/* Header */}
            <div className={cn(
                'flex items-center justify-between px-3 py-2 border-b',
                isCurrentlyDark ? 'border-white/10' : 'border-black/10',
            )}>
                <span className={cn(
                    'text-xs font-medium uppercase tracking-wider',
                    isCurrentlyDark ? 'text-white/40' : 'text-black/40',
                )}>
                    Context
                </span>
                <button
                    onClick={handleDelete}
                    className={cn(
                        'p-1 rounded',
                        isCurrentlyDark
                            ? 'text-white/30 hover:text-white/60 hover:bg-white/10'
                            : 'text-black/30 hover:text-black/60 hover:bg-black/10',
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
                    'text-sm',
                    isCurrentlyDark
                        ? 'text-white/70 placeholder:text-white/30'
                        : 'text-black/70 placeholder:text-black/30',
                    'focus:outline-none',
                    'cursor-text',
                )}
                rows={3}
            />

            {/* Connection handle - link icon on the right */}
            {onStartConnect && (
                <div
                    className={cn(
                        'absolute -right-3 top-1/2 -translate-y-1/2',
                        'w-6 h-6 rounded-full',
                        'flex items-center justify-center',
                        'cursor-crosshair',
                        'transition-all duration-200',
                        isHoveringHandle
                            ? (isCurrentlyDark
                                ? 'bg-amber-500 scale-110 shadow-lg shadow-amber-500/30'
                                : 'bg-amber-500 scale-110 shadow-lg shadow-amber-500/30')
                            : (isCurrentlyDark
                                ? 'bg-amber-500/50 hover:bg-amber-500'
                                : 'bg-amber-500/50 hover:bg-amber-500'),
                        'border-2',
                        isCurrentlyDark ? 'border-white/20' : 'border-black/10',
                    )}
                    onMouseEnter={() => setIsHoveringHandle(true)}
                    onMouseLeave={() => setIsHoveringHandle(false)}
                    onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        // Calculate the center of the handle in page coordinates
                        const rect = e.currentTarget.getBoundingClientRect();
                        const handlePosition = {
                            x: rect.left + rect.width / 2,
                            y: rect.top + rect.height / 2,
                        };
                        onStartConnect(node.id, handlePosition);
                    }}
                    title="Drag to connect to a question"
                >
                    <Link2
                        size={12}
                        className={cn(
                            'transition-colors',
                            isHoveringHandle
                                ? 'text-white'
                                : (isCurrentlyDark ? 'text-white/70' : 'text-white/90')
                        )}
                    />
                </div>
            )}

            {/* Link count indicator */}
            {(node.linkedQuestionIds?.length || 0) > 0 && (
                <div className={cn(
                    'absolute -right-1 -top-1',
                    'w-4 h-4 rounded-full',
                    'flex items-center justify-center',
                    'text-[10px] font-bold',
                    isCurrentlyDark
                        ? 'bg-amber-500 text-white'
                        : 'bg-amber-500 text-white',
                )}>
                    {node.linkedQuestionIds?.length}
                </div>
            )}
        </animated.div>
    );
}

export default memo(ContextNode);
