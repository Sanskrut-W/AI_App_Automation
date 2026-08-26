import { TestReport } from '../../dto/TestReport';

export interface IHtmlReportRenderer {
  /** Renders a complete, self-contained HTML document. reportDir is used only to compute relative screenshot links. */
  render(report: TestReport, reportDir: string): string;
}
