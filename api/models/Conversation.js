const { logger } = require('@librechat/data-schemas');
const { createTempChatExpirationDate, composeMetaPrompt } = require('@librechat/api');
const { getMessages, deleteMessages } = require('./Message');
const { Conversation, Message } = require('~/db/models');
const { redactMessage } = require('~/config/parsers');

const MAX_HISTORY_LENGTH = 20;
const META_PROMPT_LOG_TRIM_LENGTH = 400;

const guardrailStatusMap = {
  ACCEPTED: 'accepted',
  ROLLED_BACK: 'rolled_back',
};

function shouldApplyMetaPrompt(convo = {}, metadata = {}) {
  if (convo?.isCreatedByUser === true) {
    return true;
  }

  const context = metadata?.context ?? '';
  if (!context) {
    return false;
  }

  if (context.includes('saveUserMessage')) {
    return true;
  }

  if (context === 'POST /api/messages/:conversationId') {
    return convo?.isCreatedByUser !== false;
  }

  return false;
}

function toComposerMessages(messages = []) {
  return messages.map((message) => ({
    role: message?.isCreatedByUser ? 'user' : 'assistant',
    text: message?.text ?? undefined,
    summary: message?.summary ?? undefined,
    content: Array.isArray(message?.content) ? message.content : undefined,
    createdAt: message?.createdAt ?? undefined,
  }));
}

function approxTokens(text = '') {
  const trimmed = text.trim();
  if (!trimmed) {
    return 0;
  }
  return trimmed.split(/\s+/).length;
}

function sanitizePromptPrefixForLog(prefix) {
  if (typeof prefix !== 'string') {
    return prefix ?? null;
  }

  return redactMessage(prefix, META_PROMPT_LOG_TRIM_LENGTH);
}

function createInitialHistoryEntry(prefix, timestamp) {
  const updatedAt = timestamp ?? new Date();
  const diagnostics = {
    revision: 1,
    appliedRules: [],
    conversationPhase: 'onboarding',
    sentimentScore: 0,
    sentimentLabel: 'neutral',
    guardrailReasons: [],
    diff: { added: 0, removed: 0, diffRatio: 0 },
    tokens: approxTokens(prefix ?? ''),
    sourcePrefix: 'default',
    timestamp: updatedAt.toISOString(),
    notes: 'Initial preset applied.',
  };

  return {
    revision: 1,
    promptPrefix: prefix ?? '',
    updatedAt,
    source: 'default',
    diagnostics,
    guardrailStatus: guardrailStatusMap.ACCEPTED,
  };
}

function updateGuardrailState(
  previous = {},
  status = guardrailStatusMap.ACCEPTED,
  diagnostics = {},
) {
  const now = new Date();
  const reasons = diagnostics.guardrailReasons ?? previous.reasons ?? [];
  if (status === guardrailStatusMap.ACCEPTED) {
    return {
      ...previous,
      lastStatus: guardrailStatusMap.ACCEPTED,
      lastStatusAt: now,
      blocked: false,
      reasons,
    };
  }

  if (status === guardrailStatusMap.ROLLED_BACK) {
    const failureCount = (previous.failureCount ?? 0) + 1;
    const blockedPhrases = [
      ...(previous.blockedPhrases ?? []),
      ...reasons.filter((reason) => typeof reason === 'string' && reason.startsWith('forbidden:')),
    ].slice(-10);

    return {
      ...previous,
      lastStatus: guardrailStatusMap.ROLLED_BACK,
      lastStatusAt: now,
      blocked: true,
      reasons,
      blockedPhrases,
      failureCount,
    };
  }

  return previous;
}

/**
 * Searches for a conversation by conversationId and returns a lean document with only conversationId and user.
 * @param {string} conversationId - The conversation's ID.
 * @returns {Promise<{conversationId: string, user: string} | null>} The conversation object with selected fields or null if not found.
 */
const searchConversation = async (conversationId) => {
  try {
    return await Conversation.findOne({ conversationId }, 'conversationId user').lean();
  } catch (error) {
    logger.error('[searchConversation] Error searching conversation', error);
    throw new Error('Error searching conversation');
  }
};

/**
 * Retrieves a single conversation for a given user and conversation ID.
 * @param {string} user - The user's ID.
 * @param {string} conversationId - The conversation's ID.
 * @returns {Promise<TConversation>} The conversation object.
 */
const getConvo = async (user, conversationId) => {
  try {
    return await Conversation.findOne({ user, conversationId }).lean();
  } catch (error) {
    logger.error('[getConvo] Error getting single conversation', error);
    return { message: 'Error getting single conversation' };
  }
};

const deleteNullOrEmptyConversations = async () => {
  try {
    const filter = {
      $or: [
        { conversationId: null },
        { conversationId: '' },
        { conversationId: { $exists: false } },
      ],
    };

    const result = await Conversation.deleteMany(filter);

    // Delete associated messages
    const messageDeleteResult = await deleteMessages(filter);

    logger.info(
      `[deleteNullOrEmptyConversations] Deleted ${result.deletedCount} conversations and ${messageDeleteResult.deletedCount} messages`,
    );

    return {
      conversations: result,
      messages: messageDeleteResult,
    };
  } catch (error) {
    logger.error('[deleteNullOrEmptyConversations] Error deleting conversations', error);
    throw new Error('Error deleting conversations with null or empty conversationId');
  }
};

/**
 * Searches for a conversation by conversationId and returns associated file ids.
 * @param {string} conversationId - The conversation's ID.
 * @returns {Promise<string[] | null>}
 */
const getConvoFiles = async (conversationId) => {
  try {
    return (await Conversation.findOne({ conversationId }, 'files').lean())?.files ?? [];
  } catch (error) {
    logger.error('[getConvoFiles] Error getting conversation files', error);
    throw new Error('Error getting conversation files');
  }
};

module.exports = {
  getConvoFiles,
  searchConversation,
  deleteNullOrEmptyConversations,
  /**
   * Saves a conversation to the database.
   * @param {Object} req - The request object.
   * @param {string} conversationId - The conversation's ID.
   * @param {Object} metadata - Additional metadata to log for operation.
   * @returns {Promise<TConversation>} The conversation object.
   */
  saveConvo: async (req, { conversationId, newConversationId, ...convo }, metadata) => {
    try {
      if (metadata?.context) {
        logger.debug(`[saveConvo] ${metadata.context}`);
      }

      const candidateConversationIds = [conversationId, newConversationId].filter(Boolean);
      let existingConversation = null;

      if (candidateConversationIds.length > 0) {
        existingConversation = await Conversation.findOne({
          conversationId: { $in: candidateConversationIds },
          user: req.user.id,
        }).lean();
      }

      const persistedConversationId = existingConversation?.conversationId ?? null;
      const sourceConversationId = persistedConversationId ?? conversationId ?? null;
      const targetConversationId = newConversationId ?? sourceConversationId ?? null;

      if (!targetConversationId) {
        logger.error('[saveConvo] Missing conversationId for save operation', {
          conversationId,
          newConversationId,
          existingConversationId: existingConversation?.conversationId,
          userId: req?.user?.id,
          context: metadata?.context,
        });
        return existingConversation ?? null;
      }

      const messageConversationId =
        conversationId && conversationId !== persistedConversationId
          ? conversationId
          : sourceConversationId ?? newConversationId ?? null;

      const messages = messageConversationId
        ? await getMessages({ conversationId: messageConversationId }, '_id')
        : [];

      const shouldRunComposer = shouldApplyMetaPrompt(convo, metadata);
      const now = new Date();

      let defaultPrefix =
        existingConversation?.promptPrefixDefault ??
        existingConversation?.promptPrefix ??
        convo.promptPrefix ??
        req?.body?.promptPrefix ??
        null;

      let promptPrefixCurrent =
        convo.promptPrefix ??
        existingConversation?.promptPrefixCurrent ??
        existingConversation?.promptPrefix ??
        defaultPrefix ??
        null;

      let promptPrefixHistory = Array.isArray(existingConversation?.promptPrefixHistory)
        ? [...existingConversation.promptPrefixHistory]
        : [];

      let guardrailState = existingConversation?.promptGuardrailState ?? undefined;
      let composerResult;

      if (!existingConversation && defaultPrefix != null) {
        promptPrefixHistory = [createInitialHistoryEntry(defaultPrefix, now)];
        guardrailState = updateGuardrailState(undefined, guardrailStatusMap.ACCEPTED, {});
        promptPrefixCurrent = defaultPrefix;
      }

      if (shouldRunComposer) {
        try {
          const recentMessages = await Message.find({
            conversationId: messageConversationId,
            user: req.user.id,
          })
            .sort({ createdAt: -1 })
            .limit(6)
            .lean();

          const userMessageCount = recentMessages.filter(
            (message) => message?.isCreatedByUser,
          ).length;

          if (userMessageCount > 0) {
            const orderedMessages = recentMessages.reverse();
            const composerInput = {
              conversation: {
                conversationId: targetConversationId,
                defaultPrefix: defaultPrefix ?? undefined,
                currentPrefix: promptPrefixCurrent ?? undefined,
                tags: Array.isArray(convo.tags) ? convo.tags : existingConversation?.tags,
                tools: Array.isArray(convo.tools) ? convo.tools : existingConversation?.tools,
                reasoningSummary:
                  convo.reasoning_summary ?? existingConversation?.reasoning_summary ?? undefined,
                guardrailState: guardrailState ?? undefined,
              },
              messages: toComposerMessages(orderedMessages),
            };

            composerResult = composeMetaPrompt(composerInput);

            const previousPromptPrefix = promptPrefixCurrent ?? null;
            const nextPromptPrefix = composerResult.promptPrefix ?? previousPromptPrefix;

            promptPrefixCurrent = nextPromptPrefix;
            guardrailState = updateGuardrailState(
              guardrailState,
              composerResult.guardrailStatus,
              composerResult.diagnostics,
            );

            const revision =
              (promptPrefixHistory[promptPrefixHistory.length - 1]?.revision ?? 0) + 1;

            const shouldRecordHistory =
              composerResult.guardrailStatus !== guardrailStatusMap.ACCEPTED ||
              (Array.isArray(composerResult.diagnostics?.appliedRules) &&
                composerResult.diagnostics.appliedRules.length > 0);

            if (shouldRecordHistory) {
              const historyEntry = {
                revision,
                promptPrefix: promptPrefixCurrent ?? '',
                updatedAt: now,
                source:
                  composerResult.guardrailStatus === guardrailStatusMap.ROLLED_BACK
                    ? 'rollback'
                    : 'meta-injector',
                diagnostics: { ...composerResult.diagnostics, revision },
                guardrailStatus: composerResult.guardrailStatus,
              };

              promptPrefixHistory = [...promptPrefixHistory, historyEntry];
              if (promptPrefixHistory.length > MAX_HISTORY_LENGTH) {
                promptPrefixHistory = promptPrefixHistory.slice(-MAX_HISTORY_LENGTH);
              }

              logger.info('[saveConvo] meta prompt update', {
                conversationId: targetConversationId,
                revision,
                guardrailStatus: composerResult.guardrailStatus,
                appliedRules: composerResult.diagnostics?.appliedRules ?? [],
                diff: composerResult.diagnostics?.diff,
                promptPrefixPrevious: sanitizePromptPrefixForLog(previousPromptPrefix),
                promptPrefixCurrent: sanitizePromptPrefixForLog(nextPromptPrefix),
              });
            }
          }
        } catch (error) {
          logger.error('[saveConvo] Error applying meta prompt injector', error);
        }
      }

      const update = {
        ...convo,
        messages,
        user: req.user.id,
        conversationId: targetConversationId,
      };

      if (defaultPrefix != null) {
        update.promptPrefixDefault = defaultPrefix;
      }

      if (promptPrefixCurrent != null) {
        update.promptPrefix = promptPrefixCurrent;
        update.promptPrefixCurrent = promptPrefixCurrent;
      }

      if (promptPrefixHistory?.length) {
        update.promptPrefixHistory = promptPrefixHistory;
      }

      if (guardrailState && Object.keys(guardrailState).length > 0) {
        update.promptGuardrailState = guardrailState;
      }

      if (req?.body?.isTemporary) {
        try {
          const appConfig = req.config;
          update.expiredAt = createTempChatExpirationDate(appConfig?.interfaceConfig);
        } catch (err) {
          logger.error('Error creating temporary chat expiration date:', err);
          logger.info(`---\`saveConvo\` context: ${metadata?.context}`);
          update.expiredAt = null;
        }
      } else {
        update.expiredAt = null;
      }

      /** @type {{ $set: Partial<TConversation>; $unset?: Record<keyof TConversation, number> }} */
      const updateOperation = { $set: update };
      if (metadata && metadata.unsetFields && Object.keys(metadata.unsetFields).length > 0) {
        const unsetFields = { ...metadata.unsetFields };

        for (const key of Object.keys(update)) {
          if (key in unsetFields) {
            delete unsetFields[key];
          }
        }

        if (Object.keys(unsetFields).length > 0) {
          updateOperation.$unset = unsetFields;
        }
      }

      /** Note: the resulting Model object is necessary for Meilisearch operations */
      const filterConversationId = sourceConversationId ?? targetConversationId;

      const conversation = await Conversation.findOneAndUpdate(
        { conversationId: filterConversationId, user: req.user.id },
        updateOperation,
        {
          new: true,
          upsert: true,
        },
      );

      return conversation.toObject();
    } catch (error) {
      logger.error('[saveConvo] Error saving conversation', error);
      if (metadata && metadata?.context) {
        logger.info(`[saveConvo] ${metadata.context}`);
      }
      return { message: 'Error saving conversation' };
    }
  },
  bulkSaveConvos: async (conversations) => {
    try {
      const bulkOps = conversations.map((convo) => ({
        updateOne: {
          filter: { conversationId: convo.conversationId, user: convo.user },
          update: convo,
          upsert: true,
          timestamps: false,
        },
      }));

      const result = await Conversation.bulkWrite(bulkOps);
      return result;
    } catch (error) {
      logger.error('[saveBulkConversations] Error saving conversations in bulk', error);
      throw new Error('Failed to save conversations in bulk.');
    }
  },
  getConvosByCursor: async (
    user,
    { cursor, limit = 25, isArchived = false, tags, search, order = 'desc' } = {},
  ) => {
    const filters = [{ user }];
    if (isArchived) {
      filters.push({ isArchived: true });
    } else {
      filters.push({ $or: [{ isArchived: false }, { isArchived: { $exists: false } }] });
    }

    if (Array.isArray(tags) && tags.length > 0) {
      filters.push({ tags: { $in: tags } });
    }

    filters.push({ $or: [{ expiredAt: null }, { expiredAt: { $exists: false } }] });

    if (search) {
      try {
        const meiliResults = await Conversation.meiliSearch(search, { filter: `user = "${user}"` });
        const matchingIds = Array.isArray(meiliResults.hits)
          ? meiliResults.hits.map((result) => result.conversationId)
          : [];
        if (!matchingIds.length) {
          return { conversations: [], nextCursor: null };
        }
        filters.push({ conversationId: { $in: matchingIds } });
      } catch (error) {
        logger.error('[getConvosByCursor] Error during meiliSearch', error);
        return { message: 'Error during meiliSearch' };
      }
    }

    if (cursor) {
      filters.push({ updatedAt: { $lt: new Date(cursor) } });
    }

    const query = filters.length === 1 ? filters[0] : { $and: filters };

    try {
      const convos = await Conversation.find(query)
        .select(
          'conversationId endpoint title createdAt updatedAt user model agent_id assistant_id spec iconURL',
        )
        .sort({ updatedAt: order === 'asc' ? 1 : -1 })
        .limit(limit + 1)
        .lean();

      let nextCursor = null;
      if (convos.length > limit) {
        const lastConvo = convos.pop();
        nextCursor = lastConvo.updatedAt.toISOString();
      }

      return { conversations: convos, nextCursor };
    } catch (error) {
      logger.error('[getConvosByCursor] Error getting conversations', error);
      return { message: 'Error getting conversations' };
    }
  },
  getConvosQueried: async (user, convoIds, cursor = null, limit = 25) => {
    try {
      if (!convoIds?.length) {
        return { conversations: [], nextCursor: null, convoMap: {} };
      }

      const conversationIds = convoIds.map((convo) => convo.conversationId);

      const results = await Conversation.find({
        user,
        conversationId: { $in: conversationIds },
        $or: [{ expiredAt: { $exists: false } }, { expiredAt: null }],
      }).lean();

      results.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

      let filtered = results;
      if (cursor && cursor !== 'start') {
        const cursorDate = new Date(cursor);
        filtered = results.filter((convo) => new Date(convo.updatedAt) < cursorDate);
      }

      const limited = filtered.slice(0, limit + 1);
      let nextCursor = null;
      if (limited.length > limit) {
        const lastConvo = limited.pop();
        nextCursor = lastConvo.updatedAt.toISOString();
      }

      const convoMap = {};
      limited.forEach((convo) => {
        convoMap[convo.conversationId] = convo;
      });

      return { conversations: limited, nextCursor, convoMap };
    } catch (error) {
      logger.error('[getConvosQueried] Error getting conversations', error);
      return { message: 'Error fetching conversations' };
    }
  },
  getConvo,
  /* chore: this method is not properly error handled */
  getConvoTitle: async (user, conversationId) => {
    try {
      const convo = await getConvo(user, conversationId);
      /* ChatGPT Browser was triggering error here due to convo being saved later */
      if (convo && !convo.title) {
        return null;
      } else {
        // TypeError: Cannot read properties of null (reading 'title')
        return convo?.title || 'New Chat';
      }
    } catch (error) {
      logger.error('[getConvoTitle] Error getting conversation title', error);
      return { message: 'Error getting conversation title' };
    }
  },
  /**
   * Asynchronously deletes conversations and associated messages for a given user and filter.
   *
   * @async
   * @function
   * @param {string|ObjectId} user - The user's ID.
   * @param {Object} filter - Additional filter criteria for the conversations to be deleted.
   * @returns {Promise<{ n: number, ok: number, deletedCount: number, messages: { n: number, ok: number, deletedCount: number } }>}
   *          An object containing the count of deleted conversations and associated messages.
   * @throws {Error} Throws an error if there's an issue with the database operations.
   *
   * @example
   * const user = 'someUserId';
   * const filter = { someField: 'someValue' };
   * const result = await deleteConvos(user, filter);
   * logger.error(result); // { n: 5, ok: 1, deletedCount: 5, messages: { n: 10, ok: 1, deletedCount: 10 } }
   */
  deleteConvos: async (user, filter) => {
    try {
      const userFilter = { ...filter, user };
      const conversations = await Conversation.find(userFilter).select('conversationId');
      const conversationIds = conversations.map((c) => c.conversationId);

      if (!conversationIds.length) {
        throw new Error('Conversation not found or already deleted.');
      }

      const deleteConvoResult = await Conversation.deleteMany(userFilter);

      const deleteMessagesResult = await deleteMessages({
        conversationId: { $in: conversationIds },
      });

      return { ...deleteConvoResult, messages: deleteMessagesResult };
    } catch (error) {
      logger.error('[deleteConvos] Error deleting conversations and messages', error);
      throw error;
    }
  },
};
