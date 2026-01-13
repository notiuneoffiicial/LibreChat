/**
 * OptimismAI - Living Decision Surface
 * Recoil store for decision session state management
 */

import { atom, atomFamily, selector, selectorFamily } from 'recoil';
import type {
    DecisionSession,
    SessionPhase,
    ThoughtNodeData,
    Milestone,
    LeaningVector,
    Position,
} from '~/common/DecisionSession.types';

// ============================================================================
// Core Session State
// ============================================================================

/**
 * The current decision session (null when not in decision mode)
 */
export const decisionSessionAtom = atom<DecisionSession | null>({
    key: 'decisionSession',
    default: null,
});

/**
 * Current phase of the session state machine
 */
export const sessionPhaseAtom = atom<SessionPhase>({
    key: 'decisionSessionPhase',
    default: 'IDLE',
});

/**
 * Whether the decision workspace is enabled
 */
export const decisionWorkspaceEnabledAtom = atom<boolean>({
    key: 'decisionWorkspaceEnabled',
    default: false,
});

// ============================================================================
// Node State
// ============================================================================

/**
 * All thought nodes in the current session
 */
export const thoughtNodesAtom = atom<ThoughtNodeData[]>({
    key: 'thoughtNodes',
    default: [],
});

/**
 * ID of the currently active (engaged) node
 */
export const activeNodeIdAtom = atom<string | null>({
    key: 'activeNodeId',
    default: null,
});

/**
 * Node being hovered (for tooltip display)
 */
export const hoveredNodeIdAtom = atom<string | null>({
    key: 'hoveredNodeId',
    default: null,
});

/**
 * Selector to get the currently active node
 */
export const activeNodeSelector = selector<ThoughtNodeData | null>({
    key: 'activeNode',
    get: ({ get }) => {
        const nodes = get(thoughtNodesAtom);
        const activeId = get(activeNodeIdAtom);
        if (!activeId) return null;
        return nodes.find((n) => n.id === activeId) ?? null;
    },
});

/**
 * Get a specific node by ID
 */
export const nodeByIdSelector = selectorFamily<ThoughtNodeData | null, string>({
    key: 'nodeById',
    get:
        (nodeId) =>
            ({ get }) => {
                const nodes = get(thoughtNodesAtom);
                return nodes.find((n) => n.id === nodeId) ?? null;
            },
});

/**
 * Get all dormant nodes (not active, not merged)
 */
export const dormantNodesSelector = selector<ThoughtNodeData[]>({
    key: 'dormantNodes',
    get: ({ get }) => {
        const nodes = get(thoughtNodesAtom);
        return nodes.filter((n) => n.state === 'DORMANT');
    },
});

// ============================================================================
// Position & Motion State
// ============================================================================

/**
 * Anchor position for nodes (composer center)
 */
export const anchorPositionAtom = atom<Position>({
    key: 'anchorPosition',
    default: { x: 0, y: 0 },
});

/**
 * Whether the composer has submitted (for animation state)
 */
export const composerSubmittedAtom = atom<boolean>({
    key: 'composerSubmitted',
    default: false,
});

/**
 * Whether nodes are currently merging (disables drift)
 */
export const isMergingAtom = atom<boolean>({
    key: 'isMerging',
    default: false,
});

/**
 * Current merge animation state
 */
export const mergeAnimationAtom = atom<{
    nodeIds: [string, string];
    midpoint: Position;
    progress: number;
} | null>({
    key: 'mergeAnimation',
    default: null,
});

// ============================================================================
// Leaning State
// ============================================================================

/**
 * Current leaning vector (direction + confidence)
 */
export const leaningVectorAtom = atom<LeaningVector | null>({
    key: 'leaningVector',
    default: null,
});

/**
 * Whether leaning indicator should be visible
 * (after 1 merge or options <= 3)
 */
export const leaningVisibleSelector = selector<boolean>({
    key: 'leaningVisible',
    get: ({ get }) => {
        const session = get(decisionSessionAtom);
        const nodes = get(thoughtNodesAtom);

        if (!session) return false;

        // Visible after at least 1 merge
        const hasMerged = nodes.some((n) => n.state === 'MERGED');
        if (hasMerged) return true;

        // Visible when options narrowed to 3 or fewer
        const activeOptions = session.options.filter((o) => !o.eliminated);
        if (activeOptions.length > 0 && activeOptions.length <= 3) return true;

        return false;
    },
});

// ============================================================================
// Milestone & Trace State
// ============================================================================

/**
 * All milestones in the current session
 */
export const milestonesAtom = atom<Milestone[]>({
    key: 'milestones',
    default: [],
});

/**
 * Whether trace overlay is open
 */
export const traceOverlayOpenAtom = atom<boolean>({
    key: 'traceOverlayOpen',
    default: false,
});

/**
 * Currently highlighted milestone (for jump-back)
 */
export const highlightedMilestoneIdAtom = atom<string | null>({
    key: 'highlightedMilestoneId',
    default: null,
});

// ============================================================================
// UI State
// ============================================================================

/**
 * Whether the field is in "settling" mode (session ending)
 */
export const fieldSettlingAtom = atom<boolean>({
    key: 'fieldSettling',
    default: false,
});

/**
 * Ending state of the session
 */
export const sessionEndingStateAtom = atom<'clarity' | 'conditional_clarity' | 'rest' | null>({
    key: 'sessionEndingState',
    default: null,
});

/**
 * Field vignette intensity (for "breathe" effect)
 */
export const vignetteIntensityAtom = atom<number>({
    key: 'vignetteIntensity',
    default: 0.15,
});

// ============================================================================
// Derived State
// ============================================================================

/**
 * Count of active (non-eliminated) options
 */
export const activeOptionsCountSelector = selector<number>({
    key: 'activeOptionsCount',
    get: ({ get }) => {
        const session = get(decisionSessionAtom);
        if (!session) return 0;
        return session.options.filter((o) => !o.eliminated).length;
    },
});

/**
 * Count of unresolved assumptions
 */
export const unresolvedAssumptionsCountSelector = selector<number>({
    key: 'unresolvedAssumptionsCount',
    get: ({ get }) => {
        const session = get(decisionSessionAtom);
        if (!session) return 0;
        return session.assumptions.filter((a) => !a.resolved).length;
    },
});

/**
 * Whether any node has unanswered satellites
 */
export const hasUnansweredSatellitesSelector = selector<boolean>({
    key: 'hasUnansweredSatellites',
    get: ({ get }) => {
        const nodes = get(thoughtNodesAtom);
        return nodes.some((n) => n.satellites.some((s) => !s.answered));
    },
});

// ============================================================================
// Session Snapshot State
// ============================================================================

/**
 * Most recent snapshot ID (for persistence)
 */
export const latestSnapshotIdAtom = atom<string | null>({
    key: 'latestSnapshotId',
    default: null,
});
