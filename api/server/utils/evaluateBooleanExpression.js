const vm = require('node:vm');

const SAFE_EXPRESSION_REGEX = /^[\w\s.!<>=&|?:,'"-()]+$/;

const toNullProto = (value) => {
  if (Array.isArray(value)) {
    return Object.freeze(value.map((item) => toNullProto(item)));
  }

  if (value && typeof value === 'object') {
    const result = Object.create(null);
    for (const [key, val] of Object.entries(value)) {
      result[key] = toNullProto(val);
    }
    return Object.freeze(result);
  }

  return value;
};

const coerceBoolean = (value) => {
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

  if (value == null) {
    return false;
  }

  return Boolean(value);
};

const sanitizeExpression = (expression) => {
  if (typeof expression !== 'string') {
    return null;
  }

  let expr = expression.trim();

  if (expr.startsWith('{{') && expr.endsWith('}}')) {
    expr = expr.slice(2, -2).trim();
  }

  if (expr.length === 0) {
    return null;
  }

  if (!SAFE_EXPRESSION_REGEX.test(expr)) {
    throw new Error('Expression contains unsupported characters');
  }

  return expr;
};

/**
 * Evaluates a boolean expression string within a sandboxed context.
 * Supported syntax includes logical operators (!, &&, ||), comparisons,
 * ternaries, parentheses, and string/number literals.
 *
 * @param {string} expression - The expression to evaluate.
 * @param {Record<string, unknown>} [context] - Context values available in the expression.
 * @returns {boolean|null} The coerced boolean result, or null when expression is empty/invalid.
 */
const evaluateBooleanExpression = (expression, context = {}) => {
  const sanitizedExpression = sanitizeExpression(expression);

  if (sanitizedExpression === null) {
    return null;
  }

  const sandbox = Object.create(null);

  for (const [key, value] of Object.entries(context)) {
    sandbox[key] = toNullProto(value);
  }

  try {
    const script = new vm.Script(sanitizedExpression);
    const result = script.runInNewContext(sandbox, { timeout: 100 });
    return coerceBoolean(result);
  } catch (error) {
    throw new Error(`Failed to evaluate boolean expression: ${error.message}`);
  }
};

module.exports = {
  evaluateBooleanExpression,
};
