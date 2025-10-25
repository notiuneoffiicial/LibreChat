const { logger } = require('@librechat/data-schemas');
const {
  Constants,
  Permissions,
  PermissionTypes,
  EModelEndpoint,
} = require('librechat-data-provider');
const { checkAccess, createMemoryProcessor } = require('@librechat/api');
const { getRoleByName } = require('~/models/Role');
const { loadAgent } = require('~/models/Agent');
const { initializeAgent } = require('~/server/services/Endpoints/agents/agent');
const { getFormattedMemories, deleteMemory, setMemory } = require('~/models');

const getAllowedProviders = (appConfig) =>
  new Set(appConfig?.endpoints?.[EModelEndpoint.agents]?.allowedProviders);

const buildMemoryAgentConfig = async ({ req, memoryConfig, currentAgent }) => {
  if (memoryConfig.agent?.id != null) {
    if (currentAgent?.id && memoryConfig.agent.id === currentAgent.id) {
      return currentAgent;
    }

    try {
      return await loadAgent({
        req,
        agent_id: memoryConfig.agent.id,
        endpoint: EModelEndpoint.agents,
      });
    } catch (error) {
      logger.error('[Memory] Failed to load configured memory agent', error);
      return null;
    }
  }

  if (memoryConfig.agent?.model != null && memoryConfig.agent?.provider != null) {
    return { id: Constants.EPHEMERAL_AGENT_ID, ...memoryConfig.agent };
  }

  logger.warn('[Memory] Memory agent configuration is missing required fields');
  return null;
};

const ensureInitializedAgent = async ({ req, res, agentConfig, memoryConfig }) => {
  if (!agentConfig) {
    return null;
  }

  const allowedProviders = getAllowedProviders(req.config);
  if (agentConfig?.provider) {
    allowedProviders.add(agentConfig.provider);
    if (typeof agentConfig.provider === 'string') {
      allowedProviders.add(agentConfig.provider.toLowerCase());
    }
  }

  const endpoint =
    agentConfig.id === Constants.EPHEMERAL_AGENT_ID
      ? memoryConfig.agent?.provider
      : EModelEndpoint.agents;

  try {
    return await initializeAgent({
      req,
      res,
      agent: agentConfig,
      allowedProviders,
      endpointOption: { endpoint },
    });
  } catch (error) {
    logger.error('[Memory] Failed to initialize memory agent', error);
    return null;
  }
};

const buildMemoryConfig = (memoryConfig, agent) => {
  if (!agent) {
    return null;
  }

  const llmConfig = Object.assign(
    {
      provider: agent.provider,
      model: agent.model,
    },
    agent.model_parameters,
  );

  return {
    validKeys: memoryConfig.validKeys,
    instructions: agent.instructions,
    llmConfig,
    tokenLimit: memoryConfig.tokenLimit,
    notableThreshold: memoryConfig.notableThreshold,
  };
};

/**
 * Initializes the memory context for a conversation.
 * @param {object} params
 * @param {ServerRequest} params.req
 * @param {ServerResponse} params.res
 * @param {string} params.conversationId
 * @param {string} params.messageId
 * @param {Agent | undefined} [params.currentAgent]
 * @returns {Promise<null | {
 *   summary: string,
 *   processMemory: ReturnType<typeof createMemoryProcessor>[1],
 *   classifyWindow: ReturnType<typeof createMemoryProcessor>[2],
 *   messageWindowSize: number,
 * }>}
 */
async function initializeMemoryContext({ req, res, conversationId, messageId, currentAgent }) {
  const user = req.user;
  if (user?.personalization?.memories === false) {
    return null;
  }

  const hasAccess = await checkAccess({
    user,
    permissionType: PermissionTypes.MEMORIES,
    permissions: [Permissions.USE],
    getRoleByName,
  });

  if (!hasAccess) {
    return null;
  }

  const appConfig = req.config;
  const memoryConfig = appConfig.memory;
  if (!memoryConfig || memoryConfig.disabled === true) {
    return null;
  }

  const agentConfig = await buildMemoryAgentConfig({
    req,
    memoryConfig,
    currentAgent,
  });

  if (!agentConfig) {
    return null;
  }

  const agent =
    agentConfig === currentAgent && currentAgent?.model_parameters
      ? currentAgent
      : await ensureInitializedAgent({
          req,
          res,
          agentConfig,
          memoryConfig,
        });

  if (!agent) {
    logger.warn('[Memory] No agent available for memory processing');
    return null;
  }

  const config = buildMemoryConfig(memoryConfig, agent);
  if (!config) {
    return null;
  }

  const [summary, processMemory, classifyWindow] = await createMemoryProcessor({
    res,
    config,
    userId: user.id + '',
    messageId: messageId + '',
    conversationId: conversationId + '',
    memoryMethods: {
      setMemory,
      deleteMemory,
      getFormattedMemories,
    },
  });

  return {
    summary,
    processMemory,
    classifyWindow,
    messageWindowSize: memoryConfig.messageWindowSize ?? 5,
  };
}

module.exports = {
  initializeMemoryContext,
};
