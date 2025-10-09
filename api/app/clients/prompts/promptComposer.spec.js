const composePrompt = require('./promptComposer');

describe('promptComposer', () => {
  test('returns empty payload when no persona or context provided', () => {
    const result = composePrompt();

    expect(result.instructions).toBe('');
    expect(result.systemContent).toBeNull();
    expect(result.userPrepend).toBeNull();
  });

  test('includes persona instructions in system content', () => {
    const result = composePrompt({ persona: 'You are OptimismAI.' });

    expect(result.instructions).toBe('You are OptimismAI.');
    expect(result.systemContent).toBe('Instructions:\nYou are OptimismAI.');
    expect(result.userPrepend).toBeNull();
  });

  test('concatenates context sections ahead of persona', () => {
    const contextSections = [
      { id: 'files', content: 'Context block.' },
    ];

    const result = composePrompt({
      persona: 'Behave politely.',
      contextSections,
    });

    expect(result.instructions).toBe('Context block.\n\nBehave politely.');
    expect(result.systemContent).toBe('Instructions:\nContext block.\n\nBehave politely.');
    expect(result.sections.context).toEqual(contextSections);
  });

  test('returns user prepend for models without system message support', () => {
    const result = composePrompt({
      persona: 'Guidance',
      contextSections: [{ content: 'Context' }],
      model: 'o1-preview',
    });

    expect(result.systemContent).toBeNull();
    expect(result.userPrepend).toBe('Instructions:\nContext\n\nGuidance');
  });
});
