const noop = () => {};

const logger = {
  error: noop,
  warn: noop,
  info: noop,
  debug: noop,
  child: () => logger,
};

const removeNullishValues = (obj, removeEmptyStrings = false) => {
  if (obj == null || typeof obj !== 'object') {
    return {};
  }

  const clone = { ...obj };

  Object.keys(clone).forEach((key) => {
    const value = clone[key];
    if (value === undefined || value === null) {
      delete clone[key];
      return;
    }
    if (removeEmptyStrings && typeof value === 'string' && value === '') {
      delete clone[key];
    }
  });

  return clone;
};

const Verbosity = {
  none: '',
  low: 'low',
  medium: 'medium',
  high: 'high',
};

const ReasoningEffort = {
  none: '',
  minimal: 'minimal',
  low: 'low',
  medium: 'medium',
  high: 'high',
};

const ReasoningSummary = {
  none: '',
  auto: 'auto',
  concise: 'concise',
  detailed: 'detailed',
};

module.exports = {
  logger,
  removeNullishValues,
  webSearchAuth: { categories: [], keys: {} },
  Verbosity,
  ReasoningEffort,
  ReasoningSummary,
};
