import path from 'path';
import { HtmlReportRenderer } from '../../../../../src/application/use-cases/reporting/HtmlReportRenderer';
import { TestReport } from '../../../../../src/application/dto/TestReport';
import { TestCaseStatus } from '../../../../../src/core/enums/TestCaseStatus';
import { StepStatus } from '../../../../../src/core/enums/StepStatus';
import { ActionType } from '../../../../../src/core/enums/ActionType';

function createReport(overrides: Partial<TestReport> = {}): TestReport {
  return {
    generatedAt: '2026-01-01T00:00:00.000Z',
    summary: {
      totalTestCases: 1,
      passed: 1,
      failed: 0,
      results: [
        {
          testCaseId: 'test-case-1',
          screenId: 'screen-1',
          title: 'Home: Calculate button',
          status: TestCaseStatus.PASSED,
          durationMs: 1200,
          stepResults: [
            {
              stepNumber: 1,
              action: ActionType.CLICK,
              status: StepStatus.PASSED,
              message: 'Clicked element.',
              screenshotPath: null,
              screenshotLabel: null,
              stackTrace: null,
              durationMs: 200,
            },
          ],
        },
      ],
    },
    navigationGraph: null,
    ...overrides,
  };
}

describe('HtmlReportRenderer', () => {
  const renderer = new HtmlReportRenderer();
  const REPORT_DIR = path.resolve('/artifacts', 'reports');

  it('renders a full HTML document with the summary stats', () => {
    const html = renderer.render(createReport(), REPORT_DIR);

    expect(html).toContain('<!doctype html>');
    expect(html).toContain('Test Execution Report');
    expect(html).toContain('Generated 2026-01-01T00:00:00.000Z');
    expect(html).toMatch(/<span class="stat-value">1<\/span><span class="stat-label">Total/);
  });

  it('renders a passed test case with its step', () => {
    const html = renderer.render(createReport(), REPORT_DIR);

    expect(html).toContain('Home: Calculate button');
    expect(html).toContain('badge-pass');
    expect(html).toContain('Clicked element.');
  });

  it('escapes HTML special characters in test case titles and step messages', () => {
    const report = createReport();
    report.summary.results[0].title = '<script>alert(1)</script>';
    report.summary.results[0].stepResults[0].message = 'Value was "<b>bold</b>" & unsafe';

    const html = renderer.render(report, REPORT_DIR);

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('&quot;&lt;b&gt;bold&lt;/b&gt;&quot; &amp; unsafe');
  });

  it('renders a screenshot as a report-relative, forward-slash path for a failed step', () => {
    const reportDir = path.resolve('/artifacts', 'reports');
    const screenshotPath = path.resolve('/artifacts', 'execution-screenshots', 'step-1.png');
    const expectedRelative = path.relative(reportDir, screenshotPath).split(path.sep).join('/');

    const report = createReport();
    report.summary.results[0].status = TestCaseStatus.FAILED;
    report.summary.results[0].stepResults[0].status = StepStatus.FAILED;
    report.summary.results[0].stepResults[0].screenshotPath = screenshotPath;

    const html = renderer.render(report, reportDir);

    expect(html).toContain('badge-fail');
    expect(html).toContain(`<img class="screenshot" src="${expectedRelative}"`);
  });

  it("renders a labelled checkpoint's caption above its screenshot, and uses it as the alt text", () => {
    const report = createReport();
    const [step] = report.summary.results[0].stepResults;
    step.screenshotPath = path.resolve('/artifacts', 'execution-screenshots', 'step-1.png');
    step.screenshotLabel = 'Checking My Bets';

    const html = renderer.render(report, REPORT_DIR);

    expect(html).toContain('<figcaption class="shot-caption">Checking My Bets</figcaption>');
    expect(html).toContain('alt="Checking My Bets"');
    // The caption must precede the image so the reader knows what they are about to look at.
    expect(html.indexOf('shot-caption')).toBeLessThan(html.indexOf('<img class="screenshot"'));
  });

  it('omits the caption element for an unlabelled screenshot', () => {
    const report = createReport();
    const [step] = report.summary.results[0].stepResults;
    step.screenshotPath = path.resolve('/artifacts', 'execution-screenshots', 'step-1.png');
    step.screenshotLabel = null;

    const html = renderer.render(report, REPORT_DIR);

    expect(html).toContain('<img class="screenshot"');
    // Assert on the element, not the class name — the stylesheet always defines .shot-caption.
    expect(html).not.toContain('<figcaption');
  });

  it('renders a stack trace block for a failed step', () => {
    const report = createReport();
    report.summary.results[0].stepResults[0].status = StepStatus.FAILED;
    report.summary.results[0].stepResults[0].stackTrace = 'Error: boom\n    at somewhere.ts:10:5';

    const html = renderer.render(report, REPORT_DIR);

    expect(html).toContain('<pre class="stack-trace">Error: boom');
  });

  it('omits screenshot and stack trace markup when neither is present', () => {
    const html = renderer.render(createReport(), REPORT_DIR);

    expect(html).not.toContain('class="screenshot"');
    expect(html).not.toContain('class="stack-trace"');
  });

  it('renders a placeholder when there are no test cases', () => {
    const report = createReport({
      summary: { totalTestCases: 0, passed: 0, failed: 0, results: [] },
    });

    const html = renderer.render(report, REPORT_DIR);

    expect(html).toContain('No test cases were executed in this run.');
  });

  it('renders the navigation graph screens and edges when present', () => {
    const report = createReport({
      navigationGraph: {
        rootScreenId: 'screen-1',
        screenIds: ['screen-1', 'screen-2'],
        edges: [{ fromScreenId: 'screen-1', toScreenId: 'screen-2', elementId: 'element-1' }],
      },
    });

    const html = renderer.render(report, REPORT_DIR);

    expect(html).toContain('Screen Navigation Graph');
    expect(html).toContain('screen-chip root');
    expect(html).toContain('<td>screen-1</td><td>element-1</td><td>screen-2</td>');
  });

  it('renders a placeholder when there is no navigation graph', () => {
    const html = renderer.render(createReport({ navigationGraph: null }), REPORT_DIR);

    expect(html).toContain('No navigation graph available for this run.');
  });
});
