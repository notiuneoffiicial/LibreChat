/**
 * OptimismAI - Living Decision Surface
 * useMagneticField - Manages tension point clustering and fading dynamics
 * 
 * Implements the magnetic field behavior where related tension points
 * drift toward each other and noise fades away.
 */

import { useCallback, useEffect, useRef } from 'react';
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil';
import { v4 as uuidv4 } from 'uuid';
import store from '~/store';
import { CLUSTERING, FADING, STABILITY } from '~/components/DecisionSurface/nodeMotionConfig';
import type { ThoughtNodeData, ConceptCluster, Position } from '~/common/DecisionSession.types';

interface MagneticFieldState {
    /** Whether the field dynamics are running */
    isActive: boolean;
    /** Time of last update */
    lastUpdate: number;
}

/**
 * Calculate distance between two positions
 */
function distance(a: Position, b: Position): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate affinity between two nodes based on their concepts
 * Returns 0-1 where higher means stronger attraction
 */
function calculateAffinity(nodeA: ThoughtNodeData, nodeB: ThoughtNodeData): number {
    // If either node has explicit affinities map, use that
    if (nodeA.affinities?.has(nodeB.id)) {
        return nodeA.affinities.get(nodeB.id) ?? 0;
    }

    // Fallback: calculate based on shared topic or concept similarity
    // Nodes with same topicKey are somewhat related
    if (nodeA.topicKey === nodeB.topicKey) {
        return 0.3;
    }

    // Nodes with same concept are strongly related
    if (nodeA.concept && nodeB.concept && nodeA.concept === nodeB.concept) {
        return 0.8;
    }

    // Base affinity for all nodes (slight attraction)
    return 0.1;
}

/**
 * Calculate centroid of a group of positions
 */
function calculateCentroid(nodes: ThoughtNodeData[]): Position {
    if (nodes.length === 0) return { x: 0, y: 0 };

    const sum = nodes.reduce(
        (acc, n) => ({ x: acc.x + n.position.x, y: acc.y + n.position.y }),
        { x: 0, y: 0 }
    );

    return {
        x: sum.x / nodes.length,
        y: sum.y / nodes.length,
    };
}

/**
 * Group nodes into clusters based on proximity
 */
function clusterByProximity(nodes: ThoughtNodeData[]): ThoughtNodeData[][] {
    const visited = new Set<string>();
    const clusters: ThoughtNodeData[][] = [];

    for (const node of nodes) {
        if (visited.has(node.id)) continue;

        // BFS to find all connected nodes
        const cluster: ThoughtNodeData[] = [];
        const queue = [node];

        while (queue.length > 0) {
            const current = queue.shift()!;
            if (visited.has(current.id)) continue;

            visited.add(current.id);
            cluster.push(current);

            // Find nearby nodes
            for (const other of nodes) {
                if (visited.has(other.id)) continue;
                if (distance(current.position, other.position) < CLUSTERING.CLUSTER_DISTANCE_THRESHOLD) {
                    queue.push(other);
                }
            }
        }

        if (cluster.length > 0) {
            clusters.push(cluster);
        }
    }

    return clusters;
}

/**
 * useMagneticField - Hook for managing tension point dynamics
 */
export function useMagneticField() {
    const [nodes, setNodes] = useRecoilState(store.thoughtNodesAtom);
    const [clusters, setClusters] = useRecoilState(store.clustersAtom);
    const phase = useRecoilValue(store.sessionPhaseAtom);
    const totalTension = useRecoilValue(store.totalTensionSelector);

    const stateRef = useRef<MagneticFieldState>({
        isActive: false,
        lastUpdate: Date.now(),
    });

    const intervalRef = useRef<number | null>(null);
    const clusterHistoryRef = useRef<Map<string, { centroid: Position; stableSince?: number }>>(new Map());

    /**
     * Calculate forces for a single node and return new position
     */
    const calculateForces = useCallback((node: ThoughtNodeData, allNodes: ThoughtNodeData[]): Position => {
        if (node.state === 'DISSOLVED' || node.state === 'FADING') {
            return node.position;
        }

        let forceX = 0;
        let forceY = 0;

        // RESOLVED nodes should drift away from clusters, not attract
        const isResolved = node.state === 'RESOLVED';

        for (const other of allNodes) {
            if (other.id === node.id) continue;
            if (other.state === 'DISSOLVED' || other.state === 'FADING') continue;

            const dx = other.position.x - node.position.x;
            const dy = other.position.y - node.position.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Repulsion when too close - always applies
            if (dist < CLUSTERING.MIN_DISTANCE) {
                const repulsion = CLUSTERING.REPULSION_CONSTANT * (1 - dist / CLUSTERING.REPULSION_DISTANCE);
                forceX -= (dx / dist) * repulsion;
                forceY -= (dy / dist) * repulsion;
                continue;
            }

            if (dist > CLUSTERING.MAX_DISTANCE) continue;

            // RESOLVED nodes repel from everything (drift outward from clusters)
            if (isResolved) {
                const repulsion = (CLUSTERING.REPULSION_CONSTANT * 0.5) / Math.max(dist, 1);
                forceX -= (dx / dist) * repulsion;
                forceY -= (dy / dist) * repulsion;
                continue;
            }

            // Skip attraction if other node is resolved (don't get pulled toward resolved nodes)
            if (other.state === 'RESOLVED') continue;

            // Calculate attraction based on affinity (only for non-resolved nodes)
            const affinity = calculateAffinity(node, other);
            if (affinity <= 0) continue;

            const force = (affinity * CLUSTERING.ATTRACTION_CONSTANT) / dist;
            forceX += (dx / dist) * force;
            forceY += (dy / dist) * force;
        }

        // Apply damping and return new position
        return {
            x: node.position.x + forceX * CLUSTERING.DAMPING,
            y: node.position.y + forceY * CLUSTERING.DAMPING,
        };
    }, []);

    /**
     * Update clusters based on current node positions
     */
    const updateClusters = useCallback((currentNodes: ThoughtNodeData[]) => {
        const activeNodes = currentNodes.filter(
            n => n.state !== 'DISSOLVED' && n.state !== 'FADING'
        );

        const nodeGroups = clusterByProximity(activeNodes);

        const newClusters: ConceptCluster[] = nodeGroups.map(group => {
            const centroid = calculateCentroid(group);
            const totalIntensity = group.reduce((sum, n) => sum + (n.intensity ?? 0.5), 0);
            const dominance = totalTension > 0 ? totalIntensity / totalTension : 0;

            // Check for existing cluster at this location
            const existingKey = group.map(g => g.id).sort().join(',');
            const history = clusterHistoryRef.current.get(existingKey);

            // Check if cluster has moved significantly
            let stable = false;
            let stableSince = history?.stableSince;

            if (history) {
                const moved = distance(history.centroid, centroid);
                if (moved < STABILITY.MOVEMENT_THRESHOLD) {
                    if (!stableSince) {
                        stableSince = Date.now();
                    } else if (Date.now() - stableSince > STABILITY.STABLE_DURATION) {
                        stable = true;
                    }
                } else {
                    stableSince = undefined;
                }
            }

            // Update history
            clusterHistoryRef.current.set(existingKey, { centroid, stableSince });

            return {
                id: existingKey,
                tensionPointIds: group.map(n => n.id),
                centroid,
                coherence: group.length > 1 ? 0.5 + (0.5 * (1 - Math.min(1, dominance))) : 1,
                dominance,
                stable,
                stableSince,
            };
        });

        setClusters(newClusters);
    }, [totalTension, setClusters]);

    /**
     * Apply fading to low-intensity nodes
     */
    const applyFading = useCallback((currentNodes: ThoughtNodeData[]): ThoughtNodeData[] => {
        const now = Date.now();

        return currentNodes.map(node => {
            // Don't fade recently created nodes
            if (now - node.createdAt < FADING.GRACE_PERIOD) {
                return node;
            }

            // Don't fade probing or resolved nodes
            if (node.state === 'PROBING' || node.state === 'RESOLVED') {
                return node;
            }

            // Check if this is signal (protected from fading)
            const intensity = node.intensity ?? 0.5;
            const isSignal = intensity > FADING.SIGNAL_THRESHOLD;

            if (isSignal) {
                return node;
            }

            // Apply fade rate
            const newIntensity = intensity * FADING.FADE_RATE;

            // Check for state transitions
            let newState = node.state;
            if (newIntensity < FADING.DISSOLVE_THRESHOLD) {
                newState = 'DISSOLVED';
            } else if (newIntensity < FADING.FADING_THRESHOLD) {
                newState = 'FADING';
            }

            return {
                ...node,
                intensity: newIntensity,
                state: newState,
            };
        });
    }, []);

    /**
     * Single update tick for field dynamics
     */
    const tick = useCallback(() => {
        setNodes(currentNodes => {
            // Skip if in settling or silent phase
            if (phase === 'SETTLING' || phase === 'SILENT') {
                return currentNodes;
            }

            // Calculate new positions based on forces
            const withNewPositions = currentNodes.map(node => ({
                ...node,
                position: calculateForces(node, currentNodes),
            }));

            // Apply fading to low-intensity nodes
            const withFading = applyFading(withNewPositions);

            // Update clusters
            updateClusters(withFading);

            return withFading;
        });

        stateRef.current.lastUpdate = Date.now();
    }, [phase, calculateForces, applyFading, updateClusters, setNodes]);

    /**
     * Start the field dynamics loop
     */
    const start = useCallback(() => {
        if (stateRef.current.isActive) return;

        stateRef.current.isActive = true;
        intervalRef.current = window.setInterval(tick, CLUSTERING.UPDATE_INTERVAL);
    }, [tick]);

    /**
     * Stop the field dynamics loop
     */
    const stop = useCallback(() => {
        stateRef.current.isActive = false;
        if (intervalRef.current) {
            window.clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    }, []);

    /**
     * Manually trigger a field update (e.g., after answer processed)
     */
    const triggerUpdate = useCallback(() => {
        tick();
    }, [tick]);

    /**
     * Set affinity between two nodes
     */
    const setAffinity = useCallback((nodeIdA: string, nodeIdB: string, strength: number) => {
        setNodes(current => current.map(node => {
            if (node.id === nodeIdA) {
                const affinities = new Map(node.affinities ?? []);
                affinities.set(nodeIdB, strength);
                return { ...node, affinities };
            }
            if (node.id === nodeIdB) {
                const affinities = new Map(node.affinities ?? []);
                affinities.set(nodeIdA, strength);
                return { ...node, affinities };
            }
            return node;
        }));
    }, [setNodes]);

    // Auto-start when in exploring phase
    useEffect(() => {
        if (phase === 'EXPLORING') {
            start();
        } else {
            stop();
        }

        return () => stop();
    }, [phase, start, stop]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (intervalRef.current) {
                window.clearInterval(intervalRef.current);
            }
        };
    }, []);

    return {
        /** Start the magnetic field dynamics */
        start,
        /** Stop the magnetic field dynamics */
        stop,
        /** Manually trigger a field update */
        triggerUpdate,
        /** Set affinity between two nodes */
        setAffinity,
        /** Whether the field is currently active */
        isActive: stateRef.current.isActive,
        /** Current clusters */
        clusters,
    };
}
