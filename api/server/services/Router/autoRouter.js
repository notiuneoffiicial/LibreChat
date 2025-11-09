const { logger } = require('@librechat/data-schemas');
const { parseCompactConvo, removeNullishValues, Tools } = require('librechat-data-provider');
const { DEFAULT_INTENT, updateGauge, getState } = require('./intentGauge');
const { getKeywordConfig, LANGUAGE_NAME_TO_CODE } = require('./autoRouterConfig');

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

const KEYWORD_CONFIG = getKeywordConfig();
const KEYWORD_GROUPS = KEYWORD_CONFIG.keywordGroups;
const QUICK_CONFIG = KEYWORD_CONFIG.quickIntent;
const DETAIL_CONFIG = KEYWORD_CONFIG.detailIntent;
const SUPPORT_CONFIG = KEYWORD_CONFIG.supportIntent;
const QUICK_PATTERNS = QUICK_CONFIG.patterns;
const DETAIL_PATTERNS = DETAIL_CONFIG.patterns;
const SUPPORT_PATTERNS = SUPPORT_CONFIG.patterns;
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

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const LANGUAGE_NAME_REGEXES = Object.entries(LANGUAGE_NAME_TO_CODE).map(([name, code]) => ({
  code,
  regex: new RegExp(`\\b${escapeRegExp(name.toLowerCase())}\\b`, 'i'),
}));

const LANGUAGE_SCRIPT_DETECTORS = [
  { code: 'zh', regex: /[\u4e00-\u9fff]/ },
  { code: 'ja', regex: /[\u3040-\u30ff\u31f0-\u31ff]/ },
  { code: 'ko', regex: /[\uac00-\ud7af]/ },
  { code: 'ru', regex: /[\u0400-\u04ff]/ },
  { code: 'ar', regex: /[\u0600-\u06ff]/ },
  { code: 'he', regex: /[\u0590-\u05ff]/ },
  { code: 'el', regex: /[\u0370-\u03ff]/ },
  { code: 'hi', regex: /[\u0900-\u097f]/ },
  { code: 'th', regex: /[\u0e00-\u0e7f]/ },
];

const LANGUAGE_KEYWORD_DETECTORS = [
  { code: 'es', regex: /(?:\b(?:hola|gracias|por favor|qué)\b|[¡¿])/i },
  { code: 'fr', regex: /\b(?:bonjour|merci|s'il vous plaît|ça)\b/i },
  { code: 'de', regex: /\b(?:hallo|danke|bitte|über)\b/i },
  { code: 'pt', regex: /\b(?:olá|obrigado|por favor)\b/i },
  { code: 'it', regex: /\b(?:ciao|grazie|per favore)\b/i },
  { code: 'vi', regex: /\b(?:xin chào|cảm ơn)\b/i },
  { code: 'tr', regex: /\b(?:merhaba|teşekkür)\b/i },
  { code: 'pl', regex: /\b(?:dzień dobry|dziękuję)\b/i },
];

const PROGRAMMING_LANGUAGE_KEYWORDS = [
  { code: 'python', regex: /\bpython\b/i },
  { code: 'javascript', regex: /\bjavascript\b/i },
  { code: 'typescript', regex: /\btypescript\b/i },
  { code: 'java', regex: /\bjava\b/i },
  { code: 'c\+\+', regex: /\bc\+\+\b/i },
  { code: 'c#', regex: /\bc#\b/i },
  { code: 'go', regex: /\bgo(lang)?\b/i },
  { code: 'rust', regex: /\brust\b/i },
  { code: 'ruby', regex: /\bruby\b/i },
  { code: 'php', regex: /\bphp\b/i },
  { code: 'swift', regex: /\bswift\b/i },
  { code: 'kotlin', regex: /\bkotlin\b/i },
  { code: 'sql', regex: /\bsql\b/i },
];

const CODE_BLOCK_REGEX = /```([a-z0-9#+\-_.]+)?[\s\S]*?```/gi;
const TILDE_CODE_BLOCK_REGEX = /~~~([a-z0-9#+\-_.]+)?[\s\S]*?~~~/gi;
const HTML_CODE_BLOCK_REGEX = /<code[^>]*>([\s\S]*?)<\/code>/gi;

function detectCodeBlockSignals(text) {
  if (typeof text !== 'string' || text.length === 0) {
    return { hasCodeBlock: false, languages: new Set() };
  }

  const languages = new Set();
  let hasCodeBlock = false;

  const regexes = [CODE_BLOCK_REGEX, TILDE_CODE_BLOCK_REGEX];
  for (const regex of regexes) {
    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(text)) !== null) {
      hasCodeBlock = true;
      if (match[1]) {
        languages.add(match[1].toLowerCase());
      }
    }
  }

  HTML_CODE_BLOCK_REGEX.lastIndex = 0;
  let htmlMatch;
  while ((htmlMatch = HTML_CODE_BLOCK_REGEX.exec(text)) !== null) {
    hasCodeBlock = true;
    const classMatch = htmlMatch[0].match(/language-([a-z0-9#+\-_.]+)/i);
    if (classMatch) {
      languages.add(classMatch[1].toLowerCase());
    }
  }

  return { hasCodeBlock, languages };
}

function detectLanguageHints(text) {
  const languages = new Set();
  const mentions = new Set();

  if (typeof text !== 'string' || !text.trim()) {
    return { languages, mentions, languageCount: 0, hasNonEnglish: false };
  }

  for (const detector of LANGUAGE_SCRIPT_DETECTORS) {
    detector.regex.lastIndex = 0;
    if (detector.regex.test(text)) {
      languages.add(detector.code);
    }
  }

  const lowerText = text.toLowerCase();
  for (const detector of LANGUAGE_KEYWORD_DETECTORS) {
    detector.regex.lastIndex = 0;
    if (detector.regex.test(text)) {
      languages.add(detector.code);
      mentions.add(detector.code);
    }
  }

  for (const { code, regex } of LANGUAGE_NAME_REGEXES) {
    regex.lastIndex = 0;
    if (regex.test(lowerText)) {
      mentions.add(code);
      if (code.length <= 3) {
        languages.add(code);
      }
    }
  }

  for (const detector of PROGRAMMING_LANGUAGE_KEYWORDS) {
    detector.regex.lastIndex = 0;
    if (detector.regex.test(text)) {
      mentions.add(detector.code);
    }
  }

  if (/[a-z]/i.test(text)) {
    languages.add('en');
  }

  const hasNonEnglish = Array.from(languages).some((code) => code !== 'en');

  return {
    languages,
    mentions,
    languageCount: languages.size,
    hasNonEnglish,
  };
}

function extractAttachmentDescriptors(attachments) {
  const descriptors = new Set();
  if (!Array.isArray(attachments)) {
    return descriptors;
  }

  const addValue = (value) => {
    if (typeof value === 'string') {
      const trimmed = value.trim().toLowerCase();
      if (trimmed) {
        descriptors.add(trimmed);
      }
    }
  };

  const addFilename = (value) => {
    if (typeof value !== 'string') {
      return;
    }
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) {
      return;
    }
    descriptors.add(trimmed);
    const match = trimmed.match(/\.([a-z0-9]+)$/i);
    if (match) {
      descriptors.add(`ext:${match[1]}`);
    }
  };

  for (const attachment of attachments) {
    if (!attachment || typeof attachment !== 'object') {
      continue;
    }

    addValue(attachment.type);
    addValue(attachment.mimeType);
    addValue(attachment.mimetype);
    addValue(attachment.mime);
    addValue(attachment.contentType);
    addValue(attachment.category);
    addValue(attachment.kind);
    addValue(attachment.role);

    if (attachment.metadata && typeof attachment.metadata === 'object') {
      addValue(attachment.metadata.type);
      addValue(attachment.metadata.mimeType);
      addValue(attachment.metadata.mimetype);
      addValue(attachment.metadata.category);
      addValue(attachment.metadata.kind);
    }

    if (attachment.file && typeof attachment.file === 'object') {
      addValue(attachment.file.type);
      addValue(attachment.file.mimeType);
      addValue(attachment.file.mimetype);
      addValue(attachment.file.contentType);
      addFilename(attachment.file.filename);
      addFilename(attachment.file.name);
    }

    addFilename(attachment.filename);
    addFilename(attachment.name);
    addFilename(attachment.originalName);

    if (typeof attachment.ext === 'string') {
      addValue(`ext:${attachment.ext.toLowerCase()}`);
    }

    if (Array.isArray(attachment.tools)) {
      for (const tool of attachment.tools) {
        if (!tool) {
          continue;
        }
        if (typeof tool === 'string') {
          addValue(`tool:${tool}`);
        } else if (typeof tool === 'object' && tool.type) {
          addValue(`tool:${String(tool.type).toLowerCase()}`);
        }
      }
    }

    if (typeof attachment.tool === 'string') {
      addValue(`tool:${attachment.tool}`);
    }
  }

  return descriptors;
}

function formatContribution(description, value) {
  if (!description) {
    return value ?? '';
  }
  if (!value) {
    return description;
  }
  if (description.includes('%s')) {
    return description.replace('%s', value);
  }
  if (description.includes(value)) {
    return description;
  }
  return `${description}:${value}`;
}

function evaluatePattern(pattern, context) {
  switch (pattern.type) {
    case 'regex': {
      pattern.regex.lastIndex = 0;
      if (pattern.regex.test(context.normalizedText)) {
        return { matched: true, contributions: [pattern.description] };
      }
      return { matched: false, contributions: [] };
    }
    case 'language': {
      const contributions = [];
      if (pattern.match === 'nonEnglish') {
        if (context.hasNonEnglish) {
          contributions.push(pattern.description);
        }
      } else if (pattern.match === 'multiple') {
        if (context.languageCount > 1 || context.languageMentions.size > 1) {
          contributions.push(pattern.description);
        }
      } else if (pattern.match === 'explicitMention') {
        const matches = pattern.codes?.size
          ? Array.from(pattern.codes).filter((code) => context.languageMentions.has(code))
          : Array.from(context.languageMentions);
        for (const match of matches) {
          contributions.push(formatContribution(pattern.description, match));
        }
      } else {
        const matches = pattern.codes?.size
          ? Array.from(pattern.codes).filter(
              (code) => context.languages.has(code) || context.languageMentions.has(code),
            )
          : [];
        for (const match of matches) {
          contributions.push(formatContribution(pattern.description, match));
        }
      }
      return { matched: contributions.length > 0, contributions };
    }
    case 'codeblock': {
      if (!context.codeInfo.hasCodeBlock) {
        return { matched: false, contributions: [] };
      }

      if (pattern.languages && pattern.languages.size > 0) {
        const matches = Array.from(pattern.languages).filter((lang) =>
          context.codeInfo.languages.has(lang),
        );
        if (matches.length === 0) {
          if (pattern.requireLanguage) {
            return { matched: false, contributions: [] };
          }
          return { matched: true, contributions: [pattern.description] };
        }
        return {
          matched: true,
          contributions: matches.map((lang) => formatContribution(pattern.description, lang)),
        };
      }

      return { matched: true, contributions: [pattern.description] };
    }
    case 'attachment': {
      const matches = Array.from(pattern.match).filter((value) =>
        context.attachmentDescriptors.has(value),
      );
      if (matches.length === 0) {
        return { matched: false, contributions: [] };
      }

      if (pattern.matchAny === false && matches.length < pattern.match.size) {
        return { matched: false, contributions: [] };
      }

      return {
        matched: true,
        contributions: matches.map((value) => formatContribution(pattern.description, value)),
      };
    }
    default:
      return { matched: false, contributions: [] };
  }
}

function buildKeywordContext({ text, normalizedText, attachments }) {
  const languageInfo = detectLanguageHints(text);
  const codeInfo = detectCodeBlockSignals(text);
  const attachmentDescriptors = extractAttachmentDescriptors(attachments);

  const languageMentions = new Set(languageInfo.mentions);
  for (const lang of codeInfo.languages) {
    languageMentions.add(lang);
    const mapped = LANGUAGE_NAME_TO_CODE[lang];
    if (mapped) {
      languageInfo.languages.add(mapped);
    }
  }

  const languageArray = Array.from(languageInfo.languages);
  const hasNonEnglish = languageArray.some((code) => code !== 'en');

  return {
    text,
    normalizedText,
    languages: languageInfo.languages,
    languageMentions,
    languageCount: languageArray.length,
    hasNonEnglish,
    codeInfo,
    attachmentDescriptors,
  };
}

function computeKeywordSignals(input) {
  const isStringInput = typeof input === 'string';
  const text = isStringInput ? input : input?.text;
  const normalizedText = isStringInput
    ? typeof input === 'string'
      ? input.toLowerCase()
      : ''
    : input?.normalizedText ?? (typeof input?.text === 'string' ? input.text.toLowerCase() : '');
  const attachments = isStringInput ? [] : input?.attachments ?? [];

  const sanitizedText = typeof text === 'string' ? text : '';
  const sanitizedNormalized = typeof normalizedText === 'string' ? normalizedText : sanitizedText;
  const attachmentList = Array.isArray(attachments) ? attachments : [];

  const context = buildKeywordContext({
    text: sanitizedText,
    normalizedText: sanitizedNormalized,
    attachments: attachmentList,
  });

  const signals = [];

  for (const group of KEYWORD_GROUPS) {
    let boost = 0;
    const hits = new Set();

    for (const pattern of group.patterns) {
      const { matched, contributions } = evaluatePattern(pattern, context);
      if (matched) {
        boost += pattern.weight;
        for (const contribution of contributions) {
          if (contribution) {
            hits.add(contribution);
          }
        }
      }
    }

    if (boost > 0) {
      const maxBoost = typeof group.maxBoost === 'number' ? group.maxBoost : 0.32;
      const appliedBoost = Math.min(boost, maxBoost);
      const intensity = clamp(
        group.baseIntensity + appliedBoost,
        group.baseIntensity,
        group.maxIntensity ?? 1,
      );

      signals.push({ intent: group.intent, intensity, hits: Array.from(hits) });
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
  if (
    QUICK_CONFIG.tokenBudgetThreshold > 0 &&
    tokenBudget > 0 &&
    tokenBudget <= QUICK_CONFIG.tokenBudgetThreshold
  ) {
    return true;
  }

  return QUICK_PATTERNS.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(text);
  });
}

function detectSupportIntent(text) {
  return SUPPORT_PATTERNS.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(text);
  });
}

function detectDetailIntent(text, tokenBudget) {
  if (DETAIL_CONFIG.tokenBudgetThreshold && tokenBudget >= DETAIL_CONFIG.tokenBudgetThreshold) {
    return true;
  }

  return DETAIL_PATTERNS.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(text);
  });
}

function collectAllAttachments(body, conversation) {
  const collected = [];
  const pushItems = (items) => {
    if (!Array.isArray(items)) {
      return;
    }
    for (const item of items) {
      if (item !== undefined && item !== null) {
        collected.push(item);
      }
    }
  };

  pushItems(body?.files);
  pushItems(body?.attachments);
  pushItems(body?.artifacts);
  pushItems(conversation?.files);
  pushItems(conversation?.attachments);

  const messageSources = [];
  if (Array.isArray(conversation?.messages)) {
    messageSources.push(...conversation.messages);
  } else if (Array.isArray(body?.messages)) {
    messageSources.push(...body.messages);
  }

  for (const message of messageSources) {
    pushItems(message?.attachments);
    pushItems(message?.files);
  }

  return collected;
}

function buildCandidate({ text, normalizedText, attachments, toggles, tokenBudget, previousState }) {
  const normalized = typeof normalizedText === 'string' ? normalizedText : text.toLowerCase();
  const keywordSignals = computeKeywordSignals({ text, normalizedText: normalized, attachments });

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
    candidate.intensity = Math.max(candidate.intensity, QUICK_CONFIG.intensity ?? 0.68);
    candidate.reason.push('signal:quick');
    candidate.forcedSwitch = true;
  }

  const supportSignal = detectSupportIntent(normalized);
  if (supportSignal && candidate.intent !== 'support' && !candidate.togglesUsed.includes('thinking')) {
    const supportIntensity = SUPPORT_CONFIG.intensity ?? 0.66;
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
    const depthIntensity = DETAIL_CONFIG.intensity ?? 0.76;
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

  const normalized = text.toLowerCase();
  const attachments = collectAllAttachments(body, parsedConversation);

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

  const candidate = buildCandidate({
    text,
    normalizedText: normalized,
    attachments,
    toggles,
    tokenBudget,
    previousState,
  });
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
    if (typeof body.ephemeralAgent !== 'object' || body.ephemeralAgent === null) {
      body.ephemeralAgent = {};
    }

    body.ephemeralAgent[Tools.web_search] = true;
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

  const routedModel = body.model ?? 'unknown model';

  logger.info(`[AutoRouter] Routed to ${targetSpec.name} (${routedModel})`, {
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
