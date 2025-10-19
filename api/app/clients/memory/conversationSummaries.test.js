jest.mock(
  '@librechat/data-schemas',
  () => ({
    logger: {
      error: jest.fn(),
      debug: jest.fn(),
    },
  }),
  { virtual: true },
);

jest.mock('~/models', () => ({
  setMemory: jest.fn(),
  getAllUserMemories: jest.fn(),
}));

const { ConversationSummaryManager } = require('./conversationSummaries');
const { setMemory, getAllUserMemories } = require('~/models');

const baseReq = {
  config: { memory: { disabled: false, summaryCadence: 3, charLimit: 2000 } },
  user: { id: 'user-1', personalization: { memories: true } },
};

describe('ConversationSummaryManager', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    getAllUserMemories.mockResolvedValue([]);
  });

  it('skips persistence when memories are disabled or user missing', async () => {
    const disabledManager = new ConversationSummaryManager({
      req: { config: { memory: { disabled: true } }, user: { id: 'user-1' } },
      conversationId: 'abc',
    });

    await disabledManager.persistSummary({
      conversationId: 'abc',
      summary: 'Hello',
      tokenCount: 4,
    });
    expect(setMemory).not.toHaveBeenCalled();

    const noUserManager = new ConversationSummaryManager({
      req: { config: { memory: { disabled: false } } },
      conversationId: 'abc',
    });

    await noUserManager.persistSummary({
      conversationId: 'abc',
      summary: 'Hello',
      tokenCount: 4,
    });
    expect(setMemory).not.toHaveBeenCalled();
  });

  it('persists summaries according to cadence and sanitizes keys', async () => {
    const manager = new ConversationSummaryManager({
      req: baseReq,
      conversationId: 'Sample-Convo',
    });

    getAllUserMemories.mockResolvedValueOnce([]);
    await manager.persistSummary({
      conversationId: 'Sample-Convo',
      summary: 'First snapshot',
      tokenCount: 12,
    });

    expect(setMemory).toHaveBeenCalledWith({
      userId: 'user-1',
      key: 'convo-summary-sample-convo-1',
      value: 'First snapshot',
      tokenCount: 12,
    });

    setMemory.mockClear();
    getAllUserMemories.mockResolvedValueOnce([
      { key: 'convo-summary-sample-convo-1', value: 'First snapshot', tokenCount: 12 },
    ]);
    await manager.persistSummary({
      conversationId: 'Sample-Convo',
      summary: 'Second snapshot',
      tokenCount: 10,
    });
    expect(setMemory).not.toHaveBeenCalled();

    getAllUserMemories.mockResolvedValueOnce([
      { key: 'convo-summary-sample-convo-1', value: 'First snapshot', tokenCount: 12 },
    ]);
    await manager.persistSummary({
      conversationId: 'Sample-Convo',
      summary: 'Third snapshot',
      tokenCount: 11,
    });
    expect(setMemory).toHaveBeenCalledWith({
      userId: 'user-1',
      key: 'convo-summary-sample-convo-2',
      value: 'Third snapshot',
      tokenCount: 11,
    });
  });

  it('returns the latest summary message from memory entries', async () => {
    const manager = new ConversationSummaryManager({ req: baseReq, conversationId: 'Demo' });
    getAllUserMemories.mockResolvedValueOnce([
      {
        key: 'convo-summary-demo-1',
        value: 'Earlier summary',
        tokenCount: 8,
        updated_at: new Date('2024-01-01'),
      },
      {
        key: 'convo-summary-demo-2',
        value: 'Latest summary',
        tokenCount: 14,
        updated_at: new Date('2024-02-01'),
      },
    ]);

    const entries = await manager.ensureLoaded('Demo');
    const resolvedMemories = await getAllUserMemories.mock.results[0].value;
    expect(resolvedMemories).toHaveLength(2);
    expect(entries).toHaveLength(2);
    const summaryMessage = await manager.getLatestSummaryMessage('Demo');
    expect(getAllUserMemories).toHaveBeenCalledTimes(1);
    expect(getAllUserMemories).toHaveBeenCalledWith('user-1');
    expect(manager.loadedConversationId).toBe('Demo');
    expect(manager.cachedSummaries).toHaveLength(2);
    expect(summaryMessage).toEqual({
      messageId: 'convo-summary-demo-2',
      summary: 'Latest summary',
      summaryTokenCount: 14,
      tokenCount: 14,
    });
  });

  it('resets cadence counters when switching conversations', async () => {
    const manager = new ConversationSummaryManager({ req: baseReq, conversationId: 'First' });

    getAllUserMemories.mockResolvedValueOnce([]);
    await manager.persistSummary({
      conversationId: 'First',
      summary: 'Seed snapshot',
      tokenCount: 5,
    });

    expect(manager.generatedCount).toBe(1);
    expect(manager.persistedCount).toBe(1);

    setMemory.mockClear();

    manager.setConversation('Second');
    expect(manager.generatedCount).toBe(0);
    expect(manager.persistedCount).toBe(0);
    expect(manager.lastPersistedValue).toBeNull();

    getAllUserMemories.mockResolvedValueOnce([]);
    await manager.persistSummary({
      conversationId: 'Second',
      summary: 'Intro snapshot',
      tokenCount: 3,
    });

    expect(setMemory).toHaveBeenCalledWith({
      userId: 'user-1',
      key: 'convo-summary-second-1',
      value: 'Intro snapshot',
      tokenCount: 3,
    });
    expect(manager.generatedCount).toBe(1);
    expect(manager.persistedCount).toBe(1);
  });
});
