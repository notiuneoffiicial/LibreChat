/**
 * OptimismAI - Files Picker Popover
 * Popover for browsing and uploading files to add to the thinking surface
 */

import { memo, useState, useCallback, useMemo, useContext, useRef } from 'react';
import { useSetRecoilState } from 'recoil';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Upload, Files, X, Loader2, File, FileText, Image } from 'lucide-react';
import { matchSorter } from 'match-sorter';
import { ThemeContext, isDark } from '@librechat/client';
import type { TFile } from 'librechat-data-provider';
import { cn } from '~/utils';
import store from '~/store';
import { useGetFiles } from '~/data-provider/Files/queries';
import { useUploadFileMutation } from '~/data-provider/Files/mutations';

interface FilesPickerPopoverProps {
    isOpen: boolean;
    onClose: () => void;
    anchorPosition: { x: number; y: number };
}

// Get icon based on file type
function getFileIcon(filename: string) {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '')) return Image;
    if (['pdf', 'txt', 'md', 'doc', 'docx'].includes(ext || '')) return FileText;
    return File;
}

/**
 * FilesPickerPopover - Browse and upload files
 */
function FilesPickerPopover({ isOpen, onClose, anchorPosition }: FilesPickerPopoverProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const setFileNodes = useSetRecoilState(store.fileNodesAtom);

    // Theme
    const { theme } = useContext(ThemeContext);
    const isCurrentlyDark = isDark(theme);

    // Fetch files
    const { data: files = [], isLoading } = useGetFiles<TFile[]>();

    // Upload mutation
    const uploadFile = useUploadFileMutation();

    // Filter files by search
    const filteredFiles = useMemo(() => {
        if (!searchQuery.trim()) return files;
        return matchSorter(files, searchQuery, { keys: ['filename'] });
    }, [files, searchQuery]);

    // Spawn file node on canvas - spawn to the right side to avoid center clutter
    const handleSelectFile = useCallback((file: TFile) => {
        const newNode = {
            id: `file-${Date.now()}`,
            fileId: file.file_id,
            fileName: file.filename,
            fileType: file.type || 'unknown',
            position: {
                x: anchorPosition.x + 300 + Math.random() * 150,
                y: anchorPosition.y - 100 + Math.random() * 200,
            },
            createdAt: Date.now(),
        };
        setFileNodes((prev) => [...prev, newNode]);
        onClose();
    }, [anchorPosition, setFileNodes, onClose]);

    // Handle file upload
    const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);
        formData.append('message_file', 'true');

        uploadFile.mutate(formData, {
            onSuccess: (data) => {
                // Add to canvas - spawn to the right side
                const newNode = {
                    id: `file-${Date.now()}`,
                    fileId: data.file_id,
                    fileName: data.filename,
                    fileType: data.type || 'unknown',
                    position: {
                        x: anchorPosition.x + 300 + Math.random() * 150,
                        y: anchorPosition.y - 100 + Math.random() * 200,
                    },
                    createdAt: Date.now(),
                };
                setFileNodes((prev) => [...prev, newNode]);
                onClose();
            },
        });

        // Reset input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }, [uploadFile, anchorPosition, setFileNodes, onClose]);

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
                    style={{ left: 56, top: 120 }}
                >
                    {/* Header */}
                    <div className={cn(
                        'flex items-center justify-between px-3 py-2 border-b',
                        isCurrentlyDark ? 'border-white/10' : 'border-black/10',
                    )}>
                        <div className="flex items-center gap-2">
                            <Files size={16} className={cn(
                                isCurrentlyDark ? 'text-emerald-400' : 'text-emerald-600',
                            )} />
                            <span className={cn(
                                'text-sm font-medium',
                                isCurrentlyDark ? 'text-white/80' : 'text-black/80',
                            )}>
                                Select File
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
                                placeholder="Search files..."
                                className={cn(
                                    'flex-1 bg-transparent text-sm outline-none',
                                    isCurrentlyDark
                                        ? 'text-white/80 placeholder:text-white/30'
                                        : 'text-black/80 placeholder:text-black/30',
                                )}
                            />
                        </div>
                    </div>

                    {/* File List */}
                    <div className="max-h-40 overflow-y-auto px-2">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-4">
                                <Loader2 className="animate-spin" size={20} />
                            </div>
                        ) : filteredFiles.length === 0 ? (
                            <p className={cn(
                                'text-center py-4 text-sm',
                                isCurrentlyDark ? 'text-white/40' : 'text-black/40',
                            )}>
                                {searchQuery ? 'No files found' : 'No files uploaded yet'}
                            </p>
                        ) : (
                            filteredFiles.slice(0, 5).map((file) => {
                                const FileIcon = getFileIcon(file.filename);
                                return (
                                    <button
                                        key={file.file_id}
                                        onClick={() => handleSelectFile(file)}
                                        className={cn(
                                            'w-full flex items-center gap-2 text-left px-3 py-2 rounded-lg mb-1',
                                            'transition-colors duration-100',
                                            isCurrentlyDark
                                                ? 'hover:bg-white/10'
                                                : 'hover:bg-black/5',
                                        )}
                                    >
                                        <FileIcon size={16} className={cn(
                                            isCurrentlyDark ? 'text-emerald-400' : 'text-emerald-600',
                                        )} />
                                        <div className="flex-1 min-w-0">
                                            <p className={cn(
                                                'text-sm truncate',
                                                isCurrentlyDark ? 'text-white/80' : 'text-black/80',
                                            )}>
                                                {file.filename}
                                            </p>
                                        </div>
                                    </button>
                                );
                            })
                        )}
                    </div>

                    {/* Upload */}
                    <div className={cn(
                        'border-t p-2',
                        isCurrentlyDark ? 'border-white/10' : 'border-black/10',
                    )}>
                        <input
                            ref={fileInputRef}
                            type="file"
                            onChange={handleFileUpload}
                            className="hidden"
                            id="file-upload-input"
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploadFile.isLoading}
                            className={cn(
                                'w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg',
                                'text-sm transition-colors',
                                isCurrentlyDark
                                    ? 'text-emerald-300 hover:bg-emerald-500/20'
                                    : 'text-emerald-600 hover:bg-emerald-100',
                                'disabled:opacity-50 disabled:cursor-not-allowed',
                            )}
                        >
                            {uploadFile.isLoading ? (
                                <>
                                    <Loader2 size={14} className="animate-spin" />
                                    Uploading...
                                </>
                            ) : (
                                <>
                                    <Upload size={14} />
                                    Upload new file
                                </>
                            )}
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

export default memo(FilesPickerPopover);
