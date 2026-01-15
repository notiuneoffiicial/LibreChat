/**
 * OptimismAI - Decision Surface Toolbar
 * A minimalist collapsible icon menu for quick access to configuration tools
 */

import { memo, useCallback } from 'react';
import { useRecoilState, useSetRecoilState, useRecoilValue } from 'recoil';
import { ChevronRight, Files, Brain, Plus, FileText } from 'lucide-react';
import { cn } from '~/utils';
import store from '~/store';

interface DecisionToolbarProps {
    onNewDecision?: () => void;
    onOpenFiles?: () => void;
    onOpenMemory?: () => void;
}

interface ToolbarIconProps {
    icon: React.ElementType;
    label: string;
    onClick: () => void;
    collapsed: boolean;
}

/**
 * Individual toolbar icon button
 */
function ToolbarIcon({ icon: Icon, label, onClick, collapsed }: ToolbarIconProps) {
    return (
        <button
            onClick={onClick}
            className={cn(
                'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg',
                'text-white/40 hover:text-white/70 hover:bg-white/5',
                'transition-all duration-200 ease-out',
                'focus:outline-none focus:ring-1 focus:ring-white/20',
                collapsed ? 'justify-center' : 'justify-start',
            )}
            title={collapsed ? label : undefined}
        >
            <Icon size={20} className="flex-shrink-0" />
            {!collapsed && (
                <span className="text-sm font-medium whitespace-nowrap overflow-hidden">
                    {label}
                </span>
            )}
        </button>
    );
}

/**
 * DecisionToolbar - Collapsible left sidebar with tool icons
 */
function DecisionToolbar({ onNewDecision, onOpenFiles, onOpenMemory }: DecisionToolbarProps) {
    const [collapsed, setCollapsed] = useRecoilState<boolean>(store.toolbarCollapsedAtom);
    const setContextNodes = useSetRecoilState(store.contextNodesAtom);
    const anchorPosition = useRecoilValue(store.anchorPositionAtom);

    // Toggle collapsed state
    const handleToggle = useCallback(() => {
        setCollapsed((prev) => !prev);
    }, [setCollapsed]);

    // Add a new context node to the surface
    const handleAddContext = useCallback(() => {
        const newNode = {
            id: `context-${Date.now()}`,
            content: '',
            position: {
                x: anchorPosition.x - 100 + Math.random() * 200,
                y: anchorPosition.y - 100 + Math.random() * 200,
            },
            createdAt: Date.now(),
        };
        setContextNodes((prev) => [...prev, newNode]);
    }, [setContextNodes, anchorPosition]);

    // Handle new decision
    const handleNewDecision = useCallback(() => {
        console.log('[DecisionToolbar] New decision requested');
        onNewDecision?.();
    }, [onNewDecision]);

    // Handle open files
    const handleOpenFiles = useCallback(() => {
        console.log('[DecisionToolbar] Files panel requested');
        onOpenFiles?.();
    }, [onOpenFiles]);

    // Handle open memory
    const handleOpenMemory = useCallback(() => {
        console.log('[DecisionToolbar] Memory viewer requested');
        onOpenMemory?.();
    }, [onOpenMemory]);

    return (
        <div
            className={cn(
                'absolute left-0 top-0 bottom-0 z-40',
                'flex flex-col',
                'bg-gradient-to-r from-black/40 to-transparent',
                'transition-all duration-200 ease-out',
                collapsed ? 'w-14' : 'w-44',
            )}
        >
            {/* Toggle button */}
            <div className="flex items-center justify-end p-2 pt-16">
                <button
                    onClick={handleToggle}
                    className={cn(
                        'p-1.5 rounded-md',
                        'text-white/30 hover:text-white/60 hover:bg-white/5',
                        'transition-all duration-200 ease-out',
                        'focus:outline-none focus:ring-1 focus:ring-white/20',
                    )}
                    aria-label={collapsed ? 'Expand toolbar' : 'Collapse toolbar'}
                >
                    <ChevronRight
                        size={16}
                        className={cn(
                            'transition-transform duration-200',
                            !collapsed && 'rotate-180',
                        )}
                    />
                </button>
            </div>

            {/* Icon rail */}
            <nav className="flex-1 flex flex-col gap-1 px-2 py-2">
                <ToolbarIcon
                    icon={Files}
                    label="Files"
                    onClick={handleOpenFiles}
                    collapsed={collapsed}
                />
                <ToolbarIcon
                    icon={Brain}
                    label="Memory"
                    onClick={handleOpenMemory}
                    collapsed={collapsed}
                />
                <ToolbarIcon
                    icon={Plus}
                    label="New Decision"
                    onClick={handleNewDecision}
                    collapsed={collapsed}
                />
                <ToolbarIcon
                    icon={FileText}
                    label="Context"
                    onClick={handleAddContext}
                    collapsed={collapsed}
                />
            </nav>
        </div>
    );
}

export default memo(DecisionToolbar);
