/**
 * OptimismAI - Living Decision Surface
 * Core type definitions for the decision surface UI
 */

// ============================================================================
// Session & State Types
// ============================================================================

/**
 * The phase of a decision session, following tension release flow
 */
export type SessionPhase =
    | 'IDLE'        // Calm field, waiting for first input
    | 'INTAKE'      // Processing first message, generating tension points
    | 'EXPLORING'   // Active probing - tension being released
    | 'SETTLING'    // Field stabilizing, motion slowing
    | 'SILENT';     // Clarity reached, earned silence

/** @deprecated Use SessionPhase - kept for backward compatibility */
export type FieldPhase = SessionPhase;

/**
 * State of an individual thought/tension node
 */
export type NodeState =
    | 'LATENT'   // Visible but not being probed (has tension, no active question)
    | 'PROBING'  // This is the active question being asked
    | 'RESOLVED' // Question answered, tension reduced
    | 'FADING'   // Low relevance, fading out
    | 'DISSOLVED' // Completely faded, will be removed
    // Legacy states (deprecated)
    | 'DORMANT'  // @deprecated Use LATENT
    | 'ACTIVE'   // @deprecated Use PROBING
    | 'MERGED'   // @deprecated No longer used
    | 'EXITING'; // @deprecated Use FADING

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
    /** @deprecated Satellites removed in tension model */
    satellites: SatelliteNodeData[];
    signals: NodeSignal[];
    createdAt: number;
    resolvedAt?: number;
    /** @deprecated Merging removed in tension model */
    mergedIntoId?: string;

    // ===== Tension Model Properties =====

    /** Concept label (e.g., "money", "timeline", "partner") */
    concept?: string;
    /** Cognitive tension intensity 0-1 */
    intensity?: number;
    /** Affinity strengths to other nodes (for clustering) */
    affinities?: Map<string, number>;
    /** How this node was created */
    source?: 'initial' | 'discovered' | 'user_added' | 'followup' | 'assessment';
}

// ============================================================================
// Progress Pathway Types
// ============================================================================

/**
 * PathwayNode - Represents a resolved question in the progress pathway
 * These appear as a breadcrumb trail at the top showing the user's journey
 */
export interface PathwayNode {
    /** Unique identifier (same as original ThoughtNode) */
    id: string;
    /** The question that was answered */
    question: string;
    /** The user's answer */
    answer: string;
    /** Topic/category of the question */
    topicKey: TopicKey;
    /** When this question was resolved */
    resolvedAt: number;
    /** Order in the pathway (based on resolution order) */
    order: number;
}

// ============================================================================
// AI Insight Node Types
// ============================================================================

/**
 * InsightNodeData - AI-generated insight nodes that surface relevant resources
 * These appear automatically when the AI detects knowledge gaps or uncertainty
 */
export interface InsightNodeData {
    /** Unique identifier */
    id: string;
    /** Node type discriminator */
    type: 'insight';
    /** Short title for the insight */
    title: string;
    /** 2-3 sentence summary of the insight */
    summary: string;
    /** Source URL if from web search */
    sourceUrl?: string;
    /** Display name of the source */
    sourceName?: string;
    /** Why this insight is relevant to the decision */
    relevance: string;
    /** IDs of questions this insight relates to */
    linkedQuestionIds: string[];
    /** When this insight was generated */
    createdAt: number;
    /** Position on the canvas */
    position: Position;
    /** Whether the insight card is expanded */
    isExpanded: boolean;
    /** Current visual state */
    state: 'appearing' | 'visible' | 'dismissed';
}

// ============================================================================
// Clarity Assessment Types
// ============================================================================

/**
 * Specificity rating for an answer (1-5)
 */
export type SpecificityRating = 1 | 2 | 3 | 4 | 5;

/**
 * How an answer relates to previous answers
 */
export type CoherenceType = 'contradicts' | 'neutral' | 'reinforces';

/**
 * Whether an answer opens or closes tension
 */
export type TensionDelta = 'new_tension' | 'no_change' | 'tension_closed';

/**
 * User's orientation toward action
 */
export type OrientationType = 'exploring' | 'transitioning' | 'action_ready';

/**
 * Assessment recommendation for next action
 */
export type AssessmentRecommendation = 'probe_deeper' | 'explore_new' | 'converging' | 'clarity';

/**
 * LLM assessment of an answer's quality and session progress
 */
export interface ClarityAssessment {
    /** How concrete/specific was the answer (1-5) */
    specificity: SpecificityRating;
    /** How does this answer relate to previous ones */
    coherence: CoherenceType;
    /** Did this answer open or close tension */
    tensionDelta: TensionDelta;
    /** Is the user exploring, transitioning, or action-ready */
    orientation: OrientationType;
    /** Recommended next action */
    recommendation: AssessmentRecommendation;
    /** If probe_deeper or explore_new: what to focus on */
    suggestedFocus?: string;
    /** 1-2 sentence explanation of assessment */
    reasoning: string;
}

/**
 * Result from contextual question generator
 */
export interface ContextualQuestionResult {
    /** Whether a question should be asked */
    shouldAsk: boolean;
    /** The question to ask (if shouldAsk) */
    question?: string;
    /** Category of question */
    category?: TopicKey;
    /** Why this question now */
    reasoning?: string;
    /** Reflection to show if clarity achieved */
    reflection?: string;
}

// ============================================================================
// Tension Field Types (new model)
// ============================================================================

/**
 * Tracks an unresolved concern that blocks silence
 */
export interface OpenLoop {
    id: string;
    /** What needs to be addressed */
    description: string;
    /** Which tension point raised this */
    tensionPointId: string;
    raisedAt: number;
    resolvedAt?: number;
    status: 'open' | 'resolved';
}

/**
 * Emergent grouping of related tension points
 */
export interface ConceptCluster {
    id: string;
    tensionPointIds: string[];
    centroid: Position;
    /** How tightly bound (0-1) */
    coherence: number;
    /** How much of total signal this cluster holds (0-1) */
    dominance: number;
    /** Has the cluster stopped shifting? */
    stable: boolean;
    stableSince?: number;
}

/**
 * User behavior indicator for clarity/confusion detection
 */
export interface BehaviorSignal {
    type: 'response_time' | 'response_length' | 'hedging' | 'contradiction';
    /** Normalized value 0-1 */
    value: number;
    timestamp: number;
    indicates: 'clarity' | 'confusion';
}

/**
 * Soft confirmation shown before entering silence
 */
export interface SoftConfirmation {
    statement: string;
    shownAt: number;
    userResponse?: string;
}

/**
 * Overall field state for tension model
 */
export interface FieldState {
    id: string;
    /** Original decision statement */
    statement: string;

    /** Current phase */
    phase: SessionPhase;

    /** All tension points on the field */
    tensionPoints: ThoughtNodeData[];

    /** Tracked open loops */
    openLoops: OpenLoop[];

    /** Detected clusters */
    clusters: ConceptCluster[];

    /** Behavior signals from user */
    behaviorSignals: BehaviorSignal[];

    /** Total tension in field (sum of intensities) */
    totalTension: number;

    /** How long the field has been stable */
    stabilityDuration: number;

    /** Soft confirmation if shown */
    softConfirmation?: SoftConfirmation;

    createdAt: number;
    updatedAt: number;
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
    | 'leaning_shifted'
    // Tension model milestones
    | 'session_ended'
    | 'tension_resolved'
    | 'loop_closed'
    | 'cluster_formed';

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

    /** Decision core (emerges in SETTLING/SILENT) */
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
