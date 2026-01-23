/**
 * OptimismAI - Memory Picker Popover
 * Popover for browsing and selecting memories to add to the thinking surface
 */

import { memo, useState, useCallback, useMemo, useContext } from 'react';
import { useSetRecoilState, useRecoilValue } from 'recoil';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, Brain, X, Loader2 } from 'lucide-react';
import { matchSorter } from 'match-sorter';
import { ThemeContext, isDark } from '@librechat/client';
import type { TUserMemory } from 'librechat-data-provider';
import { cn } from '~/utils';
import store from '~/store';
import { useMemoriesQuery, useCreateMemoryMutation } from '~/data-provider/Memories/queries';

interface MemoryPickerPopoverProps {
    isOpen: boolean;
    onClose: () => void;
    anchorPosition: { x: number; y: number };
}

/**
 * MemoryPickerPopover - Browse and select memories
 */
function MemoryPickerPopover({ isOpen, onClose, anchorPosition }: MemoryPickerPopoverProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [newKey, setNewKey] = useState('');
    const [newValue, setNewValue] = useState('');

    const setMemoryNodes = useSetRecoilState(store.memoryNodesAtom);

    // Theme
    const { theme } = useContext(ThemeContext);
    const isCurrentlyDark = isDark(theme);

    // Fetch memories
    const { data: memData, isLoading } = useMemoriesQuery();
    const memories = useMemo(() => memData?.memories ?? [], [memData]);

    // Create mutation
    const createMemory = useCreateMemoryMutation();

    // Filter memories by search
    const filteredMemories = useMemo(() => {
        if (!searchQuery.trim()) return memories;
        return matchSorter(memories, searchQuery, { keys: ['key', 'value'] });
    }, [memories, searchQuery]);

    // Spawn memory node on canvas
    const handleSelectMemory = useCallback((memory: TUserMemory) => {
        const newNode = {
            id: `memory-${Date.now()}`,
            memoryKey: memory.key,
            memoryValue: memory.value,
            position: {
                x: anchorPosition.x + 150 + Math.random() * 100,
                y: anchorPosition.y + Math.random() * 100 - 50,
            },
            createdAt: Date.now(),
        };
        setMemoryNodes((prev) => [...prev, newNode]);
        onClose();
    }, [anchorPosition, setMemoryNodes, onClose]);

    // Create new memory
    const handleCreateMemory = useCallback(() => {
        if (!newKey.trim() || !newValue.trim()) return;
        createMemory.mutate(
            { key: newKey.trim(), value: newValue.trim() },
            {
                onSuccess: (data) => {
                    // Also add to canvas
                    const newNode = {
                        id: `memory-${Date.now()}`,
                        memoryKey: data.memory.key,
                        memoryValue: data.memory.value,
                        position: {
                            x: anchorPosition.x + 150 + Math.random() * 100,
                            y: anchorPosition.y + Math.random() * 100 - 50,
                        },
                        createdAt: Date.now(),
                    };
                    setMemoryNodes((prev) => [...prev, newNode]);
                    setNewKey('');
                    setNewValue('');
                    setIsCreating(false);
                    onClose();
                },
            }
        );
    }, [newKey, newValue, createMemory, anchorPosition, setMemoryNodes, onClose]);

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, x: -10 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.95, x: -10 }}
                    transition={{ duration: 0.15 }}
                    className={cn(
                        'absolute z-50',
                        'w-72 max-h-80',
                        'rounded-xl',
                        'backdrop-blur-xl shadow-2xl',
                        'overflow-hidden',
                        isCurrentlyDark
                            ? 'bg-black/80 border border-white/10'
                            : 'bg-white/95 border border-black/10',
                    )}
                    style={{ left: 56, top: 80 }}
                >
                    {/* Header */}
                    <div className={cn(
                        'flex items-center justify-between px-3 py-2 border-b',
                        isCurrentlyDark ? 'border-white/10' : 'border-black/10',
                    )}>
                        <div className="flex items-center gap-2">
                            <Brain size={16} className={cn(
                                isCurrentlyDark ? 'text-indigo-400' : 'text-indigo-600',
                            )} />
                            <span className={cn(
                                'text-sm font-medium',
                                isCurrentlyDark ? 'text-white/80' : 'text-black/80',
                            )}>
                                Select Memory
                            </span>
                        </div>
                        <button
                            onClick={onClose}
                            className={cn(
                                'p-1 rounded',
                                isCurrentlyDark
                                    ? 'text-white/40 hover:text-white/70 hover:bg-white/10'
                                    : 'text-black/40 hover:text-black/70 hover:bg-black/10',
                            )}
                        >
                            <X size={14} />
                        </button>
                    </div>

                    {/* Search */}
                    <div className="p-2">
                        <div className={cn(
                            'flex items-center gap-2 px-2 py-1.5 rounded-lg',
                            isCurrentlyDark ? 'bg-white/5' : 'bg-black/5',
                        )}>
                            <Search size={14} className={cn(
                                isCurrentlyDark ? 'text-white/40' : 'text-black/40',
                            )} />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search memories..."
                                className={cn(
                                    'flex-1 bg-transparent text-sm outline-none',
                                    isCurrentlyDark
                                        ? 'text-white/80 placeholder:text-white/30'
                                        : 'text-black/80 placeholder:text-black/30',
                                )}
                            />
                        </div>
                    </div>

                    {/* Memory List */}
                    <div className="max-h-40 overflow-y-auto px-2">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-4">
                                <Loader2 className="animate-spin" size={20} />
                            </div>
                        ) : filteredMemories.length === 0 ? (
                            <p className={cn(
                                'text-center py-4 text-sm',
                                isCurrentlyDark ? 'text-white/40' : 'text-black/40',
                            )}>
                                {searchQuery ? 'No memories found' : 'No memories yet'}
                            </p>
                        ) : (
                            filteredMemories.slice(0, 5).map((memory) => (
                                <button
                                    key={memory.key}
                                    onClick={() => handleSelectMemory(memory)}
                                    className={cn(
                                        'w-full text-left px-3 py-2 rounded-lg mb-1',
                                        'transition-colors duration-100',
                                        isCurrentlyDark
                                            ? 'hover:bg-white/10'
                                            : 'hover:bg-black/5',
                                    )}
                                >
                                    <p className={cn(
                                        'text-xs font-medium',
                                        isCurrentlyDark ? 'text-indigo-300' : 'text-indigo-600',
                                    )}>
                                        {memory.key}
                                    </p>
                                    <p className={cn(
                                        'text-xs truncate mt-0.5',
                                        isCurrentlyDark ? 'text-white/50' : 'text-black/50',
                                    )}>
                                        {memory.value}
                                    </p>
                                </button>
                            ))
                        )}
                    </div>

                    {/* Create New */}
                    <div className={cn(
                        'border-t p-2',
                        isCurrentlyDark ? 'border-white/10' : 'border-black/10',
                    )}>
                        {isCreating ? (
                            <div className="space-y-2">
                                <input
                                    type="text"
                                    value={newKey}
                                    onChange={(e) => setNewKey(e.target.value)}
                                    placeholder="Memory key..."
                                    className={cn(
                                        'w-full px-2 py-1.5 rounded text-sm',
                                        isCurrentlyDark
                                            ? 'bg-white/5 text-white/80 placeholder:text-white/30'
                                            : 'bg-black/5 text-black/80 placeholder:text-black/30',
                                        'outline-none',
                                    )}
                                />
                                <textarea
                                    value={newValue}
                                    onChange={(e) => setNewValue(e.target.value)}
                                    placeholder="Memory value..."
                                    rows={2}
                                    className={cn(
                                        'w-full px-2 py-1.5 rounded text-sm resize-none',
                                        isCurrentlyDark
                                            ? 'bg-white/5 text-white/80 placeholder:text-white/30'
                                            : 'bg-black/5 text-black/80 placeholder:text-black/30',
                                        'outline-none',
                                    )}
                                />
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setIsCreating(false)}
                                        className={cn(
                                            'flex-1 px-2 py-1 text-xs rounded',
                                            isCurrentlyDark
                                                ? 'bg-white/5 text-white/60 hover:bg-white/10'
                                                : 'bg-black/5 text-black/60 hover:bg-black/10',
                                        )}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleCreateMemory}
                                        disabled={!newKey.trim() || !newValue.trim() || createMemory.isLoading}
                                        className={cn(
                                            'flex-1 px-2 py-1 text-xs rounded',
                                            'bg-indigo-500 text-white hover:bg-indigo-600',
                                            'disabled:opacity-50 disabled:cursor-not-allowed',
                                        )}
                                    >
                                        {createMemory.isLoading ? 'Creating...' : 'Create'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button
                                onClick={() => setIsCreating(true)}
                                className={cn(
                                    'w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg',
                                    'text-sm transition-colors',
                                    isCurrentlyDark
                                        ? 'text-indigo-300 hover:bg-indigo-500/20'
                                        : 'text-indigo-600 hover:bg-indigo-100',
                                )}
                            >
                                <Plus size={14} />
                                Add new memory
                            </button>
                        )}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

export default memo(MemoryPickerPopover);
