import { TestExecutionSummary } from './TestExecutionSummary';
import { NavigationGraph } from './NavigationGraph';

/** The full, self-contained payload behind both the JSON and HTML reports. */
export interface TestReport {
  generatedAt: string;
  summary: TestExecutionSummary;
  /** Null when no navigation-graph artifact was found (e.g. the crawler was never run). */
  navigationGraph: NavigationGraph | null;
}
