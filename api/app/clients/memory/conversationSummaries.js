const { logger } = require('@librechat/data-schemas');
const { setMemory, getAllUserMemories } = require('~/models');

class ConversationSummaryManager {
  constructor({ req, conversationId } = {}) {
    this.req = req;
    this.userId = req?.user?.id ?? null;
    this.memoryConfig = req?.config?.memory;
    this.personalizationEnabled = req?.user?.personalization?.memories !== false;
    this.defaultCadence = 3;
    this.summaryCadence = this.resolveSummaryCadence();
    this.charLimit = this.resolveCharLimit();
    this.conversationId = conversationId ?? null;
    this.loadedConversationId = null;
    this.cachedSummaries = [];
    this.persistedCount = 0;
    this.lastPersistedValue = null;
    this.generatedCount = 0;
  }

  resetCadenceState() {
    this.cachedSummaries = [];
    this.persistedCount = 0;
    this.generatedCount = 0;
    this.lastPersistedValue = null;
  }

  resolveSummaryCadence() {
    const cadence = Number(this.memoryConfig?.summaryCadence);
    if (Number.isInteger(cadence) && cadence >= 1) {
      return Math.min(cadence, 25);
    }
    return this.defaultCadence;
  }

  resolveCharLimit() {
    const charLimit = Number(this.memoryConfig?.charLimit);
    if (Number.isFinite(charLimit) && charLimit > 0) {
      return Math.floor(charLimit);
    }
    return 10000;
  }

  setConversation(conversationId) {
    if (!conversationId) {
      return;
    }
    const stringId = String(conversationId);
    if (this.conversationId !== stringId) {
      this.conversationId = stringId;
      this.loadedConversationId = null;
      this.resetCadenceState();
    }
  }

  get enabled() {
    if (!this.userId) {
      return false;
    }
    if (!this.memoryConfig || this.memoryConfig.disabled === true) {
      return false;
    }
    return this.personalizationEnabled !== false;
  }

  sanitizeId(value) {
    const sanitized = String(value ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^-+|-+$/g, '');
    return sanitized || 'conversation';
  }

  getKeyPrefix(conversationId) {
    const targetId = conversationId ?? this.conversationId;
    return `convo-summary-${this.sanitizeId(targetId)}`;
  }

  createKey(conversationId, index) {
    return `${this.getKeyPrefix(conversationId)}-${index}`;
  }

  extractIndex(key) {
    const match = key?.match(/-(\d+)$/);
    return match ? Number(match[1]) : undefined;
  }

  async ensureLoaded(conversationId) {
    if (!this.enabled) {
      return [];
    }

    const targetId = conversationId ?? this.conversationId;
    if (!targetId) {
      return [];
    }

    if (this.loadedConversationId && this.loadedConversationId !== targetId) {
      this.resetCadenceState();
    }

    if (this.loadedConversationId === targetId && this.cachedSummaries.length > 0) {
      return this.cachedSummaries;
    }

    try {
      const allMemories = await getAllUserMemories(this.userId);
      const prefix = this.getKeyPrefix(targetId);
      const relevant = allMemories
        .filter((entry) => {
          const key = entry.key;
          if (!key) {
            return false;
          }
          return key === prefix || key.startsWith(`${prefix}-`);
        })
        .map((entry) => ({
          ...entry,
          index: this.extractIndex(entry.key) ?? 0,
        }))
        .sort((a, b) => {
          const indexDiff = (a.index ?? 0) - (b.index ?? 0);
          if (indexDiff !== 0) {
            return indexDiff;
          }
          const aTime = a.updated_at ? new Date(a.updated_at).getTime() : 0;
          const bTime = b.updated_at ? new Date(b.updated_at).getTime() : 0;
          return aTime - bTime;
        });

      this.loadedConversationId = targetId;
      this.cachedSummaries = relevant;
      this.persistedCount = relevant.length;
      this.generatedCount = Math.max(this.generatedCount, this.persistedCount);
      this.lastPersistedValue = relevant.length > 0 ? relevant[relevant.length - 1].value : null;
      return relevant;
    } catch (error) {
      logger.error('[ConversationSummaryManager] Failed to load summaries from memory', error);
      this.loadedConversationId = targetId;
      this.resetCadenceState();
      return [];
    }
  }

  async getLatestSummaryMessage(conversationId) {
    if (!this.enabled) {
      return null;
    }

    const targetId = conversationId ?? this.conversationId;
    if (!targetId) {
      return null;
    }

    const entries = await this.ensureLoaded(targetId);
    if (!entries.length) {
      return null;
    }

    const latest = entries[entries.length - 1];
    if (typeof latest?.value !== 'string' || latest.value.trim().length === 0) {
      return null;
    }

    const content = latest.value.trim();
    const index = latest.index ?? entries.length;
    const tokenCount = latest.tokenCount ?? content.length;

    this.lastPersistedValue = content;

    return {
      messageId: this.createKey(targetId, index),
      summary: content,
      summaryTokenCount: tokenCount,
      tokenCount,
    };
  }

  shouldPersist(attemptIndex, summary) {
    if (!this.enabled) {
      return false;
    }
    if (!summary) {
      return false;
    }
    if (this.lastPersistedValue && this.lastPersistedValue === summary) {
      return false;
    }
    if (this.summaryCadence <= 1) {
      return true;
    }
    if (attemptIndex === 1) {
      return true;
    }
    return attemptIndex % this.summaryCadence === 0;
  }

  async persistSummary({ conversationId, summary, tokenCount }) {
    if (!this.enabled) {
      return;
    }

    const targetId = conversationId ?? this.conversationId;
    if (!targetId || typeof summary !== 'string') {
      return;
    }

    const trimmedSummary = summary.trim();
    if (!trimmedSummary) {
      return;
    }

    await this.ensureLoaded(targetId);
    const attemptIndex = this.generatedCount + 1;
    this.generatedCount = attemptIndex;

    if (!this.shouldPersist(attemptIndex, trimmedSummary)) {
      return;
    }

    const storageIndex = (this.persistedCount ?? 0) + 1;
    const key = this.createKey(targetId, storageIndex);
    const boundedSummary = trimmedSummary.slice(0, this.charLimit);

    try {
      await setMemory({
        userId: this.userId,
        key,
        value: boundedSummary,
        tokenCount: tokenCount ?? undefined,
      });
      this.persistedCount = storageIndex;
      this.generatedCount = Math.max(this.generatedCount, this.persistedCount);
      this.lastPersistedValue = boundedSummary;
      this.loadedConversationId = null;
    } catch (error) {
      logger.error('[ConversationSummaryManager] Failed to persist summary', error);
    }
  }
}

module.exports = { ConversationSummaryManager };
