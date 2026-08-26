import { TestCaseResult } from './TestCaseResult';

export interface TestExecutionSummary {
  totalTestCases: number;
  passed: number;
  failed: number;
  results: TestCaseResult[];
}
