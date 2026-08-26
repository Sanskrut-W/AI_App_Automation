import { TestExecutionSummary } from './TestExecutionSummary';
import { ReportGenerationResult } from './ReportGenerationResult';
import { TestModule } from '../../shared/paths/TestModules';

export interface ExecuteStoredSuiteResult {
  deviceId: string;
  packageName: string;
  module: TestModule;
  /** Root folder holding every artifact for this app (artifacts/apps/<packageName>/). */
  appDataRoot: string;
  executionSummary: TestExecutionSummary;
  /** Null only if report generation itself failed — execution still succeeded. */
  reportPaths: ReportGenerationResult | null;
}
