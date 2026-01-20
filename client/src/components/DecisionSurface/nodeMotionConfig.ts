/**
 * OptimismAI - Living Decision Surface
 * Node motion configuration constants
 * 
 * These values define the exact physics of node movement
 * following the "alive but not distracting" principle.
 */

// ============================================================================
// Spawn Layout
// ============================================================================

export const SPAWN = {
    /** Radius from anchor point for initial 3 nodes (px) */
    RADIUS: 220,

    /** Angles for the 3 primary nodes (degrees) */
    ANGLES: [-20, 110, 230] as const,

    /** Random jitter range per axis (±px) */
    JITTER_RANGE: 18,

    /** Stagger delay between node appearances (ms) */
    STAGGER_DELAY: 70,

    /** Initial scale before animation */
    INITIAL_SCALE: 0.98,

    /** Final scale after spawn animation */
    FINAL_SCALE: 1.0,
} as const;

// ============================================================================
// Idle Drift (subtle "alive" movement)
// ============================================================================

export const DRIFT = {
    /** Minimum amplitude of idle drift (px) */
    AMPLITUDE_MIN: 6,

    /** Maximum amplitude of idle drift (px) */
    AMPLITUDE_MAX: 10,

    /** Minimum period of drift cycle (ms) */
    PERIOD_MIN: 3200,

    /** Maximum period of drift cycle (ms) */
    PERIOD_MAX: 4400,

    /** Whether drift is enabled by default */
    ENABLED: true,
} as const;

// ============================================================================
// Engage Motion (DORMANT → ACTIVE)
// ============================================================================

export const ENGAGE = {
    /** Distance to move toward anchor when engaged (px) */
    TOWARD_ANCHOR_DISTANCE: 80,

    /** Duration of engage animation (ms) */
    DURATION: 260,

    /** Easing curve for engage animation */
    EASING: 'cubic-bezier(0.2, 0.8, 0.2, 1)',

    /** Spring config for react-spring (alternative to easing) */
    SPRING_CONFIG: {
        tension: 180,
        friction: 24,
    },

    /** Opacity when engaged */
    ACTIVE_OPACITY: 1.0,

    /** Border alpha when engaged */
    ACTIVE_BORDER_ALPHA: 0.18,

    /** Border alpha when dormant */
    DORMANT_BORDER_ALPHA: 0.10,
} as const;

// ============================================================================
// Disengage Motion (other nodes when one becomes active)
// ============================================================================

export const DISENGAGE = {
    /** Distance to move away from anchor (px) */
    AWAY_FROM_ANCHOR_DISTANCE: 24,

    /** Duration of disengage animation (ms) */
    DURATION: 240,

    /** Opacity when another node is active */
    DIMMED_OPACITY: 0.75,
} as const;

// ============================================================================
// Satellite Nodes
// ============================================================================

export const SATELLITE = {
    /** Radius from parent node for satellite spawn (px) */
    SPAWN_RADIUS: 70,

    /** Scale relative to primary node */
    SCALE: 0.92,

    /** Fade in duration (ms) */
    FADE_IN_DURATION: 140,

    /** Fade out duration after answered (ms) */
    FADE_OUT_DURATION: 180,

    /** Timeout before auto-dimming (ms) - 2 minutes */
    INACTIVITY_TIMEOUT: 120000,

    /** Opacity after inactivity timeout */
    INACTIVE_OPACITY: 0.4,

    /** Minimum angle separation from other satellites (degrees) */
    MIN_ANGLE_SEPARATION: 45,
} as const;

// ============================================================================
// Merge Animation
// ============================================================================

export const MERGE = {
    /** Duration for nodes moving to midpoint (ms) */
    MOVE_DURATION: 280,

    /** Duration for connector line fade in (ms) */
    CONNECTOR_FADE_DURATION: 120,

    /** Final opacity of connector line */
    CONNECTOR_OPACITY: 0.35,

    /** Duration for node fade out (ms) */
    NODE_FADE_DURATION: 180,

    /** Scale when fading out */
    FADE_OUT_SCALE: 0.96,

    /** Duration for insight chip appearance (ms) */
    INSIGHT_APPEAR_DURATION: 180,

    /** Initial scale of insight chip */
    INSIGHT_INITIAL_SCALE: 0.98,
} as const;

// ============================================================================
// Leaning Indicator
// ============================================================================

export const LEANING = {
    /** Slide down distance on appear (px) */
    SLIDE_DISTANCE: 12,

    /** Fade in duration (ms) */
    FADE_IN_DURATION: 240,

    /** Maximum shift per answer (0-1) */
    MAX_SHIFT_PER_ANSWER: 0.12,

    /** Damping factor for smooth transitions */
    DAMPING: 0.8,
} as const;

// ============================================================================
// Composer Animation
// ============================================================================

export const COMPOSER = {
    /** Distance to glide down on submit (px) */
    GLIDE_DOWN_DISTANCE: 64,

    /** Duration of glide animation (ms) */
    GLIDE_DURATION: 260,

    /** Easing for glide animation */
    GLIDE_EASING: 'cubic-bezier(0.2, 0.8, 0.2, 1)',

    /** Duration of the "breathe" vignette effect (ms) */
    BREATHE_DURATION: 400,
} as const;

// ============================================================================
// Field (ThinkingField canvas)
// ============================================================================

export const FIELD = {
    /** Background color - dark mode (dark, subtle) */
    BACKGROUND_COLOR_DARK: 'hsl(220, 15%, 8%)',

    /** Background color - light mode (base for animated gradient) */
    BACKGROUND_COLOR_LIGHT: '#fafafa',

    /** Grain opacity */
    GRAIN_OPACITY: 0.03,

    /** Grid opacity (if using soft grid) */
    GRID_OPACITY: 0.02,

    /** Vignette intensity (0-1) */
    VIGNETTE_INTENSITY: 0.15,

    /** Vignette intensity on "breathe" */
    VIGNETTE_BREATHE_INTENSITY: 0.25,
} as const;

// ============================================================================
// Session Ending
// ============================================================================

export const ENDING = {
    /** Duration for motion to slow down (ms) */
    SLOWDOWN_DURATION: 800,

    /** Duration for field to settle (ms) */
    SETTLE_DURATION: 600,

    /** Final drift amplitude (nearly still) */
    FINAL_DRIFT_AMPLITUDE: 1,
} as const;

// ============================================================================
// Throw-to-Regenerate (drag and throw gesture)
// ============================================================================

export const THROW = {
    /** Minimum velocity to trigger throw (px/s) */
    VELOCITY_THRESHOLD: 500,

    /** Distance past viewport edge to confirm throw (px) */
    BOUNDARY_MARGIN: 100,

    /** Duration for exit animation (ms) */
    EXIT_DURATION: 300,

    /** Delay before replacement node spawns (ms) */
    SPAWN_DELAY: 400,

    /** Scale when exiting */
    EXIT_SCALE: 0.8,

    /** Opacity when exiting */
    EXIT_OPACITY: 0,

    /** Spring config for throw animation */
    SPRING_CONFIG: { tension: 280, friction: 24 },

    /** Snap back spring config (when throw fails) */
    SNAP_BACK_CONFIG: { tension: 400, friction: 28 },

    /** Maximum drag opacity (slight fade during drag) */
    DRAG_OPACITY: 0.9,
} as const;

// ============================================================================
// Tension Field Dynamics - Clustering
// ============================================================================

export const CLUSTERING = {
    /** Base attraction force constant */
    ATTRACTION_CONSTANT: 50,

    /** Minimum distance before attraction kicks in (px) */
    MIN_DISTANCE: 60,

    /** Maximum distance for attraction effect (px) */
    MAX_DISTANCE: 400,

    /** Damping factor for position updates (0-1) */
    DAMPING: 0.15,

    /** Distance threshold to consider points clustered (px) */
    CLUSTER_DISTANCE_THRESHOLD: 120,

    /** Update interval for field dynamics (ms) */
    UPDATE_INTERVAL: 50,

    /** Repulsion constant for very close points (prevents overlap) */
    REPULSION_CONSTANT: 20,

    /** Distance at which repulsion activates (px) */
    REPULSION_DISTANCE: 80,

    /** Spring config for cluster animations */
    SPRING_CONFIG: { tension: 80, friction: 20 },
} as const;

// ============================================================================
// Tension Field Dynamics - Fading (noise dissolution)
// ============================================================================

export const FADING = {
    /** Intensity threshold below which points start fading */
    INTENSITY_THRESHOLD: 0.2,

    /** Fade rate per cycle (multiplier, < 1) */
    FADE_RATE: 0.92,

    /** Intensity at which point enters FADING state */
    FADING_THRESHOLD: 0.1,

    /** Intensity at which point is dissolved/removed */
    DISSOLVE_THRESHOLD: 0.02,

    /** Duration of fade-out animation (ms) */
    FADE_DURATION: 800,

    /** Minimum time before fading can start (ms) */
    GRACE_PERIOD: 5000,

    /** Signal threshold (points above this are protected) */
    SIGNAL_THRESHOLD: 0.5,

    /** Minimum affinities to be considered signal */
    MIN_CONNECTIONS: 2,
} as const;

// ============================================================================
// Tension Field Dynamics - Stability Detection
// ============================================================================

export const STABILITY = {
    /** Duration before cluster is considered stable (ms) */
    STABLE_DURATION: 3000,

    /** Maximum movement per cycle to be considered stable (px) */
    MOVEMENT_THRESHOLD: 5,

    /** Dominance threshold for a cluster (0-1) */
    DOMINANCE_THRESHOLD: 0.5,

    /** Check interval for stability (ms) */
    CHECK_INTERVAL: 500,
} as const;

// ============================================================================
// Tension Intensity Visualization
// ============================================================================

export const TENSION = {
    /** Minimum opacity for low-tension points */
    MIN_OPACITY: 0.4,

    /** Maximum opacity for high-tension points */
    MAX_OPACITY: 1.0,

    /** Minimum scale for low-tension points */
    MIN_SCALE: 0.85,

    /** Maximum scale for high-tension points */
    MAX_SCALE: 1.05,

    /** Glow intensity at max tension (0-1) */
    MAX_GLOW: 0.5,

    /** Border alpha at max tension */
    MAX_BORDER_ALPHA: 0.25,

    /** Border alpha at min tension */
    MIN_BORDER_ALPHA: 0.05,

    /** Probing node scale boost */
    PROBING_SCALE_BOOST: 1.08,

    /** Probing node opacity */
    PROBING_OPACITY: 1.0,
} as const;

// ============================================================================
// Loading Ripples (anticipation animation during AI processing)
// ============================================================================

export const LOADING_RIPPLES = {
    /** Number of concentric ripples to show */
    RIPPLE_COUNT: 3,

    /** Maximum radius ripples expand to (px) */
    MAX_RADIUS: 180,

    /** Duration of one ripple cycle (ms) */
    CYCLE_DURATION: 1200,

    /** Delay between each ripple start (ms) */
    STAGGER_DELAY: 300,

    /** Opacity at ripple start */
    START_OPACITY: 0.4,

    /** Number of pulses per spawn direction */
    PULSE_COUNT: 3,

    /** How far directional pulses travel (px) */
    PULSE_TRAVEL_DISTANCE: 180,

    /** Duration of pulse travel (ms) */
    PULSE_TRAVEL_DURATION: 800,
} as const;

// ============================================================================
// Timing Helpers
// ============================================================================

/**
 * Generate a random value within a range
 */
export function randomInRange(min: number, max: number): number {
    return Math.random() * (max - min) + min;
}

/**
 * Get a random drift amplitude
 */
export function getRandomDriftAmplitude(): number {
    return randomInRange(DRIFT.AMPLITUDE_MIN, DRIFT.AMPLITUDE_MAX);
}

/**
 * Get a random drift period
 */
export function getRandomDriftPeriod(): number {
    return randomInRange(DRIFT.PERIOD_MIN, DRIFT.PERIOD_MAX);
}

/**
 * Get jittered position from base position
 */
export function getJitteredPosition(
    baseX: number,
    baseY: number
): { x: number; y: number } {
    const jitterX = randomInRange(-SPAWN.JITTER_RANGE, SPAWN.JITTER_RANGE);
    const jitterY = randomInRange(-SPAWN.JITTER_RANGE, SPAWN.JITTER_RANGE);
    return {
        x: baseX + jitterX,
        y: baseY + jitterY,
    };
}

/**
 * Calculate spawn position for a node at given index
 */
export function getSpawnPosition(
    index: number,
    anchorX: number,
    anchorY: number
): { x: number; y: number } {
    const angleIndex = index % SPAWN.ANGLES.length;
    const angleDeg = SPAWN.ANGLES[angleIndex];
    const angleRad = (angleDeg * Math.PI) / 180;

    const baseX = anchorX + SPAWN.RADIUS * Math.cos(angleRad);
    const baseY = anchorY + SPAWN.RADIUS * Math.sin(angleRad);

    return getJitteredPosition(baseX, baseY);
}

/**
 * Calculate satellite spawn position with repulsion from existing satellites
 */
export function getSatellitePosition(
    parentX: number,
    parentY: number,
    existingSatelliteAngles: number[]
): { x: number; y: number; angle: number } {
    // Find an angle that's far from existing satellites
    let bestAngle = 0;
    let maxMinDistance = 0;

    for (let candidateAngle = 0; candidateAngle < 360; candidateAngle += 15) {
        const minDistance = existingSatelliteAngles.reduce((min, existingAngle) => {
            const diff = Math.abs(candidateAngle - existingAngle);
            const wrappedDiff = Math.min(diff, 360 - diff);
            return Math.min(min, wrappedDiff);
        }, 360);

        if (minDistance > maxMinDistance) {
            maxMinDistance = minDistance;
            bestAngle = candidateAngle;
        }
    }

    const angleRad = (bestAngle * Math.PI) / 180;
    return {
        x: parentX + SATELLITE.SPAWN_RADIUS * Math.cos(angleRad),
        y: parentY + SATELLITE.SPAWN_RADIUS * Math.sin(angleRad),
        angle: bestAngle,
    };
}
