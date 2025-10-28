jest.mock('@librechat/agents', () => ({
  Run: {
    create: jest.fn(),
  },
  Providers: {
    OPENAI: 'openai',
    AZURE: 'azure',
    GOOGLE: 'google',
    ANTHROPIC: 'anthropic',
    BEDROCK: 'bedrock',
    OLLAMA: 'ollama',
    XAI: 'xai',
    DEEPSEEK: 'deepseek',
    OPENROUTER: 'openrouter',
  },
}));

jest.mock('librechat-data-provider', () => ({
  providerEndpointMap: {},
  KnownEndpoints: {
    openrouter: 'openrouter.ai',
  },
}));

import { Run, Providers } from '@librechat/agents';
import type { Agent } from 'librechat-data-provider';
import { createRun } from '../run';

describe('createRun provider configuration normalization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('normalizes Deepseek base URLs to include /v1', async () => {
    const controller = new AbortController();
    const agent = {
      id: 'agent-deepseek',
      name: 'Deepseek Agent',
      description: null,
      created_at: Date.now(),
      avatar: null,
      instructions: null,
      additional_instructions: null,
      provider: Providers.DEEPSEEK,
      endpoint: Providers.DEEPSEEK,
      model: 'deepseek-chat',
      model_parameters: {
        temperature: 0,
        maxContextTokens: null,
        max_context_tokens: null,
        max_output_tokens: null,
        top_p: null,
        frequency_penalty: null,
        presence_penalty: null,
        configuration: {
          baseURL: 'https://api.deepseek.com',
        },
      },
    } as unknown as Agent;

    (Run.create as jest.Mock).mockResolvedValue({ runId: 'test-run' });

    await createRun({
      agent,
      signal: controller.signal,
      streaming: true,
      streamUsage: true,
    });

    expect(Run.create).toHaveBeenCalledTimes(1);
    const runCall = (Run.create as jest.Mock).mock.calls[0][0];
    expect(runCall.graphConfig.llmConfig.configuration.baseURL).toBe(
      'https://api.deepseek.com/v1',
    );
  });
});
