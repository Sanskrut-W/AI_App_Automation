import { ScreenAnalysisResult } from '../../dto/ScreenAnalysisResult';

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

/** Schema validation for Gemini's screen-analysis JSON — rejects anything short of the exact expected shape. */
export function isScreenAnalysisResult(value: unknown): value is ScreenAnalysisResult {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.screenName === 'string' &&
    candidate.screenName.length > 0 &&
    typeof candidate.screenPurpose === 'string' &&
    candidate.screenPurpose.length > 0 &&
    isStringArray(candidate.navigationOptions) &&
    isStringArray(candidate.importantElements) &&
    isStringArray(candidate.suggestedTestAreas)
  );
}
