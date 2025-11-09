const fs = require('fs');
const path = require('path');
const { logger } = require('@librechat/data-schemas');

const DEFAULT_CONFIG_PATH = path.resolve(
  __dirname,
  '../../../../config/autoRouterKeywords.default.json',
);
// eslint-disable-next-line import/no-dynamic-require
const DEFAULT_RAW_CONFIG = require('../../../../config/autoRouterKeywords.default.json');

let cachedConfig = null;

const LANGUAGE_NAME_TO_CODE = {
  english: 'en',
  spanish: 'es',
  espanol: 'es',
  español: 'es',
  french: 'fr',
  francais: 'fr',
  français: 'fr',
  german: 'de',
  deutsch: 'de',
  chinese: 'zh',
  mandarin: 'zh',
  japanese: 'ja',
  korean: 'ko',
  russian: 'ru',
  arabic: 'ar',
  portuguese: 'pt',
  brazilian: 'pt',
  italian: 'it',
  hindi: 'hi',
  vietnamese: 'vi',
  turkish: 'tr',
  dutch: 'nl',
  polish: 'pl',
  swedish: 'sv',
  norwegian: 'no',
  danish: 'da',
  finnish: 'fi',
  greek: 'el',
  hebrew: 'he',
  thai: 'th',
  indonesian: 'id',
  malay: 'ms',
  ukrainian: 'uk',
  urdu: 'ur',
  bengali: 'bn',
  tamil: 'ta',
  telugu: 'te',
  marathi: 'mr',
  gujarati: 'gu',
  punjabi: 'pa',
  farsi: 'fa',
  persian: 'fa',
  latin: 'la',
  welsh: 'cy',
  catalan: 'ca',
  basque: 'eu',
  swahili: 'sw',
  zulu: 'zu',
  afrikaans: 'af',
  tagalog: 'tl',
  filipino: 'fil',
  czech: 'cs',
  slovak: 'sk',
  slovenian: 'sl',
  croatian: 'hr',
  serbian: 'sr',
  romanian: 'ro',
  bulgarian: 'bg',
  hungarian: 'hu',
};

function getConfigPath() {
  if (process.env.AUTO_ROUTER_KEYWORD_CONFIG) {
    return path.resolve(process.env.AUTO_ROUTER_KEYWORD_CONFIG);
  }
  return path.resolve(__dirname, '../../../../config/autoRouterKeywords.json');
}

function ensureNumber(value, fallback, { name, context, min = -Infinity, max = Infinity }) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value < min || value > max) {
      throw new Error(`${name} for ${context} must be between ${min} and ${max}`);
    }
    return value;
  }
  if (typeof fallback === 'number' && Number.isFinite(fallback)) {
    if (fallback < min || fallback > max) {
      throw new Error(`${name} for ${context} fallback is outside bounds`);
    }
    return fallback;
  }
  throw new Error(`${name} for ${context} must be a finite number`);
}

function compileRegex(entry, context) {
  if (entry instanceof RegExp) {
    return entry;
  }

  if (typeof entry === 'string') {
    return new RegExp(entry, 'i');
  }

  if (entry && typeof entry === 'object' && typeof entry.pattern === 'string') {
    const flags = typeof entry.flags === 'string' ? entry.flags : 'i';
    return new RegExp(entry.pattern, flags);
  }

  throw new Error(`Invalid regex entry for ${context}`);
}

function normalizeLanguagePattern(pattern, defaultWeight, fallback, context) {
  const codes = new Set();
  const patternCodes = Array.isArray(pattern.codes)
    ? pattern.codes
    : Array.isArray(fallback?.codes)
      ? fallback.codes
      : [];

  for (const code of patternCodes) {
    if (typeof code === 'string' && code.trim()) {
      codes.add(code.trim().toLowerCase());
    }
  }

  const match = pattern.match ?? fallback?.match ?? null;
  const allowedMatches = new Set([
    null,
    'nonEnglish',
    'multiple',
    'explicitMention',
    'any',
  ]);

  if (!allowedMatches.has(match)) {
    throw new Error(`Unsupported language match type "${match}" for ${context}`);
  }

  if (!codes.size && !match) {
    throw new Error(`Language pattern for ${context} must define codes or match type`);
  }

  const weight = ensureNumber(pattern.weight, fallback?.weight ?? defaultWeight, {
    name: 'weight',
    context,
    min: 0,
    max: 1,
  });

  const description =
    typeof pattern.description === 'string'
      ? pattern.description
      : typeof fallback?.description === 'string'
        ? fallback.description
        : codes.size
          ? `language:${Array.from(codes)[0]}`
          : `language:${match ?? 'signal'}`;

  return {
    type: 'language',
    codes,
    match,
    weight,
    description,
  };
}

function normalizeCodeblockPattern(pattern, defaultWeight, fallback, context) {
  const languages = new Set();
  const patternLanguages = Array.isArray(pattern.languages)
    ? pattern.languages
    : Array.isArray(fallback?.languages)
      ? fallback.languages
      : [];

  for (const lang of patternLanguages) {
    if (typeof lang === 'string' && lang.trim()) {
      languages.add(lang.trim().toLowerCase());
    }
  }

  const weight = ensureNumber(pattern.weight, fallback?.weight ?? defaultWeight, {
    name: 'weight',
    context,
    min: 0,
    max: 1,
  });

  const description =
    typeof pattern.description === 'string'
      ? pattern.description
      : typeof fallback?.description === 'string'
        ? fallback.description
        : 'codeblock';

  return {
    type: 'codeblock',
    languages,
    requireLanguage: Boolean(pattern.requireLanguage ?? fallback?.requireLanguage ?? false),
    weight,
    description,
  };
}

function normalizeAttachmentPattern(pattern, defaultWeight, fallback, context) {
  const matchValues = Array.isArray(pattern.match)
    ? pattern.match
    : Array.isArray(fallback?.match)
      ? fallback.match
      : [];

  if (!matchValues.length) {
    throw new Error(`Attachment pattern for ${context} must declare match values`);
  }

  const normalized = new Set();
  for (const value of matchValues) {
    if (value === undefined || value === null) {
      continue;
    }

    const normalizedValue = String(value).trim().toLowerCase();
    if (!normalizedValue) {
      continue;
    }
    normalized.add(normalizedValue);
  }

  if (!normalized.size) {
    throw new Error(`Attachment pattern for ${context} must include valid match values`);
  }

  const weight = ensureNumber(pattern.weight, fallback?.weight ?? defaultWeight, {
    name: 'weight',
    context,
    min: 0,
    max: 1,
  });

  const description =
    typeof pattern.description === 'string'
      ? pattern.description
      : typeof fallback?.description === 'string'
        ? fallback.description
        : `attachment:${Array.from(normalized)[0]}`;

  return {
    type: 'attachment',
    match: normalized,
    matchAny: pattern.matchAny ?? fallback?.matchAny ?? true,
    weight,
    description,
  };
}

function normalizeRegexPattern(pattern, defaultWeight, fallback, context) {
  const regex = compileRegex(pattern.pattern ?? pattern.value ?? pattern, context);
  const weight = ensureNumber(pattern.weight, fallback?.weight ?? defaultWeight, {
    name: 'weight',
    context,
    min: 0,
    max: 1,
  });

  const description =
    typeof pattern.description === 'string'
      ? pattern.description
      : typeof fallback?.description === 'string'
        ? fallback.description
        : regex.source;

  return {
    type: 'regex',
    regex,
    weight,
    description,
  };
}

function normalizePattern(pattern, defaultWeight, fallback, context) {
  const patternType = pattern?.type ?? fallback?.type ?? 'regex';
  switch (patternType) {
    case 'regex':
      return normalizeRegexPattern(pattern, defaultWeight, fallback, context);
    case 'language':
      return normalizeLanguagePattern(pattern, defaultWeight, fallback, context);
    case 'codeblock':
      return normalizeCodeblockPattern(pattern, defaultWeight, fallback, context);
    case 'attachment':
      return normalizeAttachmentPattern(pattern, defaultWeight, fallback, context);
    default:
      throw new Error(`Unsupported pattern type "${patternType}" for ${context}`);
  }
}

function normalizeKeywordGroups(rawConfig, fallbackConfig, defaultWeight) {
  const fallbackMap = new Map();
  for (const group of fallbackConfig.keywordGroups ?? []) {
    if (group?.intent) {
      fallbackMap.set(group.intent, group);
    }
  }

  const keywordGroups = rawConfig.keywordGroups ?? fallbackConfig.keywordGroups;
  if (!Array.isArray(keywordGroups) || keywordGroups.length === 0) {
    throw new Error('keywordGroups must be a non-empty array');
  }

  return keywordGroups.map((group, index) => {
    if (!group || typeof group !== 'object') {
      throw new Error(`keywordGroups[${index}] must be an object`);
    }

    const fallback = group.intent ? fallbackMap.get(group.intent) : fallbackConfig.keywordGroups?.[index];
    const intent = typeof group.intent === 'string' && group.intent.trim()
      ? group.intent.trim()
      : fallback?.intent;

    if (!intent) {
      throw new Error(`keywordGroups[${index}] must define an intent`);
    }

    const baseIntensity = ensureNumber(group.baseIntensity, fallback?.baseIntensity, {
      name: 'baseIntensity',
      context: `intent:${intent}`,
      min: 0,
      max: 1,
    });

    const maxBoost = ensureNumber(group.maxBoost, fallback?.maxBoost ?? 0.32, {
      name: 'maxBoost',
      context: `intent:${intent}`,
      min: 0,
      max: 1,
    });

    const maxIntensity = ensureNumber(group.maxIntensity, fallback?.maxIntensity ?? 1, {
      name: 'maxIntensity',
      context: `intent:${intent}`,
      min: baseIntensity,
      max: 1,
    });

    const patterns = Array.isArray(group.patterns) && group.patterns.length > 0
      ? group.patterns
      : Array.isArray(fallback?.patterns)
        ? fallback.patterns
        : null;

    if (!Array.isArray(patterns) || patterns.length === 0) {
      throw new Error(`intent ${intent} must define at least one pattern`);
    }

    const normalizedPatterns = patterns.map((pattern, patternIndex) =>
      normalizePattern(pattern, defaultWeight, fallback?.patterns?.[patternIndex], `intent:${intent}:pattern[${patternIndex}]`),
    );

    return {
      intent,
      baseIntensity,
      maxBoost,
      maxIntensity,
      patterns: normalizedPatterns,
    };
  });
}

function normalizeIntentSection(rawSection, fallbackSection, name) {
  const section = rawSection && typeof rawSection === 'object' ? rawSection : fallbackSection;
  if (!section) {
    throw new Error(`${name} section is missing`);
  }

  const patterns = Array.isArray(section.patterns) ? section.patterns : fallbackSection?.patterns;
  if (!Array.isArray(patterns) || patterns.length === 0) {
    throw new Error(`${name} must define at least one pattern`);
  }

  const normalizedPatterns = patterns.map((pattern, index) =>
    compileRegex(pattern, `${name}:pattern[${index}]`),
  );

  const intensity = ensureNumber(section.intensity, fallbackSection?.intensity, {
    name: `${name}.intensity`,
    context: name,
    min: 0,
    max: 1,
  });

  const fallbackThreshold =
    typeof fallbackSection?.tokenBudgetThreshold === 'number'
      ? fallbackSection.tokenBudgetThreshold
      : 0;

  const tokenBudgetThreshold = ensureNumber(section.tokenBudgetThreshold, fallbackThreshold, {
    name: `${name}.tokenBudgetThreshold`,
    context: name,
    min: 0,
    max: Number.MAX_SAFE_INTEGER,
  });

  return {
    patterns: normalizedPatterns,
    intensity,
    tokenBudgetThreshold,
  };
}

function normalizeConfig(rawConfig, fallbackConfig = DEFAULT_RAW_CONFIG) {
  const defaultWeight = ensureNumber(
    rawConfig.defaultPatternWeight,
    fallbackConfig.defaultPatternWeight ?? 0.08,
    {
      name: 'defaultPatternWeight',
      context: 'config',
      min: 0,
      max: 1,
    },
  );

  const keywordGroups = normalizeKeywordGroups(rawConfig, fallbackConfig, defaultWeight);

  return {
    keywordGroups,
    quickIntent: normalizeIntentSection(rawConfig.quickIntent, fallbackConfig.quickIntent, 'quickIntent'),
    detailIntent: normalizeIntentSection(rawConfig.detailIntent, fallbackConfig.detailIntent, 'detailIntent'),
    supportIntent: normalizeIntentSection(rawConfig.supportIntent, fallbackConfig.supportIntent, 'supportIntent'),
    defaultPatternWeight: defaultWeight,
  };
}

function loadRawConfig(configPath) {
  const fileContents = fs.readFileSync(configPath, 'utf8');
  return JSON.parse(fileContents);
}

function loadConfigFromPath(configPath) {
  try {
    const rawConfig = loadRawConfig(configPath);
    return normalizeConfig(rawConfig);
  } catch (error) {
    logger.warn('[AutoRouter] Failed to load keyword configuration', {
      path: configPath,
      error: error.message,
    });
    return null;
  }
}

function getKeywordConfig() {
  if (cachedConfig) {
    return cachedConfig;
  }

  const configPath = getConfigPath();
  let normalized = loadConfigFromPath(configPath);

  if (!normalized) {
    normalized = normalizeConfig(DEFAULT_RAW_CONFIG);
  }

  cachedConfig = normalized;
  return cachedConfig;
}

function __resetKeywordConfigCache() {
  cachedConfig = null;
}

module.exports = {
  getKeywordConfig,
  __resetKeywordConfigCache,
  DEFAULT_CONFIG_PATH,
  LANGUAGE_NAME_TO_CODE,
};
