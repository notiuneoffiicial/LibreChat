const GoogleClient = require('../GoogleClient');

describe('GoogleClient getMessageMapMethod', () => {
  it('extracts reasoning entries from content parts', () => {
    const client = new GoogleClient({}, { skipSetOptions: true });
    const message = {
      role: 'assistant',
      content: [
        { type: 'think', think: { value: ' Primary thought ' } },
        { type: 'text', text: { value: 'Rendered answer' } },
        { type: 'think', think: 'Secondary thought' },
      ],
    };

    const mapMessage = client.getMessageMapMethod();
    const result = mapMessage(message);

    expect(result.text).toBe('Rendered answer');
    expect(result.reasoning).toBe('Primary thought\n\nSecondary thought');
    expect(result.content).toBeUndefined();
  });
});
