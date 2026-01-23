/**
 * OptimismAI - File Node
 * A draggable file reference node on the thinking surface
 */

import { memo, useState, useCallback, useContext } from 'react';
import { useSetRecoilState } from 'recoil';
import { animated, useSpring } from '@react-spring/web';
import { X, FileText, Image, FileCode, File, Download } from 'lucide-react';
import { ThemeContext, isDark } from '@librechat/client';
import { cn } from '~/utils';
import store from '~/store';
import type { FileNodeData } from '~/store/decisionSession';

interface FileNodeProps {
    node: FileNodeData;
}

// Get icon based on file type
function getFileIcon(fileType: string) {
    const type = fileType.toLowerCase();
    if (type.includes('image')) return Image;
    if (type.includes('text') || type.includes('pdf')) return FileText;
    if (type.includes('javascript') || type.includes('typescript') || type.includes('json')) return FileCode;
    return File;
}

// Get file type badge color
function getTypeBadgeClass(fileType: string, isCurrentlyDark: boolean) {
    const type = fileType.toLowerCase();
    if (type.includes('image')) {
        return isCurrentlyDark ? 'bg-pink-500/20 text-pink-300' : 'bg-pink-100 text-pink-700';
    }
    if (type.includes('pdf')) {
        return isCurrentlyDark ? 'bg-red-500/20 text-red-300' : 'bg-red-100 text-red-700';
    }
    if (type.includes('javascript') || type.includes('typescript')) {
        return isCurrentlyDark ? 'bg-yellow-500/20 text-yellow-300' : 'bg-yellow-100 text-yellow-700';
    }
    return isCurrentlyDark ? 'bg-slate-500/20 text-slate-300' : 'bg-slate-100 text-slate-700';
}

/**
 * FileNode - A file reference on the thinking surface
 * 
 * Features:
 * - Displays file name and type from backend
 * - Draggable positioning
 * - Download/preview affordance
 * - Glass-morphism styling
 */
function FileNode({ node }: FileNodeProps) {
    const setFileNodes = useSetRecoilState(store.fileNodesAtom);
    const [isDragging, setIsDragging] = useState(false);
    const [position, setPosition] = useState(node.position);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

    // Theme
    const { theme } = useContext(ThemeContext);
    const isCurrentlyDark = isDark(theme);

    // Get appropriate icon
    const FileIcon = getFileIcon(node.fileType);

    // Appear animation
    const [spring] = useSpring(() => ({
        from: { opacity: 0, scale: 0.9 },
        to: { opacity: 1, scale: 1 },
        config: { tension: 200, friction: 20 },
    }));

    // Drag handling
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setIsDragging(true);
        setDragOffset({
            x: e.clientX - position.x,
            y: e.clientY - position.y,
        });
    }, [position]);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isDragging) return;
        const newPos = {
            x: e.clientX - dragOffset.x,
            y: e.clientY - dragOffset.y,
        };
        setPosition(newPos);
        setFileNodes((prev) =>
            prev.map((n) => (n.id === node.id ? { ...n, position: newPos } : n))
        );
    }, [isDragging, dragOffset, node.id, setFileNodes]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
    }, []);

    // Attach global mouse events for dragging
    useState(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            return () => {
                window.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('mouseup', handleMouseUp);
            };
        }
    });

    // Delete from canvas
    const handleDelete = useCallback(() => {
        setFileNodes((prev) => prev.filter((n) => n.id !== node.id));
    }, [node.id, setFileNodes]);

    // Truncate filename
    const displayName = node.fileName.length > 25
        ? node.fileName.slice(0, 22) + '...'
        : node.fileName;

    // Get file extension for badge
    const fileExt = node.fileName.split('.').pop()?.toUpperCase() || 'FILE';

    return (
        <animated.div
            style={{
                ...spring,
                position: 'absolute',
                left: position.x,
                top: position.y,
                transform: 'translate(-50%, -50%)',
                cursor: isDragging ? 'grabbing' : 'grab',
            }}
            onMouseDown={handleMouseDown}
            className={cn(
                'w-56 min-h-[60px]',
                'rounded-xl',
                'backdrop-blur-md',
                'border',
                'transition-all duration-200',
                isCurrentlyDark
                    ? 'bg-emerald-500/10 border-emerald-400/20'
                    : 'bg-emerald-100/50 border-emerald-300/30',
            )}
        >
            {/* Header */}
            <div className={cn(
                'flex items-center justify-between px-3 py-2 border-b',
                isCurrentlyDark ? 'border-white/10' : 'border-black/10',
            )}>
                <div className="flex items-center gap-2">
                    <FileIcon size={14} className={cn(
                        isCurrentlyDark ? 'text-emerald-400' : 'text-emerald-600',
                    )} />
                    <span className={cn(
                        'text-xs font-medium uppercase tracking-wider',
                        isCurrentlyDark ? 'text-emerald-300/60' : 'text-emerald-600/60',
                    )}>
                        File
                    </span>
                </div>
                <div className="flex items-center gap-1">
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
            <div className="p-3 flex items-center gap-3">
                <div className={cn(
                    'flex-shrink-0 p-2 rounded-lg',
                    isCurrentlyDark ? 'bg-white/5' : 'bg-black/5',
                )}>
                    <FileIcon size={20} className={cn(
                        isCurrentlyDark ? 'text-emerald-300' : 'text-emerald-600',
                    )} />
                </div>
                <div className="flex-1 min-w-0">
                    <p className={cn(
                        'text-sm font-medium truncate',
                        isCurrentlyDark ? 'text-white/80' : 'text-black/80',
                    )}>
                        {displayName}
                    </p>
                    <span className={cn(
                        'inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium',
                        getTypeBadgeClass(node.fileType, isCurrentlyDark),
                    )}>
                        {fileExt}
                    </span>
                </div>
            </div>
        </animated.div>
    );
}

export default memo(FileNode);
