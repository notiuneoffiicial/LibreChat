/**
 * OptimismAI - Living Decision Surface
 * Core type definitions for the decision surface UI
 */

// ============================================================================
// Session & State Types
// ============================================================================

/**
 * The phase of a decision session, following a natural thinking flow
 */
export type SessionPhase =
    | 'IDLE'        // Calm field, waiting for first input
    | 'INTAKE'      // Processing first message, generating nodes
    | 'EXPLORATION' // Active engagement with nodes
    | 'SYNTHESIS'   // Paths converging, insights forming
    | 'CONVERGENCE'; // Decision core emerging

/**
 * State of an individual thought node
 */
export type NodeState =
    | 'DORMANT'  // Visible but not engaged
    | 'ACTIVE'   // Currently being explored
    | 'RESOLVED' // Question answered, may spawn satellites
    | 'MERGED'   // Combined with another node into insight
    | 'EXITING'; // Being thrown out, will be regenerated

/**
 * Topic categories for inquiry paths
 */
export type TopicKey = 'reality' | 'values' | 'options';

/**
 * Question category for pacing and depth
 */
export type QuestionCategory = 'grounding' | 'clarifying' | 'contrast';

/**
 * Expected information type from an answer
 */
export type ExpectedInfoType = 'fact' | 'value' | 'option';

// ============================================================================
// Node Signal Types (ambient indicators)
// ============================================================================

export interface AssumptionSignal {
    type: 'assumption';
    description: string;
}

export interface LoopSignal {
    type: 'loop';
    description: string;
}

export interface UncertaintySignal {
    type: 'uncertainty';
    description: string;
}

export interface IrreversibilitySignal {
    type: 'irreversibility';
    description: string;
}

export type NodeSignal =
    | AssumptionSignal
    | LoopSignal
    | UncertaintySignal
    | IrreversibilitySignal;

/**
 * Glyph mapping for signal types
 * ⚠︎ assumption | ⟲ loop | ◔ uncertainty | ⧗ irreversibility
 */
export const SIGNAL_GLYPHS: Record<NodeSignal['type'], string> = {
    assumption: '⚠︎',
    loop: '⟲',
    uncertainty: '◔',
    irreversibility: '⧗',
};

// ============================================================================
// Position & Motion Types
// ============================================================================

export interface Position {
    x: number;
    y: number;
}

export interface NodeMotionState {
    position: Position;
    opacity: number;
    scale: number;
    borderAlpha: number;
}

// ============================================================================
// Node Data Types
// ============================================================================

export interface SatelliteNodeData {
    id: string;
    parentId: string;
    question: string;
    position: Position;
    answered: boolean;
    answer?: string;
    createdAt: number;
}

export interface ThoughtNodeData {
    id: string;
    state: NodeState;
    question: string;
    topicKey: TopicKey;
    category: QuestionCategory;
    expectedInfoType: ExpectedInfoType;
    position: Position;
    answer?: string;
    satellites: SatelliteNodeData[];
    signals: NodeSignal[];
    createdAt: number;
    resolvedAt?: number;
    mergedIntoId?: string;
}

// ============================================================================
// Milestone & Trace Types
// ============================================================================

export type MilestoneType =
    | 'constraint_identified'
    | 'option_removed'
    | 'assumption_resolved'
    | 'insight_formed'
    | 'nodes_merged'
    | 'leaning_shifted';

export interface Milestone {
    id: string;
    type: MilestoneType;
    label: string;
    timestamp: number;
    nodeId?: string;
    metadata?: Record<string, unknown>;
}

// ============================================================================
// Decision & Leaning Types
// ============================================================================

export interface LeaningVector {
    /** The direction of leaning (e.g., "Leave the job", "Stay but negotiate") */
    direction: string;
    /** Confidence level 0-1, shifts damped to max 0.12 per answer */
    confidence: number;
}

export interface DecisionCore {
    /** One sentence summary: "This decision hinges on X and Y" */
    statement: string;
    /** What the decision primarily depends on */
    hingesOn: string[];
    /** Optional leaning direction */
    leaning?: LeaningVector;
}

export interface Assumption {
    id: string;
    text: string;
    resolved: boolean;
    resolvedAt?: number;
}

export interface DecisionOption {
    id: string;
    text: string;
    eliminated: boolean;
    eliminatedReason?: string;
    eliminatedAt?: number;
}

// ============================================================================
// Session Types
// ============================================================================

export interface DecisionSessionDraft {
    /** Candidate decision statement parsed from first message */
    statement: string;
    /** Guessed domain (career, finance, relationship, etc.) */
    domain: string;
    /** Initial uncertainty estimate 0-1 */
    uncertaintyEstimate: number;
    /** Initial emotion estimate */
    emotionEstimate: string;
}

export interface DecisionSession {
    id: string;
    conversationId: string;
    phase: SessionPhase;
    createdAt: number;
    updatedAt: number;

    /** Draft parsed from first message */
    draft?: DecisionSessionDraft;

    /** Discovered constraints */
    constraints: string[];

    /** Tracked assumptions */
    assumptions: Assumption[];

    /** Available options */
    options: DecisionOption[];

    /** Formed insights */
    insights: string[];

    /** Decision core (emerges in SYNTHESIS/CONVERGENCE) */
    decisionCore?: DecisionCore;

    /** Milestones for trace overlay */
    milestones: Milestone[];

    /** Ending state type */
    endingState?: 'clarity' | 'conditional_clarity' | 'rest';
}

// ============================================================================
// Snapshot Types (for persistence)
// ============================================================================

export interface DecisionSnapshot {
    id: string;
    sessionId: string;
    conversationId: string;
    createdAt: number;

    /** Decision core at time of snapshot */
    statement: string;
    hingesOn: string;
    leaning?: LeaningVector;

    /** Context at snapshot */
    constraints: string[];
    assumptions: Assumption[];
    options: DecisionOption[];
    insights: string[];

    /** Milestones up to snapshot */
    milestones: Milestone[];

    /** Node states at snapshot (for jump-back) */
    nodeStates: ThoughtNodeData[];
}

// ============================================================================
// Event Types (for state machine)
// ============================================================================

export type SessionEvent =
    | { type: 'SUBMIT_DECISION'; message: string }
    | { type: 'NODES_GENERATED'; nodes: ThoughtNodeData[] }
    | { type: 'SELECT_NODE'; nodeId: string }
    | { type: 'ANSWER_QUESTION'; nodeId: string; answer: string }
    | { type: 'SPAWN_SATELLITE'; parentId: string; question: string }
    | { type: 'ANSWER_SATELLITE'; satelliteId: string; answer: string }
    | { type: 'TRIGGER_MERGE'; nodeIds: [string, string]; insightText: string }
    | { type: 'UPDATE_LEANING'; leaning: LeaningVector }
    | { type: 'CREATE_SNAPSHOT' }
    | { type: 'END_SESSION'; endingState: 'clarity' | 'conditional_clarity' | 'rest' };

// ============================================================================
// Component Props Types
// ============================================================================

export interface ThinkingFieldProps {
    sessionId?: string;
    conversationId?: string;
}

export interface ThoughtNodeProps {
    node: ThoughtNodeData;
    isActive: boolean;
    anchorPosition: Position;
    onSelect: (nodeId: string) => void;
}

export interface SatelliteNodeProps {
    satellite: SatelliteNodeData;
    parentPosition: Position;
    onAnswer: (satelliteId: string) => void;
}

export interface LeaningIndicatorProps {
    leaning?: LeaningVector;
    visible: boolean;
}

export interface TraceOverlayProps {
    milestones: Milestone[];
    onJumpTo: (milestoneId: string) => void;
    isOpen: boolean;
    onToggle: () => void;
}

export interface DecisionComposerProps {
    onSubmit: (message: string) => void;
    placeholder?: string;
    isSubmitting: boolean;
    hasSubmitted: boolean;
    /** Whether to animate in when first rendered */
    animateIn?: boolean;
    /** Anchor position for centering (from ThinkingField container) */
    anchorPosition?: Position;
}
