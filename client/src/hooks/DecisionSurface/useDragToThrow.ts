/**
 * OptimismAI - Living Decision Surface
 * useDragToThrow - Hook for drag-to-throw gesture handling
 *
 * Enables users to drag question nodes with directional actions:
 * - Throw LEFT = dismiss/erase the node
 * - Throw RIGHT = regenerate with "improve" context
 * - Regular drag = reposition the node freely
 */

import { useCallback, useRef, useState, useEffect } from 'react';
import { THROW } from '~/components/DecisionSurface/nodeMotionConfig';
import type { Position } from '~/common/DecisionSession.types';

// ============================================================================
// Types
// ============================================================================

export type ThrowDirection = 'left' | 'right' | 'up' | 'down';

/**
 * Action type based on throw direction
 * - dismiss: Throw left - remove node from surface
 * - regenerate: Throw right - get improved question
 * - reposition: Low velocity - just move the node
 */
export type ThrowAction = 'dismiss' | 'regenerate' | 'reposition';

/**
 * Visual feedback zone for throw direction
 */
export type ThrowZone = 'dismiss' | 'regenerate' | null;

interface DragState {
    isDragging: boolean;
    startPosition: Position;
    currentOffset: Position;
    velocity: Position;
}

interface UseDragToThrowOptions {
    /** Node ID being dragged */
    nodeId: string;
    /** Callback when node is thrown or repositioned */
    onThrowAction: (nodeId: string, action: ThrowAction, newPosition?: Position) => void;
    /** Whether drag is enabled (default: true) */
    enabled?: boolean;
    /** Minimum velocity to trigger throw (default: from config) */
    velocityThreshold?: number;
    /** Container bounds for boundary detection */
    containerRef?: React.RefObject<HTMLElement>;
    /** Current node position (for calculating final position) */
    nodePosition?: Position;
}

interface UseDragToThrowResult {
    /** Handlers to attach to the draggable element */
    dragHandlers: {
        onMouseDown: (e: React.MouseEvent) => void;
        onTouchStart: (e: React.TouchEvent) => void;
    };
    /** Current drag offset for visual feedback */
    dragOffset: Position;
    /** Whether currently dragging */
    isDragging: boolean;
    /** Whether node is being thrown out (exit animation) */
    isExiting: boolean;
    /** Exit direction if exiting */
    exitDirection: ThrowDirection | null;
    /** Active throw zone for visual feedback (dismiss = left, regenerate = right) */
    pendingZone: ThrowZone;
}

// ============================================================================
// Velocity Tracking
// ============================================================================

interface VelocityTracker {
    positions: Array<{ x: number; y: number; time: number }>;
    maxSamples: number;
}

function createVelocityTracker(maxSamples = 5): VelocityTracker {
    return { positions: [], maxSamples };
}

function trackPosition(tracker: VelocityTracker, x: number, y: number): void {
    const now = performance.now();
    tracker.positions.push({ x, y, time: now });

    // Keep only recent samples
    if (tracker.positions.length > tracker.maxSamples) {
        tracker.positions.shift();
    }
}

function calculateVelocity(tracker: VelocityTracker): Position {
    if (tracker.positions.length < 2) {
        return { x: 0, y: 0 };
    }

    const first = tracker.positions[0];
    const last = tracker.positions[tracker.positions.length - 1];
    const timeDelta = (last.time - first.time) / 1000; // Convert to seconds

    if (timeDelta === 0) {
        return { x: 0, y: 0 };
    }

    return {
        x: (last.x - first.x) / timeDelta,
        y: (last.y - first.y) / timeDelta,
    };
}

// ============================================================================
// Hook
// ============================================================================

export function useDragToThrow({
    nodeId,
    onThrowAction,
    enabled = true,
    velocityThreshold = THROW.VELOCITY_THRESHOLD,
    containerRef,
    nodePosition = { x: 0, y: 0 },
}: UseDragToThrowOptions): UseDragToThrowResult {
    const [dragState, setDragState] = useState<DragState>({
        isDragging: false,
        startPosition: { x: 0, y: 0 },
        currentOffset: { x: 0, y: 0 },
        velocity: { x: 0, y: 0 },
    });

    const [isExiting, setIsExiting] = useState(false);
    const [exitDirection, setExitDirection] = useState<ThrowDirection | null>(null);
    const [pendingZone, setPendingZone] = useState<ThrowZone>(null);

    const velocityTrackerRef = useRef<VelocityTracker>(createVelocityTracker());
    const animationFrameRef = useRef<number>();

    /**
     * Determine throw direction from velocity
     */
    const getThrowDirection = useCallback((velocity: Position): ThrowDirection => {
        const absX = Math.abs(velocity.x);
        const absY = Math.abs(velocity.y);

        if (absX > absY) {
            return velocity.x > 0 ? 'right' : 'left';
        } else {
            return velocity.y > 0 ? 'down' : 'up';
        }
    }, []);

    /**
     * Convert throw direction to action
     * LEFT = dismiss, RIGHT = regenerate, UP/DOWN = reposition
     */
    const directionToAction = useCallback((direction: ThrowDirection): ThrowAction => {
        switch (direction) {
            case 'left':
                return 'dismiss';
            case 'right':
                return 'regenerate';
            default:
                return 'reposition';
        }
    }, []);

    // Zone width constant - matches ThrowZoneOverlay (w-32 = 128px)
    const ZONE_WIDTH = 128;

    /**
     * Get pending zone based on absolute screen position of the node
     * This uses the node's final rendered position on screen
     */
    const calculatePendingZone = useCallback((offset: Position): ThrowZone => {
        const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;

        // Calculate where the node center is on screen
        // nodePosition is in screen coordinates, offset is the drag delta
        const nodeScreenX = nodePosition.x + offset.x;

        // Check if node center is in the left zone (dismiss)
        if (nodeScreenX < ZONE_WIDTH) {
            return 'dismiss';
        }
        // Check if node center is in the right zone (regenerate)
        if (nodeScreenX > screenWidth - ZONE_WIDTH) {
            return 'regenerate';
        }
        return null;
    }, [nodePosition.x]);

    /**
     * Check if position is outside container bounds
     */
    const isOutOfBounds = useCallback((offset: Position): boolean => {
        const container = containerRef?.current || document.body;
        const rect = container.getBoundingClientRect();
        const margin = THROW.BOUNDARY_MARGIN;

        return (
            offset.x < -margin ||
            offset.x > rect.width + margin ||
            offset.y < -margin ||
            offset.y > rect.height + margin
        );
    }, [containerRef]);

    /**
     * Handle drag end - determine action based on which zone the node is in
     * Position-based detection: action is determined by WHERE the node is, not throw velocity
     */
    const handleDragEnd = useCallback(() => {
        const currentOffset = dragState.currentOffset;

        // Get the current zone based on node's screen position
        const currentZone = calculatePendingZone(currentOffset);

        // Debug logging
        console.log('[useDragToThrow] handleDragEnd:', {
            nodeId,
            currentOffset,
            nodePosition,
            calculatedScreenX: nodePosition.x + currentOffset.x,
            currentZone,
            screenWidth: typeof window !== 'undefined' ? window.innerWidth : 1200,
            ZONE_WIDTH,
        });

        if (currentZone === 'dismiss') {
            // Node is in the left dismiss zone
            console.log('[useDragToThrow] Triggering DISMISS action');
            setIsExiting(true);
            setExitDirection('left');

            // Trigger callback after brief delay for exit animation
            setTimeout(() => {
                onThrowAction(nodeId, 'dismiss');
                setIsExiting(false);
                setExitDirection(null);
            }, THROW.EXIT_DURATION);
        } else if (currentZone === 'regenerate') {
            // Node is in the right regenerate zone
            setIsExiting(true);
            setExitDirection('right');

            // Trigger callback after brief delay for exit animation
            setTimeout(() => {
                onThrowAction(nodeId, 'regenerate');
                setIsExiting(false);
                setExitDirection(null);
            }, THROW.EXIT_DURATION);
        } else if (currentOffset.x !== 0 || currentOffset.y !== 0) {
            // Node is in neutral zone - just reposition
            const newPosition: Position = {
                x: nodePosition.x + currentOffset.x,
                y: nodePosition.y + currentOffset.y,
            };
            onThrowAction(nodeId, 'reposition', newPosition);
        }

        // Reset drag state
        setDragState({
            isDragging: false,
            startPosition: { x: 0, y: 0 },
            currentOffset: { x: 0, y: 0 },
            velocity: { x: 0, y: 0 },
        });

        // Reset zones
        setPendingZone(null);

        // Reset velocity tracker
        velocityTrackerRef.current = createVelocityTracker();
    }, [nodeId, nodePosition, dragState.currentOffset, onThrowAction, calculatePendingZone]);

    /**
     * Handle pointer move during drag
     */
    const handlePointerMove = useCallback((clientX: number, clientY: number) => {
        if (!dragState.isDragging) return;

        const offsetX = clientX - dragState.startPosition.x;
        const offsetY = clientY - dragState.startPosition.y;

        trackPosition(velocityTrackerRef.current, clientX, clientY);

        // Update pending zone for visual feedback
        setPendingZone(calculatePendingZone({ x: offsetX, y: offsetY }));

        setDragState(prev => ({
            ...prev,
            currentOffset: { x: offsetX, y: offsetY },
            velocity: calculateVelocity(velocityTrackerRef.current),
        }));
    }, [dragState.isDragging, dragState.startPosition, calculatePendingZone]);

    /**
     * Mouse event handlers
     */
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (!enabled) return;

        e.preventDefault();
        e.stopPropagation();

        setDragState({
            isDragging: true,
            startPosition: { x: e.clientX, y: e.clientY },
            currentOffset: { x: 0, y: 0 },
            velocity: { x: 0, y: 0 },
        });

        trackPosition(velocityTrackerRef.current, e.clientX, e.clientY);
    }, [enabled]);

    /**
     * Touch event handlers
     */
    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        if (!enabled) return;

        const touch = e.touches[0];

        setDragState({
            isDragging: true,
            startPosition: { x: touch.clientX, y: touch.clientY },
            currentOffset: { x: 0, y: 0 },
            velocity: { x: 0, y: 0 },
        });

        trackPosition(velocityTrackerRef.current, touch.clientX, touch.clientY);
    }, [enabled]);

    /**
     * Global mouse/touch move and up handlers
     */
    useEffect(() => {
        if (!dragState.isDragging) return;

        const handleMouseMove = (e: MouseEvent) => {
            handlePointerMove(e.clientX, e.clientY);
        };

        const handleTouchMove = (e: TouchEvent) => {
            const touch = e.touches[0];
            handlePointerMove(touch.clientX, touch.clientY);
        };

        const handleMouseUp = () => {
            handleDragEnd();
        };

        const handleTouchEnd = () => {
            handleDragEnd();
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        window.addEventListener('touchmove', handleTouchMove, { passive: true });
        window.addEventListener('touchend', handleTouchEnd);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            window.removeEventListener('touchmove', handleTouchMove);
            window.removeEventListener('touchend', handleTouchEnd);
        };
    }, [dragState.isDragging, handlePointerMove, handleDragEnd]);

    /**
     * Cleanup animation frame on unmount
     */
    useEffect(() => {
        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, []);

    return {
        dragHandlers: {
            onMouseDown: handleMouseDown,
            onTouchStart: handleTouchStart,
        },
        dragOffset: isExiting ? getExitOffset(exitDirection, dragState.currentOffset) : dragState.currentOffset,
        isDragging: dragState.isDragging,
        isExiting,
        exitDirection,
        pendingZone,
    };
}

/**
 * Calculate exit offset based on direction (for smooth exit animation)
 */
function getExitOffset(direction: ThrowDirection | null, currentOffset: Position): Position {
    if (!direction) return currentOffset;

    const exitDistance = 500; // Distance to animate off-screen

    switch (direction) {
        case 'left':
            return { x: -exitDistance, y: currentOffset.y };
        case 'right':
            return { x: exitDistance, y: currentOffset.y };
        case 'up':
            return { x: currentOffset.x, y: -exitDistance };
        case 'down':
            return { x: currentOffset.x, y: exitDistance };
        default:
            return currentOffset;
    }
}

export default useDragToThrow;
