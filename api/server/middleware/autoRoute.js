const { logger } = require('@librechat/data-schemas');
const { applyAutoRouting } = require('~/server/services/Router/autoRouter');

function autoRoute(req, _res, next) {
  try {
    const result = applyAutoRouting(req);
    if (result?.parsedConversation) {
      req.autoRoutedConversation = result.parsedConversation;
      req.autoRouterDecision = {
        intent: result.intent,
        spec: result.spec,
        intensity: result.gauge?.intensity,
        reason: result.candidate?.reason,
      };
    }
  } catch (error) {
    logger.error('[AutoRouter] Failed to evaluate routing decision', error);
  }

  next();
}

module.exports = autoRoute;
