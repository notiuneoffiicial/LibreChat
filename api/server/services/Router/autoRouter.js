const { logger } = require('@librechat/data-schemas');
const { parseCompactConvo, removeNullishValues } = require('librechat-data-provider');
const { DEFAULT_INTENT, updateGauge, getState } = require('./intentGauge');

const AUTO_ROUTED_ENDPOINTS = new Set(['Deepseek', 'agents']);

function toBoolean(value) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') {
      return true;
    }
    if (normalized === 'false') {
      return false;
    }
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  return Boolean(value);
}

const INTENT_TO_SPEC = {
  [DEFAULT_INTENT]: 'optimism_companion',
  deep_reasoning: 'optimism_reasoner',
  writing: 'optimism_writer',
  coding: 'optimism_builder',
  analysis: 'optimism_analyst',
  research: 'optimism_researcher',
  summary: 'optimism_summarizer',
  translation: 'optimism_translator',
  planning: 'optimism_planner',
  brainstorming: 'optimism_brainstormer',
  support: 'optimism_supporter',
  strategy: 'optimism_strategy',
  quick: 'optimism_quick',
};

const KEYWORD_GROUPS = [
  {
    intent: 'writing',
    baseIntensity: 0.6,
    patterns: [
      /\bwrite\b/i,
      /\bdraft\b/i,
      /\barticle\b/i,
      /\bcopy\b/i,
      /\bblog\b/i,
      /\bstory\b/i,
      /\bessay\b/i,
      /script\b/i,
      /narrative/i,
    ],
  },
  {
    intent: 'coding',
    baseIntensity: 0.62,
    patterns: [
      /\bcode\b/i,
      /\bbug\b/i,
      /\bfunction\b/i,
      /\bclass\b/i,
      /stack trace/i,
      /\bapi\b/i,
      /\btypescript\b/i,
      /\bpython\b/i,
      /\bscript\b/i,
      /\berror\b/i,
    ],
  },
  {
    intent: 'analysis',
    baseIntensity: 0.58,
    patterns: [
      /analys[e|z]/i,
      /\bdata\b/i,
      /\bmetric\b/i,
      /\binsight\b/i,
      /\btrend\b/i,
      /\breport\b/i,
      /\bchart\b/i,
      /dataset/i,
      /root cause/i,
    ],
  },
  {
    intent: 'research',
    baseIntensity: 0.6,
    patterns: [
      /research/i,
      /source[s]?/i,
      /citation/i,
      /reference/i,
      /evidence/i,
      /statistic/i,
      /study/i,
      /whitepaper/i,
    ],
  },
  {
    intent: 'summary',
    baseIntensity: 0.55,
    patterns: [
      /summari[sz]e/i,
      /summary/i,
      /\btl;dr\b/i,
      /overview/i,
      /recap/i,
      /condense/i,
    ],
  },
  {
    intent: 'translation',
    baseIntensity: 0.55,
    patterns: [
      /translate/i,
      /translation/i,
      /into [a-z]+/i,
      /in ([a-z]+ )?spanish/i,
      /in ([a-z]+ )?french/i,
      /bilingual/i,
      /localize/i,
    ],
  },
  {
    intent: 'planning',
    baseIntensity: 0.56,
    patterns: [
      /plan/i,
      /roadmap/i,
      /timeline/i,
      /schedule/i,
      /milestone/i,
      /budget/i,
      /rollout/i,
      /implementation plan/i,
    ],
  },
  {
    intent: 'brainstorming',
    baseIntensity: 0.57,
    patterns: [
      /brainstorm/i,
      /ideas?/i,
      /concept/i,
      /name ideas?/i,
      /ideation/i,
      /creative direction/i,
      /what are some ways/i,
    ],
  },
  {
    intent: 'support',
    baseIntensity: 0.6,
    patterns: [
      /feel/i,
      /upset/i,
      /sad/i,
      /anxious/i,
      /stressed/i,
      /cope/i,
      /struggling/i,
      /vent/i,
      /emotion/i,
    ],
  },
  {
    intent: 'strategy',
    baseIntensity: 0.6,
    patterns: [
      /strategy/i,
      /strategic/i,
      /prioriti[sz]e/i,
      /growth/i,
      /campaign/i,
      /positioning/i,
      /competitive/i,
      /decision framework/i,
    ],
  },
];

const QUICK_PATTERNS = [/\bquick\b/i, /\bfast\b/i, /\bbrief\b/i, /\bconcise\b/i, /\bshort\b/i, /tl;dr/i];
const DETAIL_PATTERNS = [/\bthorough\b/i, /\bdeep dive\b/i, /in-depth/i, /detailed/i, /comprehensive/i];
const SUPPORT_PATTERNS = [/vent/i, /overwhelmed/i, /burnt? out/i, /lonely/i, /heartbroken/i];
const EXPLICIT_SEARCH_PATTERNS = [
  /\bweb ?search\b/i,
  /\bsearch (?:the )?(?:web|internet|online)\b/i,
  /\bsearch\b[^\n]{0,80}\b(on the (?:web|internet)|online)\b/i,
  /\blook (?:it )?up\b[^\n]{0,80}\b(on(?:line)?|on the (?:web|internet)|on google|on bing|on duckduckgo)\b/i,
  /\bfind\b[^\n]{0,80}\b(on(?:line)?|on the (?:web|internet))\b/i,
  /\benable\b[^\n]{0,80}\bweb search\b/i,
  /\buse\b[^\n]{0,80}\bweb search\b/i,
  /\bgoogle (?:search|it|this|for)\b/i,
  /\bcheck\b[^\n]{0,80}\b(on the (?:web|internet)|online)\b/i,
  /\bbrows(?:e|ing)\b[^\n]{0,80}\bweb\b/i,
];
const IMPLICIT_SEARCH_PATTERNS = [
  /\b(latest|current|today'?s|recent|breaking|up-to-date|up to date|newest)\b[^\n]{0,80}\b(news|updates?|headlines?|events?)\b/i,
  /\b(news|headlines?|updates?)\b[^\n]{0,80}\b(today|this (?:week|month|year)|currently|latest|recent)\b/i,
  /\b(stock|stocks?|share|market|price|prices|rate|rates|trading|bitcoin|crypto)\b[^\n]{0,80}\b(today|current|latest|now|this (?:week|month|year))\b/i,
  /\bexchange rate\b/i,
  /\bweather\b[^\n]{0,80}\b(today|tomorrow|this (?:week|weekend))\b/i,
  /\b(score|result|final)\b[^\n]{0,80}\b(game|match|team|sport|series)\b/i,
  /\bwhat happened\b[^\n]{0,80}\b(today|this (?:week|month|year))\b/i,
  /\brecent\b[^\n]{0,80}\b(studies?|papers?|research|articles?|reports?)\b/i,
  /\btrending\b/i,
  /\bwhen\b[^\n]{0,60}\b(release date|launch|premiere)\b/i,
  /\b(today|current)\b[^\n]{0,80}\b(gas prices|mortgage rates|interest rates)\b/i,
  /\bflight\b[^\n]{0,80}\b(status|arrivals?|departures?)\b/i,
];
const RECENCY_PATTERNS = [
  /\blatest\b/i,
  /\bcurrent\b/i,
  /\btoday\b/i,
  /\btonight\b/i,
  /\bthis (?:week|month|year)\b/i,
  /\brecent\b/i,
  /\bbreaking\b/i,
  /\bright now\b/i,
  /\bupcoming\b/i,
];
const SEARCH_TOPIC_PATTERNS = [
  /\bnews\b/i,
  /\bupdate[s]?\b/i,
  /\bheadline[s]?\b/i,
  /\bevent[s]?\b/i,
  /\btrend(?:s|ing)?\b/i,
  /\bmarket\b/i,
  /\bstock[s]?\b/i,
  /\bprice[s]?\b/i,
  /\brate[s]?\b/i,
  /\bweather\b/i,
  /\bforecast\b/i,
  /\bsport[s]?\b/i,
  /\bscore[s]?\b/i,
  /\brelease date\b/i,
  /\blaunch\b/i,
  /\bannouncement\b/i,
];

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function computeKeywordSignals(text) {
  const signals = [];
  for (const group of KEYWORD_GROUPS) {
    let count = 0;
    const hits = [];
    for (const pattern of group.patterns) {
      if (pattern.test(text)) {
        count += 1;
        hits.push(pattern.source ?? pattern.toString());
      }
    }

    if (count > 0) {
      const intensity = clamp(group.baseIntensity + Math.min(count, 4) * 0.08, 0, 1);
      signals.push({ intent: group.intent, intensity, hits });
    }
  }

  signals.sort((a, b) => b.intensity - a.intensity);
  return signals;
}

function collectMatches(patterns, text) {
  const matches = [];
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    if (pattern.test(text)) {
      matches.push(pattern.source ?? pattern.toString());
    }
  }

  return matches;
}

function detectSearchSignals(text) {
  const explicitMatches = collectMatches(EXPLICIT_SEARCH_PATTERNS, text);
  const implicitMatches = collectMatches(IMPLICIT_SEARCH_PATTERNS, text);
  const recencyMatches = collectMatches(RECENCY_PATTERNS, text);
  const topicMatches = collectMatches(SEARCH_TOPIC_PATTERNS, text);
  const comboMatch = recencyMatches.length > 0 && topicMatches.length > 0;

  const combinedImplicitMatches = implicitMatches.slice();
  if (comboMatch) {
    combinedImplicitMatches.push(`combo:${recencyMatches[0]}&${topicMatches[0]}`);
  }

  const hasExplicit = explicitMatches.length > 0;
  const hasImplicit = combinedImplicitMatches.length > 0;
  const shouldSearch = hasExplicit || hasImplicit;

  let confidence = 0;
  if (hasExplicit) {
    confidence = Math.min(0.9, 0.8 + (explicitMatches.length - 1) * 0.04);
  } else if (hasImplicit) {
    confidence = Math.min(0.85, 0.72 + combinedImplicitMatches.length * 0.03);
  }

  let reason = null;
  if (hasExplicit && hasImplicit) {
    reason = 'mixed';
  } else if (hasExplicit) {
    reason = 'explicit';
  } else if (hasImplicit) {
    reason = comboMatch ? 'implicit:combo' : 'implicit';
  }

  return {
    shouldSearch,
    reason,
    confidence,
    explicitMatches,
    implicitMatches: combinedImplicitMatches,
    recencyMatches,
    topicMatches,
  };
}

function detectQuickIntent(text, tokenBudget) {
  if (tokenBudget > 0 && tokenBudget <= 1200) {
    return true;
  }
  return QUICK_PATTERNS.some((pattern) => pattern.test(text));
}

function detectSupportIntent(text) {
  return SUPPORT_PATTERNS.some((pattern) => pattern.test(text));
}

function detectDetailIntent(text, tokenBudget) {
  return tokenBudget >= 6000 || DETAIL_PATTERNS.some((pattern) => pattern.test(text));
}

function buildCandidate({ text, toggles, tokenBudget, previousState }) {
  const normalized = text.toLowerCase();
  const keywordSignals = computeKeywordSignals(normalized);

  const baseIntent = previousState?.intent ?? DEFAULT_INTENT;
  const baseIntensity = Math.max(previousState?.intensity ?? 0.4, 0.35);
  const candidate = {
    intent: baseIntent,
    intensity: baseIntensity,
    keywordHits: [],
    reason: [],
    togglesUsed: [],
    forcedSwitch: false,
  };

  if (keywordSignals.length > 0) {
    const topSignal = keywordSignals[0];
    if (topSignal.intensity >= candidate.intensity - 0.05) {
      candidate.intent = topSignal.intent;
      candidate.intensity = Math.max(candidate.intensity, topSignal.intensity);
      candidate.keywordHits = topSignal.hits;
      candidate.reason.push(`keywords:${topSignal.intent}`);
    }
  }

  const searchSignals = detectSearchSignals(normalized);
  const thinkingToggle = toBoolean(toggles?.thinking);
  let webSearchToggle = toBoolean(toggles?.web_search);
  let autoWebSearch = false;

  if (!webSearchToggle && searchSignals.shouldSearch) {
    webSearchToggle = true;
    autoWebSearch = true;
  }

  if (webSearchToggle && thinkingToggle) {
    candidate.intent = 'strategy';
    const intensityFloor = Math.max(0.86, searchSignals.confidence || 0);
    candidate.intensity = Math.max(candidate.intensity, intensityFloor);
    candidate.reason.push('toggle:web_search+thinking');
    if (!toggles?.web_search) {
      candidate.reason.push(`signal:web_search:${searchSignals.reason ?? 'implicit'}`);
      if (toggles?.thinking) {
        candidate.reason.push('toggle:thinking');
      }
    }
    candidate.togglesUsed.push('thinking', 'web_search');
    candidate.forcedSwitch = true;
  } else if (webSearchToggle) {
    candidate.intent = 'research';
    const intensityFloor = toggles?.web_search
      ? 0.74
      : Math.max(0.74, searchSignals.confidence || 0.76);
    candidate.intensity = Math.max(candidate.intensity, intensityFloor);
    candidate.reason.push(
      toggles?.web_search
        ? 'toggle:web_search'
        : `signal:web_search:${searchSignals.reason ?? 'implicit'}`,
    );
    candidate.togglesUsed.push('web_search');
    candidate.forcedSwitch = true;
  } else if (thinkingToggle) {
    candidate.intent = 'deep_reasoning';
    candidate.intensity = Math.max(candidate.intensity, 0.82);
    candidate.reason.push('toggle:thinking');
    candidate.togglesUsed.push('thinking');
    candidate.forcedSwitch = true;
  }

  candidate.autoWebSearch = autoWebSearch;
  candidate.searchSignals = searchSignals;

  if (!candidate.togglesUsed.includes('thinking') && detectQuickIntent(normalized, tokenBudget)) {
    candidate.intent = 'quick';
    candidate.intensity = Math.max(candidate.intensity, 0.68);
    candidate.reason.push('signal:quick');
    candidate.forcedSwitch = true;
  }

  const supportSignal = detectSupportIntent(normalized);
  if (supportSignal && candidate.intent !== 'support' && !candidate.togglesUsed.includes('thinking')) {
    const supportIntensity = 0.66;
    if (supportIntensity >= candidate.intensity - 0.08) {
      candidate.intent = 'support';
      candidate.intensity = Math.max(candidate.intensity, supportIntensity);
      candidate.reason.push('signal:support');
    }
  }

  if (
    !candidate.togglesUsed.includes('thinking') &&
    candidate.intent !== 'deep_reasoning' &&
    detectDetailIntent(normalized, tokenBudget)
  ) {
    const depthIntensity = 0.76;
    if (depthIntensity > candidate.intensity + 0.05) {
      candidate.intent = 'deep_reasoning';
      candidate.intensity = depthIntensity;
      candidate.reason.push('signal:depth');
    }
  }

  if (
    keywordSignals.length === 0 &&
    !candidate.togglesUsed.length &&
    previousState?.intent &&
    previousState.intent !== DEFAULT_INTENT
  ) {
    candidate.intent = previousState.intent;
    candidate.intensity = Math.max(candidate.intensity, previousState.intensity * 0.92);
    candidate.reason.push('carryover');
  }

  candidate.keywordHits = Array.from(new Set(candidate.keywordHits));
  candidate.togglesUsed = Array.from(new Set(candidate.togglesUsed));
  candidate.reason = Array.from(new Set(candidate.reason));
  return { ...candidate, keywordSignals };
}

function applyPreset(body, preset, specName) {
  const mergedPreset = removeNullishValues({ ...preset, spec: specName });
  for (const [key, value] of Object.entries(mergedPreset)) {
    if (value !== undefined) {
      body[key] = value;
    }
  }
}

function applyAutoRouting(req) {
  const appConfig = req.config;
  const specList = appConfig?.modelSpecs?.list;
  if (!Array.isArray(specList) || specList.length === 0) {
    logger.warn('[AutoRouter] Spec list missing or empty');
    return null;
  }

  const availableSpecs = new Set(specList.map((spec) => spec?.name).filter(Boolean));
  const defaultSpecName = INTENT_TO_SPEC[DEFAULT_INTENT];

  if (!availableSpecs.has(defaultSpecName)) {
    logger.warn('[AutoRouter] Default spec missing from list', {
      defaultSpecName,
      specNames: Array.from(availableSpecs),
    });
    return null;
  }

  const missingSpecs = Object.values(INTENT_TO_SPEC).filter((specName) => !availableSpecs.has(specName));
  if (missingSpecs.length > 0) {
    logger.warn('[AutoRouter] Spec list missing intents', { missingSpecs });
  }

  const { body } = req;
  const endpoint = body?.endpoint;
  if (!endpoint || !AUTO_ROUTED_ENDPOINTS.has(endpoint)) {
    return null;
  }

  if (body?.agent_id || body?.agentOptions?.agent) {
    return null;
  }

  let parsedConversation;
  try {
    parsedConversation = parseCompactConvo({
      endpoint,
      endpointType: body.endpointType ?? endpoint,
      conversation: body,
    });
  } catch (error) {
    logger.warn('[AutoRouter] Failed to parse conversation payload', error);
    return null;
  }

  req.autoRoutedConversation = parsedConversation;

  const autoRoutingOptOut = body?.auto_router_opt_out ?? body?.autoRouterOptOut;
  if (toBoolean(autoRoutingOptOut)) {
    return null;
  }

  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text) {
    return null;
  }

  const tokenBudget = Math.max(
    Number(body.max_tokens) || 0,
    Number(body.maxOutputTokens) || 0,
    Number(body.maxContextTokens) || 0,
  );

  const toggles = {
    thinking: body.thinking ?? parsedConversation?.thinking,
    web_search: body.web_search ?? parsedConversation?.web_search,
  };

  const userId = req.user?.id ?? 'anonymous';
  const conversationId = body.conversationId ?? 'new';
  const gaugeKey = `${userId}:${conversationId}`;
  const previousState = getState(gaugeKey);

  const candidate = buildCandidate({ text, toggles, tokenBudget, previousState });
  const togglesAfterRouting = Object.fromEntries(
    Object.entries(toggles).map(([key, value]) => [
      key,
      value === undefined ? value : toBoolean(value),
    ]),
  );

  if (candidate.autoWebSearch && !togglesAfterRouting.web_search) {
    togglesAfterRouting.web_search = true;
  }

  const { state: gaugeState, switched } = updateGauge({
    key: gaugeKey,
    candidate,
    forced: candidate.forcedSwitch,
  });

  const finalIntent = gaugeState.intent ?? DEFAULT_INTENT;
  const targetSpecName = INTENT_TO_SPEC[finalIntent] ?? INTENT_TO_SPEC[DEFAULT_INTENT];
  let targetSpec = specList.find((spec) => spec.name === targetSpecName);

  if (!targetSpec) {
    logger.warn('[AutoRouter] Target spec unavailable, falling back to default', {
      requestedSpec: targetSpecName,
      defaultSpec: defaultSpecName,
    });
    targetSpec = specList.find((spec) => spec.name === defaultSpecName);
  }

  if (!targetSpec) {
    logger.error('[AutoRouter] Default spec missing during fallback', {
      defaultSpec: defaultSpecName,
    });
    return null;
  }

  applyPreset(body, targetSpec.preset, targetSpec.name);

  if (togglesAfterRouting.web_search) {
    body.web_search = true;
  }

  let sanitized;
  try {
    sanitized = parseCompactConvo({
      endpoint: body.endpoint ?? endpoint,
      endpointType: body.endpointType ?? endpoint,
      conversation: body,
    });
    req.autoRoutedConversation = sanitized;
  } catch (error) {
    logger.warn('[AutoRouter] Failed to sanitize routed conversation', error);
  }

  logger.info('[AutoRouter] Routed request', {
    userId,
    conversationId,
    intent: finalIntent,
    spec: targetSpec.name,
    endpoint: body.endpoint,
    model: body.model,
    intensity: Number((gaugeState.intensity ?? 0).toFixed(2)),
    switched,
    toggles: togglesAfterRouting,
    keywordHits: candidate.keywordHits,
    tokenBudget,
    reason: candidate.reason,
    autoWebSearch: candidate.autoWebSearch,
    searchSignals: candidate.searchSignals,
  });

  return {
    parsedConversation: sanitized ?? parsedConversation,
    intent: finalIntent,
    spec: targetSpec.name,
    gauge: gaugeState,
    candidate,
    toggles: togglesAfterRouting,
  };
}

module.exports = {
  applyAutoRouting,
  INTENT_TO_SPEC,
  KEYWORD_GROUPS,
  buildCandidate,
};
