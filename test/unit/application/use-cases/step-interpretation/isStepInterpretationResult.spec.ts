import { isStepInterpretationResult } from '../../../../../src/application/use-cases/step-interpretation/isStepInterpretationResult';

const VALID_RESULT = {
  applicable: true,
  reason: null,
  actions: [
    { action: 'click', candidateIndex: 2, fieldType: 'none', literalValue: null, direction: null },
  ],
  expectedResultCheck: { candidateIndex: 1, confidence: 0.8 },
};

describe('isStepInterpretationResult', () => {
  it('accepts a fully valid result', () => {
    expect(isStepInterpretationResult(VALID_RESULT)).toBe(true);
  });

  it('accepts a not-applicable result with an empty actions array', () => {
    expect(
      isStepInterpretationResult({
        applicable: false,
        reason: 'This step describes entering a website URL, which has no app equivalent.',
        actions: [],
        expectedResultCheck: null,
      }),
    ).toBe(true);
  });

  it('accepts multiple actions (a compound step split into an ordered list)', () => {
    expect(
      isStepInterpretationResult({
        ...VALID_RESULT,
        actions: [
          {
            action: 'scroll',
            candidateIndex: null,
            fieldType: 'none',
            literalValue: null,
            direction: 'down',
          },
          {
            action: 'click',
            candidateIndex: 3,
            fieldType: 'none',
            literalValue: null,
            direction: null,
          },
        ],
      }),
    ).toBe(true);
  });

  it('accepts a type action with a literal value', () => {
    expect(
      isStepInterpretationResult({
        ...VALID_RESULT,
        actions: [
          {
            action: 'type',
            candidateIndex: 0,
            fieldType: 'literal',
            literalValue: 'ABC123',
            direction: null,
          },
        ],
      }),
    ).toBe(true);
  });

  it('accepts a type action for mobileNumber/password field types', () => {
    expect(
      isStepInterpretationResult({
        ...VALID_RESULT,
        actions: [
          {
            action: 'type',
            candidateIndex: 0,
            fieldType: 'mobileNumber',
            literalValue: null,
            direction: null,
          },
        ],
      }),
    ).toBe(true);
  });

  it('rejects null and non-object values', () => {
    expect(isStepInterpretationResult(null)).toBe(false);
    expect(isStepInterpretationResult(undefined)).toBe(false);
    expect(isStepInterpretationResult('a plain string response')).toBe(false);
    expect(isStepInterpretationResult(42)).toBe(false);
  });

  it('rejects a missing applicable field', () => {
    const { applicable: _omit, ...rest } = VALID_RESULT;
    expect(isStepInterpretationResult(rest)).toBe(false);
  });

  it('rejects an invalid action type', () => {
    expect(
      isStepInterpretationResult({
        ...VALID_RESULT,
        actions: [
          {
            action: 'swipe',
            candidateIndex: 0,
            fieldType: 'none',
            literalValue: null,
            direction: null,
          },
        ],
      }),
    ).toBe(false);
  });

  it('rejects an invalid fieldType', () => {
    expect(
      isStepInterpretationResult({
        ...VALID_RESULT,
        actions: [
          {
            action: 'type',
            candidateIndex: 0,
            fieldType: 'email',
            literalValue: null,
            direction: null,
          },
        ],
      }),
    ).toBe(false);
  });

  it('rejects an invalid scroll direction', () => {
    expect(
      isStepInterpretationResult({
        ...VALID_RESULT,
        actions: [
          {
            action: 'scroll',
            candidateIndex: null,
            fieldType: 'none',
            literalValue: null,
            direction: 'sideways',
          },
        ],
      }),
    ).toBe(false);
  });

  it('rejects actions that is not an array', () => {
    expect(isStepInterpretationResult({ ...VALID_RESULT, actions: 'click' })).toBe(false);
  });

  it('accepts a null expectedResultCheck', () => {
    expect(isStepInterpretationResult({ ...VALID_RESULT, expectedResultCheck: null })).toBe(true);
  });

  it('rejects an expectedResultCheck missing confidence', () => {
    expect(
      isStepInterpretationResult({
        ...VALID_RESULT,
        expectedResultCheck: { candidateIndex: 1 },
      }),
    ).toBe(false);
  });

  it('rejects a completely unrelated JSON shape', () => {
    expect(isStepInterpretationResult({ message: 'Sure, click the login button.' })).toBe(false);
  });
});
