const fs = require('fs');
const os = require('os');
const path = require('path');

jest.mock(
  '@librechat/data-schemas',
  () => ({
    logger: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    },
  }),
  { virtual: true },
);

describe('autoRouterConfig', () => {
  const originalEnv = process.env.AUTO_ROUTER_KEYWORD_CONFIG;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.AUTO_ROUTER_KEYWORD_CONFIG;
    } else {
      process.env.AUTO_ROUTER_KEYWORD_CONFIG = originalEnv;
    }
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('falls back to the default config when the JSON cannot be parsed', () => {
    const tempPath = path.join(os.tmpdir(), `invalid-auto-router-${Date.now()}.json`);
    fs.writeFileSync(tempPath, '{ invalid json');
    process.env.AUTO_ROUTER_KEYWORD_CONFIG = tempPath;

    const calls = [];

    jest.isolateModules(() => {
      const { getKeywordConfig, __resetKeywordConfigCache } = require('../autoRouterConfig');
      const { logger } = require('@librechat/data-schemas');
      __resetKeywordConfigCache();
      const config = getKeywordConfig();
      expect(config.keywordGroups.length).toBeGreaterThan(0);
      calls.push(...logger.warn.mock.calls);
    });

    expect(
      calls.some(
        ([message, meta]) =>
          typeof message === 'string' &&
          message.includes('Failed to load keyword configuration') &&
          meta?.path === tempPath,
      ),
    ).toBe(true);

    fs.unlinkSync(tempPath);
  });

  it('rejects unsupported pattern types and uses defaults', () => {
    const tempPath = path.join(os.tmpdir(), `unsupported-auto-router-${Date.now()}.json`);
    const invalidConfig = {
      defaultPatternWeight: 0.08,
      keywordGroups: [
        {
          intent: 'test',
          baseIntensity: 0.5,
          maxBoost: 0.3,
          patterns: [
            {
              type: 'unknown',
              pattern: 'test',
            },
          ],
        },
      ],
      quickIntent: {
        intensity: 0.5,
        tokenBudgetThreshold: 100,
        patterns: [{ pattern: 'quick' }],
      },
      detailIntent: {
        intensity: 0.5,
        tokenBudgetThreshold: 100,
        patterns: [{ pattern: 'detail' }],
      },
      supportIntent: {
        intensity: 0.5,
        tokenBudgetThreshold: 100,
        patterns: [{ pattern: 'support' }],
      },
    };
    fs.writeFileSync(tempPath, JSON.stringify(invalidConfig));
    process.env.AUTO_ROUTER_KEYWORD_CONFIG = tempPath;

    const calls = [];

    jest.isolateModules(() => {
      const { getKeywordConfig, __resetKeywordConfigCache } = require('../autoRouterConfig');
      const { logger } = require('@librechat/data-schemas');
      __resetKeywordConfigCache();
      const config = getKeywordConfig();
      expect(config.keywordGroups.length).toBeGreaterThan(0);
      calls.push(...logger.warn.mock.calls);
    });

    expect(
      calls.some(
        ([message, meta]) =>
          typeof message === 'string' &&
          message.includes('Failed to load keyword configuration') &&
          meta?.path === tempPath,
      ),
    ).toBe(true);

    fs.unlinkSync(tempPath);
  });
});
