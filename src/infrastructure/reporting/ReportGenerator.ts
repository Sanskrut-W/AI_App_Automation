import path from 'path';
import { TestExecutionSummary } from '../../application/dto/TestExecutionSummary';
import { TestReport } from '../../application/dto/TestReport';
import { ReportGenerationResult } from '../../application/dto/ReportGenerationResult';
import { NavigationGraph } from '../../application/dto/NavigationGraph';
import { ReportGenerationError } from '../../core/errors/ReportGenerationError';
import { Result } from '../../shared/result/Result';
import { ILogger } from '../../shared/logger/ILogger';
import { IClock } from '../../shared/time/IClock';
import { IFileReader } from '../../shared/fs/IFileReader';
import { IFileWriter } from '../../shared/fs/IFileWriter';
import { IReportGenerator } from '../../application/interfaces/reporting/IReportGenerator';
import { IHtmlReportRenderer } from '../../application/use-cases/reporting/IHtmlReportRenderer';

export interface ReportGeneratorOptions {
  reportDir?: string;
  navigationGraphPath?: string;
}

const DEFAULT_REPORT_DIR = path.resolve(process.cwd(), 'artifacts', 'reports');
const DEFAULT_NAVIGATION_GRAPH_PATH = path.resolve(
  process.cwd(),
  'artifacts',
  'navigation-graph.json',
);

/**
 * Turns a completed TestExecutionSummary (Module 13) into two artifacts: a JSON report (the raw
 * TestReport payload, for programmatic consumers/CI) and a self-contained HTML report (for
 * humans). Best-effort includes Module 8's navigation graph artifact if one exists; a missing or
 * unparsable graph degrades to an explicit "not available" section rather than failing the run.
 */
export class ReportGenerator implements IReportGenerator {
  private readonly reportDir: string;
  private readonly navigationGraphPath: string;

  constructor(
    private readonly fileReader: IFileReader,
    private readonly fileWriter: IFileWriter,
    private readonly htmlRenderer: IHtmlReportRenderer,
    private readonly clock: IClock,
    private readonly logger: ILogger,
    options: ReportGeneratorOptions = {},
  ) {
    this.reportDir = options.reportDir ?? DEFAULT_REPORT_DIR;
    this.navigationGraphPath = options.navigationGraphPath ?? DEFAULT_NAVIGATION_GRAPH_PATH;
  }

  async generate(
    summary: TestExecutionSummary,
  ): Promise<Result<ReportGenerationResult, ReportGenerationError>> {
    this.logger.info('Generating test execution report', {
      totalTestCases: summary.totalTestCases,
      passed: summary.passed,
      failed: summary.failed,
    });

    try {
      const navigationGraph = await this.loadNavigationGraph();
      const report: TestReport = {
        generatedAt: this.clock.now(),
        summary,
        navigationGraph,
      };

      const timestamp = this.clock.nowMs();
      const jsonReportPath = path.join(this.reportDir, `report-${timestamp}.json`);
      const htmlReportPath = path.join(this.reportDir, `report-${timestamp}.html`);

      await this.fileWriter.write(jsonReportPath, JSON.stringify(report, null, 2));
      await this.fileWriter.write(htmlReportPath, this.htmlRenderer.render(report, this.reportDir));

      this.logger.info('Test execution report generated', { jsonReportPath, htmlReportPath });
      return Result.ok({ htmlReportPath, jsonReportPath });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Report generation failed', error instanceof Error ? error : undefined);
      return Result.err(new ReportGenerationError(`Failed to generate report: ${message}`));
    }
  }

  private async loadNavigationGraph(): Promise<NavigationGraph | null> {
    try {
      const raw = await this.fileReader.read(this.navigationGraphPath);
      return JSON.parse(raw) as NavigationGraph;
    } catch (error) {
      this.logger.warn('No navigation graph available for this report', {
        navigationGraphPath: this.navigationGraphPath,
        reason: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }
}
