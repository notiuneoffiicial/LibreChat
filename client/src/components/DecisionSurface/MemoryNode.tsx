/**
 * OptimismAI - Memory Node
 * A draggable memory reference node on the thinking surface
 */

import { memo, useState, useCallback, useContext, useEffect } from 'react';
import { useSetRecoilState } from 'recoil';
import { animated, useSpring } from '@react-spring/web';
import { X, Brain, Pencil, Check, Loader2 } from 'lucide-react';
import { ThemeContext, isDark } from '@librechat/client';
import { cn } from '~/utils';
import store from '~/store';
import type { MemoryNodeData } from '~/store/decisionSession';
import { useUpdateMemoryMutation } from '~/data-provider/Memories/queries';

interface MemoryNodeProps {
    node: MemoryNodeData;
}

/**
 * MemoryNode - A memory reference on the thinking surface
 * 
 * Features:
 * - Displays memory key/value from backend
 * - Draggable positioning
 * - Inline editing with backend sync
 * - Glass-morphism styling
 */
function MemoryNode({ node }: MemoryNodeProps) {
    const setMemoryNodes = useSetRecoilState(store.memoryNodesAtom);
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(node.memoryValue);
    const [isDragging, setIsDragging] = useState(false);
    const [position, setPosition] = useState(node.position);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [isSaving, setIsSaving] = useState(false);

    // Theme
    const { theme } = useContext(ThemeContext);
    const isCurrentlyDark = isDark(theme);

    // Backend mutation
    const updateMemory = useUpdateMemoryMutation();

    // Appear animation
    const [spring] = useSpring(() => ({
        from: { opacity: 0, scale: 0.9 },
        to: { opacity: 1, scale: 1 },
        config: { tension: 200, friction: 20 },
    }));

    // Drag handling
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (isEditing) return;
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
        setDragOffset({
            x: e.clientX - position.x,
            y: e.clientY - position.y,
        });
    }, [position, isEditing]);

    // Attach global mouse events for dragging using useEffect
    useEffect(() => {
        if (!isDragging) return;

        const handleMouseMove = (e: MouseEvent) => {
            const newPos = {
                x: e.clientX - dragOffset.x,
                y: e.clientY - dragOffset.y,
            };
            setPosition(newPos);
            setMemoryNodes((prev) =>
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
    }, [isDragging, dragOffset, node.id, setMemoryNodes]);

    // Delete from canvas
    const handleDelete = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        setMemoryNodes((prev) => prev.filter((n) => n.id !== node.id));
    }, [node.id, setMemoryNodes]);

    // Save edit
    const handleSaveEdit = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        setIsSaving(true);

        updateMemory.mutate(
            { key: node.memoryKey, value: editValue },
            {
                onSuccess: () => {
                    setMemoryNodes((prev) =>
                        prev.map((n) =>
                            n.id === node.id ? { ...n, memoryValue: editValue } : n
                        )
                    );
                    setIsEditing(false);
                    setIsSaving(false);
                },
                onError: () => {
                    setIsSaving(false);
                    // Still update locally even if backend fails
                    setMemoryNodes((prev) =>
                        prev.map((n) =>
                            n.id === node.id ? { ...n, memoryValue: editValue } : n
                        )
                    );
                    setIsEditing(false);
                },
            }
        );
    }, [node.id, node.memoryKey, editValue, updateMemory, setMemoryNodes]);

    // Handle edit button click
    const handleEditClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        setIsEditing(true);
    }, []);

    // Truncate display value
    const displayValue = node.memoryValue.length > 100
        ? node.memoryValue.slice(0, 100) + '...'
        : node.memoryValue;

    return (
        <animated.div
            style={{
                ...spring,
                position: 'absolute',
                left: position.x,
                top: position.y,
                transform: 'translate(-50%, -50%)',
                cursor: isDragging ? 'grabbing' : (isEditing ? 'default' : 'grab'),
                zIndex: isDragging ? 100 : 10,
            }}
            onMouseDown={handleMouseDown}
            className={cn(
                'w-64 min-h-[80px]',
                'rounded-xl',
                'backdrop-blur-md',
                'border',
                'transition-all duration-200',
                'select-none',
                isCurrentlyDark
                    ? 'bg-indigo-500/10 border-indigo-400/20'
                    : 'bg-indigo-100/50 border-indigo-300/30',
            )}
        >
            {/* Header */}
            <div className={cn(
                'flex items-center justify-between px-3 py-2 border-b',
                isCurrentlyDark ? 'border-white/10' : 'border-black/10',
            )}>
                <div className="flex items-center gap-2">
                    <Brain size={14} className={cn(
                        isCurrentlyDark ? 'text-indigo-400' : 'text-indigo-600',
                    )} />
                    <span className={cn(
                        'text-xs font-medium uppercase tracking-wider',
                        isCurrentlyDark ? 'text-indigo-300/60' : 'text-indigo-600/60',
                    )}>
                        {node.memoryKey}
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    {!isEditing && (
                        <button
                            onClick={handleEditClick}
                            className={cn(
                                'p-1 rounded',
                                isCurrentlyDark
                                    ? 'text-white/30 hover:text-white/60 hover:bg-white/10'
                                    : 'text-black/30 hover:text-black/60 hover:bg-black/10',
                                'transition-colors duration-150',
                            )}
                            aria-label="Edit memory"
                        >
                            <Pencil size={12} />
                        </button>
                    )}
                    {isEditing && (
                        <button
                            onClick={handleSaveEdit}
                            disabled={isSaving}
                            className={cn(
                                'p-1 rounded',
                                'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/20',
                                'transition-colors duration-150',
                                'disabled:opacity-50',
                            )}
                            aria-label="Save memory"
                        >
                            {isSaving ? (
                                <Loader2 size={12} className="animate-spin" />
                            ) : (
                                <Check size={12} />
                            )}
                        </button>
                    )}
                    <button
                        onClick={handleDelete}
                        className={cn(
                            'p-1 rounded',
                            isCurrentlyDark
                                ? 'text-white/30 hover:text-white/60 hover:bg-white/10'
                                : 'text-black/30 hover:text-black/60 hover:bg-black/10',
                            'transition-colors duration-150',
                        )}
                        aria-label="Remove from canvas"
                    >
                        <X size={14} />
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="p-3">
                {isEditing ? (
                    <textarea
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className={cn(
                            'w-full min-h-[60px] p-2 rounded',
                            'bg-transparent border resize-none',
                            'text-sm',
                            isCurrentlyDark
                                ? 'text-white/80 border-white/20 placeholder:text-white/30'
                                : 'text-black/80 border-black/20 placeholder:text-black/30',
                            'focus:outline-none focus:ring-1',
                            isCurrentlyDark ? 'focus:ring-indigo-400/50' : 'focus:ring-indigo-500/50',
                        )}
                        rows={3}
                        autoFocus
                        onMouseDown={(e) => e.stopPropagation()}
                    />
                ) : (
                    <p className={cn(
                        'text-sm leading-relaxed',
                        isCurrentlyDark ? 'text-white/70' : 'text-black/70',
                    )}>
                        {displayValue}
                    </p>
                )}
            </div>
        </animated.div>
    );
}

export default memo(MemoryNode);
