import { CrawlSummary } from './CrawlSummary';
import { TestExecutionSummary } from './TestExecutionSummary';
import { ReportGenerationResult } from './ReportGenerationResult';

export interface PipelineResult {
  deviceId: string;
  application: {
    packageName: string;
    versionName: string;
    appLabel: string;
  };
  crawlSummary: CrawlSummary;
  /** Screens for which AI analysis succeeded; 0 if no Gemini client was configured for this run. */
  screensAnalyzed: number;
  /** Newly generated in this run only — screens that already had test cases from a prior run are skipped. */
  testCasesGenerated: number;
  /** Root folder holding every artifact for this app (artifacts/apps/<packageName>/). */
  appDataRoot: string;
  /** Reflects the full stored suite for this app (old + newly generated), not just this run's new test cases. */
  executionSummary: TestExecutionSummary;
  /** Null only if report generation itself failed — the rest of the run still succeeded. */
  reportPaths: ReportGenerationResult | null;
}
