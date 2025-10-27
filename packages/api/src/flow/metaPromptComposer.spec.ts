import { composeMetaPrompt, DEFAULT_META_PROMPT_OPTIONS } from './metaPromptComposer';
import type { MetaPromptComposerInput } from './metaPromptComposer';

describe('metaPromptComposer', () => {
  const baseConversation: MetaPromptComposerInput['conversation'] = {
    conversationId: 'convo-1',
    defaultPrefix: 'You are a helpful assistant.',
    currentPrefix: 'You are a helpful assistant.',
    tags: ['engineering'],
  };

  it('appends empathy guidance after sustained frustration', () => {
    const result = composeMetaPrompt({
      conversation: baseConversation,
      messages: [
        { role: 'user', text: 'I am frustrated this keeps breaking and it is urgent.' },
        { role: 'assistant', text: 'Let me investigate.' },
        { role: 'user', text: 'Still broken. This bug is annoying and nothing works.' },
      ],
    });

    expect(result.guardrailStatus).toBe('accepted');
    expect(result.diagnostics.appliedRules).toContain('frustration-empathy');
    expect(result.promptPrefix).toContain(DEFAULT_META_PROMPT_OPTIONS.empathyAppendix);
  });

  it('escalates to crisis override when safety keywords appear', () => {
    const result = composeMetaPrompt({
      conversation: baseConversation,
      messages: [{ role: 'user', text: 'I feel like committing suicide if this does not stop.' }],
    });

    expect(result.guardrailStatus).toBe('accepted');
    expect(result.diagnostics.appliedRules).toContain('safety-escalation');
    expect(result.promptPrefix).toBe(DEFAULT_META_PROMPT_OPTIONS.crisisOverridePrefix);
  });

  it('rolls back changes when guardrails reject the proposal', () => {
    const result = composeMetaPrompt({
      conversation: baseConversation,
      messages: [
        { role: 'user', text: 'This broken workflow is infuriating and urgent.' },
        { role: 'assistant', text: 'I understand.' },
        { role: 'user', text: 'Nothing works. This issue is still broken and annoying.' },
      ],
      options: {
        maxDiffRatio: 0.05,
        forbiddenPhrases: ["acknowledge the user's frustration"],
      },
    });

    expect(result.guardrailStatus).toBe('rolled_back');
    expect(result.promptPrefix).toBe(baseConversation.currentPrefix);
    expect(result.diagnostics.guardrailReasons).toEqual(
      expect.arrayContaining(['diff_ratio_exceeded', "forbidden:acknowledge the user's frustration"]),
    );
  });
});
