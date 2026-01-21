/**
 * CommandMenu - Floating command menu for Decision Surface
 *
 * A minimalist radial/floating menu triggered by the hamburger icon.
 * Provides quick access to essential actions without sidebars.
 */

import { memo, useCallback, useEffect, useRef, useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Settings as SettingsIcon,
    MessageSquare,
    Sparkles,
    Share2,
    CheckCircle,
    Clock,
    X,
} from 'lucide-react';
import { ThemeContext, isDark } from '@librechat/client';
import { cn } from '~/utils';

export interface CommandMenuProps {
    /** Callback when Settings is selected */
    onOpenSettings?: () => void;
    /** Callback when Trace/Timeline is selected */
    onToggleTrace?: () => void;
    /** Callback when End Session is selected */
    onEndSession?: () => void;
    /** Callback when Export is selected */
    onExport?: () => void;
    /** Whether trace is currently open */
    traceOpen?: boolean;
    /** Class name for positioning */
    className?: string;
}

interface MenuItem {
    id: string;
    label: string;
    icon: React.ReactNode;
    action: () => void;
    variant?: 'default' | 'accent' | 'danger';
}

function CommandMenu({
    onOpenSettings,
    onToggleTrace,
    onEndSession,
    onExport,
    traceOpen = false,
    className,
}: CommandMenuProps) {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();

    // Theme context
    const { theme } = useContext(ThemeContext);
    const isCurrentlyDark = isDark(theme);

    // Close menu when clicking outside
    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscape);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [isOpen]);

    // Menu items
    const menuItems: MenuItem[] = [
        {
            id: 'trace',
            label: traceOpen ? 'Hide Timeline' : 'View Timeline',
            icon: <Clock className="h-4 w-4" />,
            action: () => {
                onToggleTrace?.();
                setIsOpen(false);
            },
        },
        {
            id: 'chat',
            label: 'Switch to Chat',
            icon: <MessageSquare className="h-4 w-4" />,
            action: () => {
                navigate('/c/new');
                setIsOpen(false);
            },
        },
        {
            id: 'new-decision',
            label: 'New Decision',
            icon: <Sparkles className="h-4 w-4" />,
            action: () => {
                navigate('/d/new');
                setIsOpen(false);
            },
            variant: 'accent',
        },
        {
            id: 'export',
            label: 'Export',
            icon: <Share2 className="h-4 w-4" />,
            action: () => {
                onExport?.();
                setIsOpen(false);
            },
        },
        {
            id: 'settings',
            label: 'Settings',
            icon: <SettingsIcon className="h-4 w-4" />,
            action: () => {
                onOpenSettings?.();
                setIsOpen(false);
            },
        },
        {
            id: 'done',
            label: "I've Decided",
            icon: <CheckCircle className="h-4 w-4" />,
            action: () => {
                onEndSession?.();
                setIsOpen(false);
            },
            variant: 'accent',
        },
    ];

    const toggleMenu = useCallback(() => {
        setIsOpen((prev) => !prev);
    }, []);

    return (
        <div ref={menuRef} className={cn('relative', className)}>
            <motion.button
                onClick={toggleMenu}
                className={cn(
                    'p-2 rounded-full',
                    'transition-colors duration-150',
                    isCurrentlyDark
                        ? 'text-white/40 hover:text-white/70 hover:bg-white/10 focus:ring-white/20'
                        : 'text-slate-500 hover:text-slate-700 hover:bg-black/10 focus:ring-black/20',
                    'focus:outline-none focus:ring-2',
                    isOpen && (isCurrentlyDark ? 'bg-white/10 text-white/70' : 'bg-black/10 text-slate-700'),
                )}
                whileTap={{ scale: 0.95 }}
                aria-label="Open menu"
                aria-expanded={isOpen}
            >
                <AnimatePresence mode="wait">
                    {isOpen ? (
                        <motion.div
                            key="close"
                            initial={{ rotate: -90, opacity: 0 }}
                            animate={{ rotate: 0, opacity: 1 }}
                            exit={{ rotate: 90, opacity: 0 }}
                            transition={{ duration: 0.15 }}
                        >
                            <X className="h-5 w-5" />
                        </motion.div>
                    ) : (
                        <motion.div
                            key="menu"
                            initial={{ rotate: 90, opacity: 0 }}
                            animate={{ rotate: 0, opacity: 1 }}
                            exit={{ rotate: -90, opacity: 0 }}
                            transition={{ duration: 0.15 }}
                        >
                            <svg
                                className="h-5 w-5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={1.5}
                                    d="M4 6h16M4 12h16M4 18h16"
                                />
                            </svg>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.button>

            {/* Menu Panel */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: -10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: -10 }}
                        transition={{
                            type: 'spring',
                            stiffness: 400,
                            damping: 25,
                        }}
                        className={cn(
                            'absolute right-0 top-full mt-2',
                            'min-w-[180px]',
                            'rounded-xl',
                            'backdrop-blur-xl',
                            'shadow-2xl',
                            'overflow-hidden',
                            'z-50',
                            isCurrentlyDark
                                ? 'bg-black/80 border border-white/10 shadow-black/50'
                                : 'bg-white/95 border border-black/10 shadow-black/20',
                        )}
                    >
                        <div className="py-2">
                            {menuItems.map((item, index) => (
                                <motion.button
                                    key={item.id}
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{
                                        delay: index * 0.03,
                                        duration: 0.15,
                                    }}
                                    onClick={item.action}
                                    className={cn(
                                        'w-full px-4 py-2.5',
                                        'flex items-center gap-3',
                                        'text-sm text-left',
                                        'transition-colors duration-100',
                                        item.variant === 'accent'
                                            ? 'text-emerald-500 hover:bg-emerald-500/20'
                                            : item.variant === 'danger'
                                                ? 'text-red-500 hover:bg-red-500/20'
                                                : isCurrentlyDark
                                                    ? 'text-white/70 hover:text-white hover:bg-white/10'
                                                    : 'text-slate-600 hover:text-slate-900 hover:bg-black/5',
                                    )}
                                >
                                    <span
                                        className={cn(
                                            'flex-shrink-0',
                                            item.variant === 'accent' && 'text-emerald-400',
                                            item.variant === 'danger' && 'text-red-400',
                                        )}
                                    >
                                        {item.icon}
                                    </span>
                                    <span>{item.label}</span>
                                </motion.button>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default memo(CommandMenu);
