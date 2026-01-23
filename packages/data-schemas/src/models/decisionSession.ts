/**
 * OptimismAI - Decision Session Model
 * Creates the DecisionSession mongoose model
 */

import decisionSessionSchema from '~/schema/decisionSession';

/**
 * Creates or returns the DecisionSession model using the provided mongoose instance
 */
export function createDecisionSessionModel(mongoose: typeof import('mongoose')) {
    return (
        mongoose.models.DecisionSession ||
        mongoose.model('DecisionSession', decisionSessionSchema)
    );
}
