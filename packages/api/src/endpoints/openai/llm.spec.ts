import { getOpenAILLMConfig } from './llm';

describe('getOpenAILLMConfig', () => {
  const baseArgs = {
    apiKey: 'test-api-key',
    streaming: true,
  };

  it('enables Responses API for web search when supported', () => {
    const result = getOpenAILLMConfig({
      ...baseArgs,
      modelOptions: { model: 'gpt-4o-mini', web_search: true },
      useOpenRouter: false,
      supportsResponsesApi: true,
    });

    expect(result.llmConfig.useResponsesApi).toBe(true);
    expect(result.tools).toEqual([{ type: 'web_search_preview' }]);
  });

  it('omits Responses API for web search when not supported', () => {
    const result = getOpenAILLMConfig({
      ...baseArgs,
      modelOptions: { model: 'deepseek-chat', web_search: true },
      useOpenRouter: false,
      supportsResponsesApi: false,
    });

    expect(result.llmConfig.useResponsesApi).toBeUndefined();
    expect(result.tools).toEqual([{ type: 'web_search_preview' }]);
  });
});
