/**
 * OptimismAI - Living Decision Surface
 * ProgressPathway - Horizontal breadcrumb trail of resolved questions
 *
 * Shows the user's journey toward clarity as a visual progression at the top.
 * Each resolved question appears as a compact node connected by arrows.
 */

import { memo, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { animated, useSpring, useTransition } from '@react-spring/web';
import store from '~/store';
import { cn } from '~/utils';
import type { PathwayNode } from '~/common/DecisionSession.types';

interface ProgressPathwayProps {
    /** Whether dark mode is active */
    isDarkMode: boolean;
}

/**
 * Individual pathway node in the breadcrumb trail
 */
function PathwayNodeItem({
    node,
    isLast,
    isDarkMode,
    onClick,
}: {
    node: PathwayNode;
    isLast: boolean;
    isDarkMode: boolean;
    onClick: (node: PathwayNode) => void;
}) {
    const [isHovered, setIsHovered] = useState(false);

    // Truncate question for display
    const shortQuestion = node.question.length > 40
        ? node.question.substring(0, 37) + '...'
        : node.question;

    return (
        <div className="flex items-center">
            {/* Node */}
            <button
                className={cn(
                    'relative px-3 py-1.5 rounded-lg text-xs font-medium',
                    'transition-all duration-200 cursor-pointer',
                    'border backdrop-blur-sm',
                    isDarkMode
                        ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/30'
                        : 'bg-emerald-100 border-emerald-300/50 text-emerald-700 hover:bg-emerald-200',
                    'flex items-center gap-1.5'
                )}
                onClick={() => onClick(node)}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                {/* Checkmark icon */}
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    className="shrink-0"
                >
                    <polyline points="20 6 9 17 4 12" />
                </svg>
                <span className="truncate max-w-[150px]">{shortQuestion}</span>

                {/* Expanded tooltip on hover */}
                {isHovered && (
                    <div className={cn(
                        'absolute left-0 top-full mt-2 z-50 p-3 rounded-lg shadow-lg',
                        'min-w-[250px] max-w-[350px]',
                        isDarkMode
                            ? 'bg-slate-900 border border-white/10 text-white'
                            : 'bg-white border border-black/10 text-slate-800'
                    )}>
                        <p className="text-xs font-medium mb-1">{node.question}</p>
                        <p className={cn(
                            'text-xs',
                            isDarkMode ? 'text-white/60' : 'text-slate-500'
                        )}>
                            {node.answer}
                        </p>
                    </div>
                )}
            </button>

            {/* Arrow connector (except for last item) */}
            {!isLast && (
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className={cn(
                        'mx-1 shrink-0',
                        isDarkMode ? 'text-white/20' : 'text-black/20'
                    )}
                >
                    <path d="m9 18 6-6-6-6" />
                </svg>
            )}
        </div>
    );
}

/**
 * ProgressPathway - Main component
 */
function ProgressPathway({ isDarkMode }: ProgressPathwayProps) {
    const pathwayNodes = useRecoilValue(store.progressPathwayAtom);
    const sessionPhase = useRecoilValue(store.decisionSessionAtom)?.phase;
    const [expandedNode, setExpandedNode] = useState<PathwayNode | null>(null);

    // Animation for the container
    const containerSpring = useSpring({
        opacity: pathwayNodes.length > 0 ? 1 : 0,
        y: pathwayNodes.length > 0 ? 0 : -20,
        config: { tension: 280, friction: 24 },
    });

    // Transitions for individual nodes
    const transitions = useTransition(pathwayNodes, {
        keys: (node) => node.id,
        from: { opacity: 0, scale: 0.8, x: -20 },
        enter: { opacity: 1, scale: 1, x: 0 },
        leave: { opacity: 0, scale: 0.8, x: 20 },
        config: { tension: 300, friction: 25 },
    });

    // Don't render if no nodes in pathway
    if (pathwayNodes.length === 0) {
        return null;
    }

    const handleNodeClick = (node: PathwayNode) => {
        setExpandedNode(expandedNode?.id === node.id ? null : node);
    };

    return (
        <animated.div
            className={cn(
                'fixed top-0 left-0 right-0 z-40',
                'flex items-center justify-center',
                'px-4 py-2',
                isDarkMode
                    ? 'bg-gradient-to-b from-black/40 to-transparent'
                    : 'bg-gradient-to-b from-white/60 to-transparent',
                'backdrop-blur-sm'
            )}
            style={{
                opacity: containerSpring.opacity,
                transform: containerSpring.y.to(y => `translateY(${y}px)`),
            }}
        >
            {/* Pathway container */}
            <div className="flex items-center gap-1 overflow-x-auto max-w-full py-1 px-2">
                {/* Progress label */}
                <div className={cn(
                    'text-xs font-medium mr-2 shrink-0',
                    isDarkMode ? 'text-white/40' : 'text-black/40'
                )}>
                    Progress
                </div>

                {/* Pathway nodes */}
                {transitions((style, node, _, index) => (
                    <animated.div style={style} key={node.id}>
                        <PathwayNodeItem
                            node={node}
                            isLast={index === pathwayNodes.length - 1}
                            isDarkMode={isDarkMode}
                            onClick={handleNodeClick}
                        />
                    </animated.div>
                ))}

                {/* Clarity destination indicator */}
                <div className="flex items-center ml-2 shrink-0">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className={cn(
                            'mx-1',
                            isDarkMode ? 'text-white/20' : 'text-black/20'
                        )}
                    >
                        <path d="m9 18 6-6-6-6" />
                    </svg>
                    <div className={cn(
                        'px-3 py-1.5 rounded-lg text-xs font-medium',
                        'border border-dashed',
                        sessionPhase === 'SILENT'
                            ? isDarkMode
                                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                                : 'bg-amber-100 border-amber-400 text-amber-700'
                            : isDarkMode
                                ? 'bg-white/5 border-white/20 text-white/40'
                                : 'bg-black/5 border-black/20 text-black/40'
                    )}>
                        ⦿ Clarity
                    </div>
                </div>
            </div>
        </animated.div>
    );
}

export default memo(ProgressPathway);
