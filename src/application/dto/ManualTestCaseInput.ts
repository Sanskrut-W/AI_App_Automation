export interface ManualTestCaseStepInput {
  stepNumber: number;
  description: string;
  expectedResult: string;
}

/** One manually-authored test case, parsed from an external source (currently an Excel sheet —
 * see IManualTestCaseSource) — a human-written scenario in free-text steps, as opposed to the
 * other three generators, which derive test cases purely from what the crawler discovered. */
export interface ManualTestCaseInput {
  testCaseName: string;
  objective: string;
  steps: ManualTestCaseStepInput[];
}
