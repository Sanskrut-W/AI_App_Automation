import path from 'path';
import { TestReport } from '../../dto/TestReport';
import { TestCaseResult } from '../../dto/TestCaseResult';
import { StepResult } from '../../dto/StepResult';
import { NavigationGraph } from '../../dto/NavigationGraph';
import { TestCaseStatus } from '../../../core/enums/TestCaseStatus';
import { StepStatus } from '../../../core/enums/StepStatus';
import { IHtmlReportRenderer } from './IHtmlReportRenderer';

/**
 * Pure HTML string builder — no I/O. Kept independent of ReportGenerator's file-writing so a
 * future renderer (e.g. a different template engine or output style) can be swapped in without
 * touching how/where reports are persisted.
 */
export class HtmlReportRenderer implements IHtmlReportRenderer {
  render(report: TestReport, reportDir: string): string {
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Test Execution Report</title>
<style>${this.styles()}</style>
</head>
<body>
${this.renderHeader(report)}
<main>
${this.renderTestCases(report.summary.results, reportDir)}
${this.renderNavigationGraph(report.navigationGraph)}
</main>
</body>
</html>
`;
  }

  private renderHeader(report: TestReport): string {
    const { summary } = report;
    return `<header>
  <h1>Test Execution Report</h1>
  <p class="generated-at">Generated ${this.escapeHtml(report.generatedAt)}</p>
  <div class="summary-stats">
    <div class="stat"><span class="stat-value">${summary.totalTestCases}</span><span class="stat-label">Total</span></div>
    <div class="stat stat-pass"><span class="stat-value">${summary.passed}</span><span class="stat-label">Passed</span></div>
    <div class="stat stat-fail"><span class="stat-value">${summary.failed}</span><span class="stat-label">Failed</span></div>
  </div>
</header>`;
  }

  private renderTestCases(results: TestCaseResult[], reportDir: string): string {
    if (results.length === 0) {
      return '<section class="test-cases"><p class="empty-note">No test cases were executed in this run.</p></section>';
    }

    return `<section class="test-cases">
${results.map((testCase) => this.renderTestCase(testCase, reportDir)).join('\n')}
</section>`;
  }

  private renderTestCase(testCase: TestCaseResult, reportDir: string): string {
    const statusClass = testCase.status === TestCaseStatus.PASSED ? 'pass' : 'fail';
    return `<article class="test-case ${statusClass}">
  <div class="test-case-header">
    <h2>${this.escapeHtml(testCase.title)}</h2>
    <span class="badge badge-${statusClass}">${testCase.status}</span>
    <span class="duration">${this.formatDuration(testCase.durationMs)}</span>
  </div>
  <p class="test-case-meta">Screen: ${this.escapeHtml(testCase.screenId)} &middot; Test case: ${this.escapeHtml(testCase.testCaseId)}</p>
  <ol class="steps">
${testCase.stepResults.map((step) => this.renderStep(step, reportDir)).join('\n')}
  </ol>
</article>`;
  }

  private renderStep(step: StepResult, reportDir: string): string {
    const statusClass = step.status === StepStatus.PASSED ? 'pass' : 'fail';
    // Caption goes ABOVE the image (a <figcaption> is valid as either the first or last child of a
    // <figure>), so the reader knows what they are looking at before they look at it.
    const screenshot = step.screenshotPath
      ? `<figure class="shot">
        ${step.screenshotLabel ? `<figcaption class="shot-caption">${this.escapeHtml(step.screenshotLabel)}</figcaption>` : ''}
        <img class="screenshot" src="${this.escapeHtml(this.toRelativePath(reportDir, step.screenshotPath))}" alt="${this.escapeHtml(step.screenshotLabel ?? `Screenshot for step ${step.stepNumber}`)}" />
      </figure>`
      : '';
    const stackTrace = step.stackTrace
      ? `<pre class="stack-trace">${this.escapeHtml(step.stackTrace)}</pre>`
      : '';

    return `    <li class="step ${statusClass}">
      <div class="step-header">
        <span class="step-number">#${step.stepNumber}</span>
        <span class="step-action">${this.escapeHtml(step.action)}</span>
        <span class="badge badge-${statusClass}">${step.status}</span>
        <span class="duration">${this.formatDuration(step.durationMs)}</span>
      </div>
      <p class="step-message">${this.escapeHtml(step.message)}</p>
      ${screenshot}
      ${stackTrace}
    </li>`;
  }

  private renderNavigationGraph(graph: NavigationGraph | null): string {
    if (!graph) {
      return '<section class="navigation-graph"><h2>Screen Navigation Graph</h2><p class="empty-note">No navigation graph available for this run.</p></section>';
    }

    const screens = graph.screenIds
      .map(
        (screenId) =>
          `<span class="screen-chip${screenId === graph.rootScreenId ? ' root' : ''}">${this.escapeHtml(screenId)}</span>`,
      )
      .join('');

    const edgeRows = graph.edges
      .map(
        (edge) =>
          `<tr><td>${this.escapeHtml(edge.fromScreenId)}</td><td>${this.escapeHtml(edge.elementId)}</td><td>${this.escapeHtml(edge.toScreenId)}</td></tr>`,
      )
      .join('');

    return `<section class="navigation-graph">
  <h2>Screen Navigation Graph</h2>
  <div class="screens">${screens}</div>
  <div class="table-wrapper">
    <table class="edges">
      <thead><tr><th>From</th><th>Via Element</th><th>To</th></tr></thead>
      <tbody>${edgeRows}</tbody>
    </table>
  </div>
</section>`;
  }

  private toRelativePath(reportDir: string, filePath: string): string {
    return path.relative(reportDir, filePath).split(path.sep).join('/');
  }

  private formatDuration(durationMs: number): string {
    return durationMs >= 1000 ? `${(durationMs / 1000).toFixed(2)}s` : `${durationMs}ms`;
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private styles(): string {
    return `
:root { color-scheme: light dark; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  margin: 0;
  padding: 2rem;
  background: #f5f6f8;
  color: #1a1a1a;
}
@media (prefers-color-scheme: dark) {
  body { background: #16181d; color: #e6e6e6; }
  .test-case, .navigation-graph, table { background: #22252c !important; border-color: #33363f !important; }
  .step { border-color: #33363f !important; }
}
header { margin-bottom: 2rem; }
h1 { margin: 0 0 0.25rem; font-size: 1.75rem; }
.generated-at { color: #6b7280; margin: 0 0 1rem; }
.summary-stats { display: flex; gap: 1rem; }
.stat { background: #fff; border-radius: 10px; padding: 0.75rem 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); text-align: center; }
.stat-value { display: block; font-size: 1.5rem; font-weight: 700; }
.stat-label { display: block; font-size: 0.8rem; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.stat-pass .stat-value { color: #16a34a; }
.stat-fail .stat-value { color: #dc2626; }
.test-cases { display: flex; flex-direction: column; gap: 1.25rem; }
.test-case { background: #fff; border: 1px solid #e5e7eb; border-left-width: 5px; border-radius: 10px; padding: 1.25rem 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
.test-case.pass { border-left-color: #16a34a; }
.test-case.fail { border-left-color: #dc2626; }
.test-case-header { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
.test-case-header h2 { margin: 0; font-size: 1.15rem; flex: 1 1 auto; }
.test-case-meta { color: #6b7280; font-size: 0.85rem; margin: 0.35rem 0 1rem; }
.badge { display: inline-block; padding: 0.15rem 0.6rem; border-radius: 999px; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em; }
.badge-pass { background: #dcfce7; color: #16a34a; }
.badge-fail { background: #fee2e2; color: #dc2626; }
.duration { color: #6b7280; font-size: 0.85rem; font-variant-numeric: tabular-nums; }
.steps { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.6rem; }
.step { border: 1px solid #e5e7eb; border-radius: 8px; padding: 0.6rem 0.9rem; }
.step.fail { background: #fff5f5; }
.step-header { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; }
.step-number { font-weight: 600; color: #6b7280; }
.step-action { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.85rem; }
.step-message { margin: 0.4rem 0 0; font-size: 0.9rem; }
.shot { margin: 0.6rem 0 0; }
.shot-caption { font-size: 0.95rem; font-weight: 600; margin-bottom: 0.4rem; }
.screenshot { max-width: 320px; max-height: 320px; border-radius: 6px; border: 1px solid #e5e7eb; display: block; }
.stack-trace { background: #1a1a1a; color: #f5f5f5; padding: 0.75rem; border-radius: 6px; font-size: 0.75rem; overflow-x: auto; margin-top: 0.5rem; white-space: pre-wrap; word-break: break-word; }
.navigation-graph { margin-top: 2rem; background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 1.25rem 1.5rem; }
.screens { display: flex; flex-wrap: wrap; gap: 0.4rem; margin: 0.75rem 0; }
.screen-chip { background: #eef2ff; color: #3730a3; border-radius: 999px; padding: 0.2rem 0.7rem; font-size: 0.8rem; }
.screen-chip.root { background: #3730a3; color: #fff; }
.table-wrapper { overflow-x: auto; }
table.edges { border-collapse: collapse; width: 100%; font-size: 0.85rem; }
table.edges th, table.edges td { text-align: left; padding: 0.4rem 0.6rem; border-bottom: 1px solid #e5e7eb; }
.empty-note { color: #6b7280; font-style: italic; }
`;
  }
}
