/**
 * OptimismAI - Decision Surface Toolbar
 * A minimalist collapsible icon menu for quick access to configuration tools
 */

import { memo, useCallback, useContext, useState } from 'react';
import { useRecoilState, useSetRecoilState, useRecoilValue } from 'recoil';
import { ChevronRight, Files, Brain, Plus, FileText, History } from 'lucide-react';
import { ThemeContext, isDark } from '@librechat/client';
import { cn } from '~/utils';
import store from '~/store';
import MemoryPickerPopover from './MemoryPickerPopover';
import FilesPickerPopover from './FilesPickerPopover';

interface DecisionToolbarProps {
    onNewDecision?: () => void;
    onOpenHistory?: () => void;
}

interface ToolbarIconProps {
    icon: React.ElementType;
    label: string;
    onClick: () => void;
    collapsed: boolean;
    isCurrentlyDark: boolean;
    isActive?: boolean;
}

function ToolbarIcon({ icon: Icon, label, onClick, collapsed, isCurrentlyDark, isActive }: ToolbarIconProps) {
    return (
        <button
            onClick={onClick}
            className={cn(
                'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg',
                'transition-all duration-200 ease-out',
                isCurrentlyDark
                    ? 'text-white/40 hover:text-white/70 hover:bg-white/5 focus:ring-white/20'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-black/5 focus:ring-black/20',
                'focus:outline-none focus:ring-1',
                collapsed ? 'justify-center' : 'justify-start',
                isActive && (isCurrentlyDark ? 'bg-white/10 text-white/70' : 'bg-black/10 text-slate-700'),
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

function DecisionToolbar({ onNewDecision, onOpenHistory }: DecisionToolbarProps) {
    const [collapsed, setCollapsed] = useRecoilState<boolean>(store.toolbarCollapsedAtom);
    const setContextNodes = useSetRecoilState(store.contextNodesAtom);
    const anchorPosition = useRecoilValue(store.anchorPositionAtom);

    // Picker state
    const [activePicker, setActivePicker] = useState<'memory' | 'files' | null>(null);

    // Theme context
    const { theme } = useContext(ThemeContext);
    const isCurrentlyDark = isDark(theme);

    // Toggle collapsed state
    const handleToggle = useCallback(() => {
        setCollapsed((prev) => !prev);
    }, [setCollapsed]);

    // Add a new context node to the surface - spawn to the right side to avoid center clutter
    const handleAddContext = useCallback(() => {
        const newNode = {
            id: `context-${Date.now()}`,
            content: '',
            position: {
                // Spawn to the right side of the anchor, with some randomness
                x: anchorPosition.x + 300 + Math.random() * 150,
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

    // Handle open files picker
    const handleOpenFiles = useCallback(() => {
        setActivePicker((prev) => prev === 'files' ? null : 'files');
    }, []);

    // Handle open memory picker
    const handleOpenMemory = useCallback(() => {
        setActivePicker((prev) => prev === 'memory' ? null : 'memory');
    }, []);

    // Handle open history
    const handleOpenHistory = useCallback(() => {
        console.log('[DecisionToolbar] History panel requested');
        onOpenHistory?.();
    }, [onOpenHistory]);

    // Close picker
    const handleClosePicker = useCallback(() => {
        setActivePicker(null);
    }, []);

    return (
        <div
            className={cn(
                'absolute left-0 top-0 bottom-0 z-40',
                'flex flex-col',
                'transition-all duration-200 ease-out',
                isCurrentlyDark
                    ? 'bg-gradient-to-r from-black/40 to-transparent'
                    : 'bg-gradient-to-r from-white/60 to-transparent',
                collapsed ? 'w-14' : 'w-44',
            )}
        >
            {/* Toggle button */}
            <div className="flex items-center justify-end p-2 pt-16">
                <button
                    onClick={handleToggle}
                    className={cn(
                        'p-1.5 rounded-md',
                        'transition-all duration-200 ease-out',
                        isCurrentlyDark
                            ? 'text-white/30 hover:text-white/60 hover:bg-white/5 focus:ring-white/20'
                            : 'text-slate-400 hover:text-slate-600 hover:bg-black/5 focus:ring-black/20',
                        'focus:outline-none focus:ring-1',
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

            <nav className="flex-1 flex flex-col gap-1 px-2 py-2">
                <ToolbarIcon
                    icon={Files}
                    label="Files"
                    onClick={handleOpenFiles}
                    collapsed={collapsed}
                    isCurrentlyDark={isCurrentlyDark}
                    isActive={activePicker === 'files'}
                />
                <ToolbarIcon
                    icon={Brain}
                    label="Memory"
                    onClick={handleOpenMemory}
                    collapsed={collapsed}
                    isCurrentlyDark={isCurrentlyDark}
                    isActive={activePicker === 'memory'}
                />
                <ToolbarIcon
                    icon={Plus}
                    label="New Decision"
                    onClick={handleNewDecision}
                    collapsed={collapsed}
                    isCurrentlyDark={isCurrentlyDark}
                />
                <ToolbarIcon
                    icon={FileText}
                    label="Context"
                    onClick={handleAddContext}
                    collapsed={collapsed}
                    isCurrentlyDark={isCurrentlyDark}
                />
                <ToolbarIcon
                    icon={History}
                    label="History"
                    onClick={handleOpenHistory}
                    collapsed={collapsed}
                    isCurrentlyDark={isCurrentlyDark}
                />
            </nav>

            {/* Memory Picker Popover */}
            <MemoryPickerPopover
                isOpen={activePicker === 'memory'}
                onClose={handleClosePicker}
                anchorPosition={anchorPosition}
            />

            {/* Files Picker Popover */}
            <FilesPickerPopover
                isOpen={activePicker === 'files'}
                onClose={handleClosePicker}
                anchorPosition={anchorPosition}
            />
        </div>
    );
}

export default memo(DecisionToolbar);
