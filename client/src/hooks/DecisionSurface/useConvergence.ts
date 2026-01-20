import { useCallback } from 'react';
import { useRecoilValue } from 'recoil';
import store from '~/store';
import { CONVERGENCE } from '~/components/DecisionSurface/nodeMotionConfig';

export function useConvergence() {
    const nodes = useRecoilValue(store.thoughtNodesAtom);
    const openLoops = useRecoilValue(store.openLoopsAtom);
    const behaviorSignals = useRecoilValue(store.behaviorSignalsAtom);
    const session = useRecoilValue(store.decisionSessionAtom);
    const clusters = useRecoilValue(store.clustersAtom);

    /**
     * Check if the field is eligible for silence
     */
    const checkConvergence = useCallback((): boolean => {
        // 1. Must have no open loops
        if (openLoops.some(l => l.status === 'open')) {
            console.log('[useConvergence] Open loops preventing silence');
            return false;
        }

        // 2. Must have sufficient resolved nodes (proxy for exploration depth)
        const resolvedCount = nodes.filter(n => n.state === 'RESOLVED').length;
        if (resolvedCount < CONVERGENCE.MIN_RESOLVED_NODES) {
            console.log('[useConvergence] Insufficient resolution for silence');
            return false;
        }

        // 3. Must not have recent confusion signals
        const now = Date.now();
        const recentConfusion = behaviorSignals.filter(
            s => s.indicates === 'confusion' && (now - s.timestamp < CONVERGENCE.CONFUSION_WINDOW)
        );
        if (recentConfusion.length > 0) {
            console.log('[useConvergence] Recent confusion preventing silence');
            return false;
        }

        // 4. Check for latent nodes (should be mostly resolved)
        const activeLatent = nodes.filter(n => n.state === 'LATENT' || n.state === 'PROBING');
        if (activeLatent.length > CONVERGENCE.MAX_ACTIVE_LATENT) {
            console.log('[useConvergence] Active latent nodes preventing silence');
            return false;
        }

        // 5. Check for dominant stable cluster (per plan spec)
        const dominantCluster = clusters.find(c => c.dominance > CONVERGENCE.CLUSTER_DOMINANCE_THRESHOLD);
        if (dominantCluster && !dominantCluster.stable) {
            console.log('[useConvergence] Dominant cluster not yet stable');
            return false;
        }

        return true;
    }, [nodes, openLoops, behaviorSignals, clusters]);

    /**
     * Generate a soft confirmation statement based on the session state
     */
    const generateConfirmationStatement = useCallback((): string => {
        // In a real system, this would be AI-generated from the cluster topics
        const topics = [...new Set(nodes.filter(n => n.topicKey).map(n => n.topicKey))];

        if (topics.includes('values') && topics.includes('reality')) {
            return "You've mapped out the key facts and how they align with your values. Does this picture feel complete?";
        }

        return "The field seems to have settled. Does this cover the main tensions you were feeling?";
    }, [nodes]);

    return {
        checkConvergence,
        generateConfirmationStatement
    };
}
