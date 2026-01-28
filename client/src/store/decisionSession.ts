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
    FieldState,
    OpenLoop,
    ConceptCluster,
    BehaviorSignal,
    SoftConfirmation,
    PathwayNode,
    InsightNodeData,
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

/**
 * Whether the composer should be visible (false until session started)
 * Controls the empty-state UX - shows StartSessionButton when false
 */
export const composerVisibleAtom = atom<boolean>({
    key: 'composerVisible',
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
 * Active throw zone during drag (for visual overlay)
 * 'dismiss' = left zone active, 'regenerate' = right zone active
 */
export const activeThrowZoneAtom = atom<'dismiss' | 'regenerate' | null>({
    key: 'activeThrowZone',
    default: null,
});

/**
 * Whether any node is currently being dragged
 */
export const isDraggingNodeAtom = atom<boolean>({
    key: 'isDraggingNode',
    default: false,
});

/**
 * Progress pathway - resolved questions shown as breadcrumb trail at top
 */
export const progressPathwayAtom = atom<PathwayNode[]>({
    key: 'progressPathway',
    default: [],
});

/**
 * AI Insight nodes - automatically surfaced resources based on conversation
 */
export const insightNodesAtom = atom<InsightNodeData[]>({
    key: 'insightNodes',
    default: [],
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
 * @deprecated Use latentNodesSelector for tension model
 */
export const dormantNodesSelector = selector<ThoughtNodeData[]>({
    key: 'dormantNodes',
    get: ({ get }) => {
        const nodes = get(thoughtNodesAtom);
        return nodes.filter((n) => n.state === 'DORMANT' || n.state === 'LATENT');
    },
});

// ============================================================================
// Tension Field State (New Model)
// ============================================================================

/**
 * Field state for tension model (optional, works alongside decisionSessionAtom)
 */
export const fieldStateAtom = atom<FieldState | null>({
    key: 'fieldState',
    default: null,
});

/**
 * Open loops that block silence
 */
export const openLoopsAtom = atom<OpenLoop[]>({
    key: 'openLoops',
    default: [],
});

/**
 * Detected concept clusters
 */
export const clustersAtom = atom<ConceptCluster[]>({
    key: 'conceptClusters',
    default: [],
});

/**
 * Behavior signals for clarity/confusion detection
 */
export const behaviorSignalsAtom = atom<BehaviorSignal[]>({
    key: 'behaviorSignals',
    default: [],
});

/**
 * Soft confirmation state
 */
export const softConfirmationAtom = atom<SoftConfirmation | null>({
    key: 'softConfirmation',
    default: null,
});

/**
 * Total tension in field (computed)
 */
export const totalTensionSelector = selector<number>({
    key: 'totalTension',
    get: ({ get }) => {
        const nodes = get(thoughtNodesAtom);
        return nodes.reduce((sum, n) => sum + (n.intensity ?? 0.5), 0);
    },
});

/**
 * Get the currently probing node (the one asking a question)
 */
export const probingNodeSelector = selector<ThoughtNodeData | null>({
    key: 'probingNode',
    get: ({ get }) => {
        const nodes = get(thoughtNodesAtom);
        return nodes.find((n) => n.state === 'PROBING') ?? null;
    },
});

/**
 * Get all latent nodes (have tension but not currently probing)
 */
export const latentNodesSelector = selector<ThoughtNodeData[]>({
    key: 'latentNodes',
    get: ({ get }) => {
        const nodes = get(thoughtNodesAtom);
        return nodes.filter((n) => n.state === 'LATENT' || n.state === 'DORMANT');
    },
});

/**
 * Get the highest-intensity latent node (next probe candidate)
 */
export const nextProbeCandidateSelector = selector<ThoughtNodeData | null>({
    key: 'nextProbeCandidate',
    get: ({ get }) => {
        const latent = get(latentNodesSelector);
        if (latent.length === 0) return null;
        return latent.reduce((best, node) =>
            (node.intensity ?? 0.5) > (best.intensity ?? 0.5) ? node : best
        );
    },
});

/**
 * Whether the field can enter silence (all conditions met)
 */
export const canEnterSilenceSelector = selector<boolean>({
    key: 'canEnterSilence',
    get: ({ get }) => {
        const openLoops = get(openLoopsAtom);
        const clusters = get(clustersAtom);
        const nodes = get(thoughtNodesAtom);
        const behaviorSignals = get(behaviorSignalsAtom);

        // Must have no open loops
        const hasOpenLoops = openLoops.some(l => l.status === 'open');
        if (hasOpenLoops) return false;

        // Must have a dominant stable cluster
        const dominantCluster = clusters.find(c => c.dominance > 0.5 && c.stable);
        if (!dominantCluster) return false;

        // Must not have recent confusion signals
        const recentSignals = behaviorSignals.filter(
            s => Date.now() - s.timestamp < 60000 // Last minute
        );
        const confusionCount = recentSignals.filter(s => s.indicates === 'confusion').length;
        if (confusionCount > 2) return false;

        // Must have at least some resolved nodes
        const resolvedCount = nodes.filter(n => n.state === 'RESOLVED').length;
        if (resolvedCount < 2) return false;

        return true;
    },
});

/**
 * Get the dominant cluster (if any)
 */
export const dominantClusterSelector = selector<ConceptCluster | null>({
    key: 'dominantCluster',
    get: ({ get }) => {
        const clusters = get(clustersAtom);
        return clusters.find(c => c.dominance > 0.5) ?? null;
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

// ============================================================================
// Toolbar & Context State
// ============================================================================

/**
 * Whether the left toolbar is collapsed
 */
export const toolbarCollapsedAtom = atom<boolean>({
    key: 'toolbarCollapsed',
    default: true,
});

/**
 * Context node data type
 */
export interface ContextNodeData {
    id: string;
    content: string;
    position: Position;
    createdAt: number;
    /** IDs of questions this context is manually linked to */
    linkedQuestionIds?: string[];
}

/**
 * Context nodes on the thinking surface
 */
export const contextNodesAtom = atom<ContextNodeData[]>({
    key: 'contextNodes',
    default: [],
});

// ============================================================================
// Session History State (Multi-Session Support)
// ============================================================================

/**
 * Session summary for history display
 */
export interface SessionSummary {
    sessionId: string;
    title: string;
    statement?: string;
    phase: SessionPhase;
    endingState?: 'clarity' | 'conditional_clarity' | 'rest';
    createdAt: string;
    updatedAt: string;
}

/**
 * List of all saved session summaries
 */
export const sessionHistoryAtom = atom<SessionSummary[]>({
    key: 'sessionHistory',
    default: [],
});

/**
 * Currently active session ID
 */
export const activeSessionIdAtom = atom<string | null>({
    key: 'activeSessionId',
    default: null,
});

/**
 * Whether session history panel is open
 */
export const sessionHistoryOpenAtom = atom<boolean>({
    key: 'sessionHistoryOpen',
    default: false,
});

/**
 * Session save status (for UI feedback)
 */
export const sessionSaveStatusAtom = atom<'idle' | 'saving' | 'saved' | 'error'>({
    key: 'sessionSaveStatus',
    default: 'idle',
});

// ============================================================================
// Memory & File Nodes
// ============================================================================

/**
 * Memory node data type - references a stored memory
 */
export interface MemoryNodeData {
    id: string;
    memoryKey: string;      // Reference to memory key
    memoryValue: string;    // Cached value for display
    position: Position;
    createdAt: number;
}

/**
 * File node data type - references an uploaded file
 */
export interface FileNodeData {
    id: string;
    fileId: string;         // Reference to file_id
    fileName: string;
    fileType: string;
    position: Position;
    createdAt: number;
}

/**
 * Memory nodes on the thinking surface
 */
export const memoryNodesAtom = atom<MemoryNodeData[]>({
    key: 'memoryNodes',
    default: [],
});

/**
 * File nodes on the thinking surface
 */
export const fileNodesAtom = atom<FileNodeData[]>({
    key: 'fileNodes',
    default: [],
});

/**
 * Resource connection - links a resource node to a question node
 */
export interface ResourceConnection {
    resourceNodeId: string;
    questionNodeId: string;
}

/**
 * Visual connections between resource nodes and question nodes
 */
export const resourceConnectionsAtom = atom<ResourceConnection[]>({
    key: 'resourceConnections',
    default: [],
});
