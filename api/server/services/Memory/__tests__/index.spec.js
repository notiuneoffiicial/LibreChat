jest.mock('@librechat/data-schemas', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}), { virtual: true });

jest.mock('librechat-data-provider', () => ({
  Constants: {},
  Permissions: { USE: 'USE' },
  PermissionTypes: { MEMORIES: 'MEMORIES' },
  EModelEndpoint: { agents: 'agents' },
}), { virtual: true });

const mockCheckAccess = jest.fn();

jest.mock('@librechat/api', () => ({
  checkAccess: mockCheckAccess,
  createMemoryProcessor: jest.fn(() => [null, jest.fn(), jest.fn()]),
}), { virtual: true });

jest.mock('~/models/Role', () => ({
  getRoleByName: jest.fn(),
}), { virtual: true });

jest.mock('~/models/Agent', () => ({
  loadAgent: jest.fn(),
}), { virtual: true });

jest.mock('~/models', () => ({
  getFormattedMemories: jest.fn(),
  deleteMemory: jest.fn(),
  setMemory: jest.fn(),
}), { virtual: true });

const { logger } = require('@librechat/data-schemas');
const { initializeMemoryContext } = require('..');
const { checkAccess } = require('@librechat/api');

describe('initializeMemoryContext logging', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCheckAccess.mockReset();
  });

  const baseParams = () => ({
    req: {
      user: { id: 'user-1', personalization: {} },
      config: {},
    },
    res: {},
    conversationId: 'convo-1',
    messageId: 'msg-1',
  });

  it('logs when user has disabled memories', async () => {
    const params = baseParams();
    params.req.user.personalization.memories = false;

    const result = await initializeMemoryContext(params);

    expect(result).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(
      '[Memory] Skipping initialization: user personalization memories disabled',
    );
    expect(checkAccess).not.toHaveBeenCalled();
  });

  it('logs when user lacks MEMORIES.USE permission', async () => {
    mockCheckAccess.mockResolvedValue(false);
    const params = baseParams();

    const result = await initializeMemoryContext(params);

    expect(result).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(
      '[Memory] Skipping initialization: user lacks MEMORIES.USE permission',
    );
  });
});
