import { TestCaseStatus } from '../../core/enums/TestCaseStatus';
import { StepResult } from './StepResult';

export interface TestCaseResult {
  testCaseId: string;
  screenId: string;
  title: string;
  status: TestCaseStatus;
  durationMs: number;
  stepResults: StepResult[];
}
