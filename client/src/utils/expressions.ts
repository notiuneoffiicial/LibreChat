import logger from './logger';

const SAFE_BOOLEAN_EXPRESSION = /^[\w\s()!&|='"-]+$/;
const EQUALITY_OPERATORS = /===|!==|==|!=/g;

export type BooleanExpressionContext = Record<string, unknown>;

/**
 * Evaluates a boolean expression string against the provided context.
 *
 * @param expression - A string containing the boolean expression to evaluate.
 * @param context - Key/value pairs exposed as variables during evaluation.
 * @returns `true` when the expression evaluates truthy, otherwise `false`.
 */
export function evaluateBooleanExpression(
  expression: string | undefined | null,
  context: BooleanExpressionContext,
): boolean {
  if (typeof expression !== 'string') {
    return false;
  }

  const trimmed = expression.trim();
  if (trimmed.length === 0) {
    return false;
  }

  if (!SAFE_BOOLEAN_EXPRESSION.test(trimmed)) {
    logger.warn?.('Ignoring unsafe boolean expression:', trimmed);
    return false;
  }

  const withoutEquality = trimmed.replace(EQUALITY_OPERATORS, '');
  if (withoutEquality.includes('=')) {
    logger.warn?.('Boolean expression contains unsupported assignment operator:', trimmed);
    return false;
  }

  const keys = Object.keys(context);

  try {
    // eslint-disable-next-line no-new-func
    const evaluator = new Function(
      ...keys,
      `'use strict'; return Boolean(${trimmed});`,
    ) as (...args: unknown[]) => unknown;

    const args = keys.map((key) => context[key]);
    const result = evaluator(...args);
    return Boolean(result);
  } catch (error) {
    logger.warn?.('Failed to evaluate boolean expression:', trimmed, error);
    return false;
  }
}
