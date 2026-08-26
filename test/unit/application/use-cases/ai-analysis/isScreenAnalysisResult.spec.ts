import { isScreenAnalysisResult } from '../../../../../src/application/use-cases/ai-analysis/isScreenAnalysisResult';

const VALID_RESULT = {
  screenName: 'Home',
  screenPurpose: 'Lets the user perform a calculation.',
  navigationOptions: ['Settings', 'History'],
  importantElements: ['Calculate button', 'Result display'],
  suggestedTestAreas: ['Input validation', 'Division by zero'],
};

describe('isScreenAnalysisResult', () => {
  it('accepts a fully valid result', () => {
    expect(isScreenAnalysisResult(VALID_RESULT)).toBe(true);
  });

  it('accepts empty arrays for the list fields', () => {
    expect(
      isScreenAnalysisResult({
        ...VALID_RESULT,
        navigationOptions: [],
        importantElements: [],
        suggestedTestAreas: [],
      }),
    ).toBe(true);
  });

  it('rejects null and non-object values', () => {
    expect(isScreenAnalysisResult(null)).toBe(false);
    expect(isScreenAnalysisResult(undefined)).toBe(false);
    expect(isScreenAnalysisResult('a plain string response')).toBe(false);
    expect(isScreenAnalysisResult(42)).toBe(false);
  });

  it('rejects a missing screenName', () => {
    const { screenName: _omit, ...rest } = VALID_RESULT;
    expect(isScreenAnalysisResult(rest)).toBe(false);
  });

  it('rejects an empty screenName', () => {
    expect(isScreenAnalysisResult({ ...VALID_RESULT, screenName: '' })).toBe(false);
  });

  it('rejects a missing screenPurpose', () => {
    const { screenPurpose: _omit, ...rest } = VALID_RESULT;
    expect(isScreenAnalysisResult(rest)).toBe(false);
  });

  it('rejects navigationOptions that is not an array', () => {
    expect(
      isScreenAnalysisResult({ ...VALID_RESULT, navigationOptions: 'Settings, History' }),
    ).toBe(false);
  });

  it('rejects an array field containing non-string entries', () => {
    expect(
      isScreenAnalysisResult({ ...VALID_RESULT, importantElements: ['Calculate button', 42] }),
    ).toBe(false);
  });

  it('rejects a completely unrelated JSON shape', () => {
    expect(isScreenAnalysisResult({ message: 'Sure, this looks like a login screen.' })).toBe(
      false,
    );
  });
});
