const { evaluateBooleanExpression } = require('../evaluateBooleanExpression');

describe('evaluateBooleanExpression', () => {
  it('returns true for matching user role condition', () => {
    const result = evaluateBooleanExpression('{{ user.role === "admin" }}', {
      user: { role: 'admin' },
    });

    expect(result).toBe(true);
  });

  it('returns false when user condition fails', () => {
    const result = evaluateBooleanExpression('{{ user.role === "admin" }}', {
      user: { role: 'user' },
    });

    expect(result).toBe(false);
  });

  it('supports expressions referencing ui context', () => {
    const result = evaluateBooleanExpression('ui.disableRealtime === true', {
      ui: { disableRealtime: true },
    });

    expect(result).toBe(true);
  });

  it('coerces string results to booleans', () => {
    const result = evaluateBooleanExpression('"false"', {});

    expect(result).toBe(false);
  });

  it('throws for expressions with unsupported characters', () => {
    expect(() =>
      evaluateBooleanExpression('user.role === "admin"; process.exit()', {
        user: { role: 'admin' },
      }),
    ).toThrow('Expression contains unsupported characters');
  });
});
