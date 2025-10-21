const gaugeState = new Map();

const DEFAULT_INTENT = 'general_support';
const DEFAULT_INTENSITY = 0.35;
const DECAY_INTERVAL_MS = 30000;
const DECAY_RATE = 0.18;
const SWITCH_MARGIN = 0.18;
const SWITCH_THRESHOLD = 0.6;
const COOLDOWN_MS = 8000;

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function createDefaultState() {
  return {
    intent: DEFAULT_INTENT,
    intensity: DEFAULT_INTENSITY,
    lastUpdated: 0,
    lastSwitch: 0,
  };
}

function getState(key) {
  const state = gaugeState.get(key);
  if (!state) {
    return undefined;
  }

  return { ...state };
}

function applyDecay(state, now) {
  if (!state.lastUpdated) {
    state.lastUpdated = now;
    return state.intensity;
  }

  const elapsed = now - state.lastUpdated;
  if (elapsed <= 0) {
    return state.intensity;
  }

  const decaySteps = elapsed / DECAY_INTERVAL_MS;
  const decayed = clamp(state.intensity - DECAY_RATE * decaySteps, 0, 1);
  state.intensity = decayed;
  state.lastUpdated = now;
  return state.intensity;
}

function updateGauge({ key, candidate, forced = false, now = Date.now() }) {
  if (!key || !candidate?.intent) {
    return { state: createDefaultState(), switched: false };
  }

  const state = gaugeState.get(key) ?? createDefaultState();
  applyDecay(state, now);

  const targetIntensity = clamp(candidate.intensity ?? DEFAULT_INTENSITY, 0, 1);
  let switched = false;

  const shouldSwitch =
    forced ||
    candidate.intent === state.intent ||
    targetIntensity >= state.intensity + SWITCH_MARGIN ||
    (targetIntensity >= SWITCH_THRESHOLD && now - state.lastSwitch > COOLDOWN_MS);

  if (shouldSwitch) {
    if (candidate.intent !== state.intent) {
      state.intent = candidate.intent;
      state.lastSwitch = now;
      switched = true;
    }
    state.intensity = targetIntensity;
  } else {
    state.intensity = clamp(Math.max(state.intensity, targetIntensity * 0.75), 0, 1);
  }

  if (state.intensity <= 0.05) {
    state.intent = DEFAULT_INTENT;
  }

  gaugeState.set(key, state);
  return { state: { ...state }, switched };
}

function resetGauge(key) {
  if (key) {
    gaugeState.delete(key);
    return;
  }

  gaugeState.clear();
}

module.exports = {
  DEFAULT_INTENT,
  updateGauge,
  resetGauge,
  getState,
  constants: {
    DEFAULT_INTENT,
    DEFAULT_INTENSITY,
    DECAY_INTERVAL_MS,
    DECAY_RATE,
    SWITCH_MARGIN,
    SWITCH_THRESHOLD,
    COOLDOWN_MS,
  },
};
