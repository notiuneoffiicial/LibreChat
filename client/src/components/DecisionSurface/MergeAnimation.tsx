/**
 * OptimismAI - Living Decision Surface
 * MergeAnimation - Visual effect when two nodes converge into an insight
 *
 * "Nodes begin to gravitate toward one another...
 * Eventually, two nodes merge into one insight"
 */

import { memo, useEffect, useState } from 'react';
import { animated, useSpring, useTrail } from '@react-spring/web';
import { cn } from '~/utils';
import { MERGE } from './nodeMotionConfig';
import type { Position, ThoughtNodeData } from '~/common/DecisionSession.types';

interface MergeAnimationProps {
    /** The two nodes being merged */
    nodes: [ThoughtNodeData, ThoughtNodeData];
    /** Midpoint where they converge */
    midpoint: Position;
    /** The resulting insight text */
    insightText: string;
    /** Called when animation completes */
    onComplete: () => void;
}

/**
 * MergeAnimation - Renders the merge sequence
 *
 * Animation stages:
 * 1. Nodes move to midpoint (280ms)
 * 2. Connector line fades in (120ms)
 * 3. Nodes fade out + shrink (180ms)
 * 4. Insight chip appears (180ms)
 */
function MergeAnimation({
    nodes,
    midpoint,
    insightText,
    onComplete,
}: MergeAnimationProps) {
    const [stage, setStage] = useState<'moving' | 'connecting' | 'fading' | 'appearing' | 'complete'>('moving');

    // Node positions moving to midpoint
    const [node1Spring] = useSpring(() => ({
        x: stage === 'moving' ? nodes[0].position.x : midpoint.x,
        y: stage === 'moving' ? nodes[0].position.y : midpoint.y,
        opacity: stage === 'fading' || stage === 'appearing' || stage === 'complete' ? 0 : 1,
        scale: stage === 'fading' || stage === 'appearing' || stage === 'complete' ? MERGE.FADE_OUT_SCALE : 1,
        config: { duration: MERGE.MOVE_DURATION },
    }), [stage, midpoint, nodes]);

    const [node2Spring] = useSpring(() => ({
        x: stage === 'moving' ? nodes[1].position.x : midpoint.x,
        y: stage === 'moving' ? nodes[1].position.y : midpoint.y,
        opacity: stage === 'fading' || stage === 'appearing' || stage === 'complete' ? 0 : 1,
        scale: stage === 'fading' || stage === 'appearing' || stage === 'complete' ? MERGE.FADE_OUT_SCALE : 1,
        config: { duration: MERGE.MOVE_DURATION },
    }), [stage, midpoint, nodes]);

    // Connector line
    const [connectorSpring] = useSpring(() => ({
        opacity: stage === 'connecting' || stage === 'fading' ? MERGE.CONNECTOR_OPACITY : 0,
        config: { duration: MERGE.CONNECTOR_FADE_DURATION },
    }), [stage]);

    // Insight chip
    const [insightSpring] = useSpring(() => ({
        opacity: stage === 'appearing' || stage === 'complete' ? 1 : 0,
        scale: stage === 'appearing' || stage === 'complete' ? 1 : MERGE.INSIGHT_INITIAL_SCALE,
        config: { duration: MERGE.INSIGHT_APPEAR_DURATION },
    }), [stage]);

    // Progress through animation stages
    useEffect(() => {
        const timers: NodeJS.Timeout[] = [];

        // Stage 1: Move to midpoint
        timers.push(setTimeout(() => setStage('connecting'), MERGE.MOVE_DURATION));

        // Stage 2: Show connector
        timers.push(setTimeout(() => setStage('fading'), MERGE.MOVE_DURATION + MERGE.CONNECTOR_FADE_DURATION));

        // Stage 3: Fade out nodes
        timers.push(setTimeout(() => setStage('appearing'), MERGE.MOVE_DURATION + MERGE.CONNECTOR_FADE_DURATION + MERGE.NODE_FADE_DURATION));

        // Stage 4: Show insight, then complete
        timers.push(setTimeout(() => {
            setStage('complete');
            onComplete();
        }, MERGE.MOVE_DURATION + MERGE.CONNECTOR_FADE_DURATION + MERGE.NODE_FADE_DURATION + MERGE.INSIGHT_APPEAR_DURATION));

        return () => timers.forEach(clearTimeout);
    }, [onComplete]);

    return (
        <div className="pointer-events-none absolute inset-0">
            {/* Connector line */}
            <animated.svg
                className="absolute inset-0 overflow-visible"
                style={{ opacity: connectorSpring.opacity }}
            >
                <line
                    x1={nodes[0].position.x}
                    y1={nodes[0].position.y}
                    x2={nodes[1].position.x}
                    y2={nodes[1].position.y}
                    stroke="rgba(255, 255, 255, 0.35)"
                    strokeWidth="1"
                    strokeDasharray="4,4"
                />
            </animated.svg>

            {/* Node 1 ghost */}
            <animated.div
                className="absolute -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white/5 px-4 py-3"
                style={{
                    left: node1Spring.x,
                    top: node1Spring.y,
                    opacity: node1Spring.opacity,
                    scale: node1Spring.scale,
                }}
            >
                <span className="text-sm text-white/60">{nodes[0].question}</span>
            </animated.div>

            {/* Node 2 ghost */}
            <animated.div
                className="absolute -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white/5 px-4 py-3"
                style={{
                    left: node2Spring.x,
                    top: node2Spring.y,
                    opacity: node2Spring.opacity,
                    scale: node2Spring.scale,
                }}
            >
                <span className="text-sm text-white/60">{nodes[1].question}</span>
            </animated.div>

            {/* Insight chip */}
            <animated.div
                className={cn(
                    'absolute -translate-x-1/2 -translate-y-1/2',
                    'rounded-2xl px-5 py-4',
                    'bg-white/10 backdrop-blur-lg',
                    'border border-white/20',
                    'shadow-xl',
                )}
                style={{
                    left: midpoint.x,
                    top: midpoint.y,
                    opacity: insightSpring.opacity,
                    scale: insightSpring.scale,
                }}
            >
                <div className="flex items-center gap-2">
                    <span className="text-amber-400">✦</span>
                    <span className="text-sm font-medium text-white/90">{insightText}</span>
                </div>
            </animated.div>
        </div>
    );
}

export default memo(MergeAnimation);
