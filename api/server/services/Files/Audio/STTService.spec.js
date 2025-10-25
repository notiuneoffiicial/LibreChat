jest.mock(
  '@librechat/data-schemas',
  () => ({
    logger: {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
    },
  }),
  { virtual: true },
);
jest.mock(
  '@librechat/api',
  () => ({
    genAzureEndpoint: jest.fn(() => 'https://azure-openai.example.com'),
  }),
  { virtual: true },
);
jest.mock(
  'librechat-data-provider',
  () => ({
    STTProviders: {
      OPENAI: 'openai',
      AZURE_OPENAI: 'azureOpenAI',
      REALTIME: 'realtime',
    },
    extractEnvVariable: jest.fn((value) => value),
  }),
  { virtual: true },
);
jest.mock('~/server/services/Config', () => ({
  getAppConfig: jest.fn(),
}));

const { STTService } = require('./STTService');
const { getAppConfig } = require('~/server/services/Config');
const { STTProviders } = require('librechat-data-provider');

describe('STTService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getProviderSchema', () => {
    it('ignores realtime schema when selecting classic providers', async () => {
      getAppConfig.mockResolvedValue({
        speech: {
          stt: {
            [STTProviders.OPENAI]: { model: 'whisper-1' },
            [STTProviders.REALTIME]: { model: 'gpt-4o-realtime-preview' },
          },
        },
      });

      const service = await STTService.getInstance();
      const [provider, schema] = await service.getProviderSchema({ user: { role: 'user' } });

      expect(getAppConfig).toHaveBeenCalledWith({ role: 'user' });
      expect(provider).toBe(STTProviders.OPENAI);
      expect(schema).toEqual({ model: 'whisper-1' });
    });

    it('throws when multiple classic providers are configured', async () => {
      getAppConfig.mockResolvedValue({
        speech: {
          stt: {
            [STTProviders.OPENAI]: { model: 'whisper-1' },
            [STTProviders.AZURE_OPENAI]: { model: 'whisper-azure' },
          },
        },
      });

      const service = await STTService.getInstance();

      await expect(
        service.getProviderSchema({ user: { role: 'user' } }),
      ).rejects.toThrow('Multiple providers are set. Please set only one provider.');
    });
  });
});
