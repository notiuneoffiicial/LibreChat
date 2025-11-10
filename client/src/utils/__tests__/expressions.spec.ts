import { evaluateBooleanExpression } from '../expressions';

describe('evaluateBooleanExpression', () => {
  const baseContext = {
    speechToText: true,
    advancedMode: false,
    engineSTT: 'realtime',
    engineTTS: 'external',
  };

  it('returns false when expression is undefined', () => {
    expect(evaluateBooleanExpression(undefined, baseContext)).toBe(false);
  });

  it('evaluates simple boolean expressions', () => {
    expect(evaluateBooleanExpression('speechToText && !advancedMode', baseContext)).toBe(true);
    expect(evaluateBooleanExpression('speechToText && advancedMode', baseContext)).toBe(false);
  });

  it('supports equality comparisons with strings', () => {
    expect(evaluateBooleanExpression("engineSTT === 'realtime'", baseContext)).toBe(true);
    expect(evaluateBooleanExpression('engineTTS === "realtime"', baseContext)).toBe(false);
  });

  it('rejects expressions with unsupported characters', () => {
    expect(evaluateBooleanExpression('speechToText; console.log(1)', baseContext)).toBe(false);
  });

  it('rejects expressions that attempt assignment', () => {
    expect(evaluateBooleanExpression('speechToText = false', baseContext)).toBe(false);
  });

  it('returns false when evaluation fails', () => {
    expect(evaluateBooleanExpression('unknownVariable', baseContext)).toBe(false);
  });
});
