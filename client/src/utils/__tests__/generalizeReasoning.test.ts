import generalizeReasoning from '../generalizeReasoning';

describe('generalizeReasoning', () => {
  it('returns general statements for typical reasoning content', () => {
    const summary = generalizeReasoning(
      `The user is asking about deployment strategies. I should consider the context and outline
       an approach before drafting the final answer.`,
    );

    expect(summary).toContain("Clarifying the user's intent and goals.");
    expect(summary).toContain('Mapping out the structure of the forthcoming answer.');
    expect(summary).toContain('Preparing to articulate the final response clearly.');
    expect(summary.every((statement) => !/deployment strategies/i.test(statement))).toBe(true);
  });

  it('captures structural hints like ordered steps', () => {
    const summary = generalizeReasoning('Step 1: Gather data.\nStep 2: Compare options.');

    expect(summary).toContain('Organizing the approach into structured steps.');
  });

  it('always returns at least one high-level statement when reasoning exists', () => {
    const summary = generalizeReasoning('Reasoning');

    expect(summary.length).toBeGreaterThan(0);
    expect(summary[0]).toBe('Internally reflecting on the request before responding.');
  });
});
