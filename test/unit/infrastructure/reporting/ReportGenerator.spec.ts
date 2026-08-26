import { ReportGenerator } from '../../../../src/infrastructure/reporting/ReportGenerator';
import { IFileReader } from '../../../../src/shared/fs/IFileReader';
import { IFileWriter } from '../../../../src/shared/fs/IFileWriter';
import { IClock } from '../../../../src/shared/time/IClock';
import { IHtmlReportRenderer } from '../../../../src/application/use-cases/reporting/IHtmlReportRenderer';
import { TestExecutionSummary } from '../../../../src/application/dto/TestExecutionSummary';
import { ReportGenerationError } from '../../../../src/core/errors/ReportGenerationError';
import { createMockLogger } from '../../support/createMockLogger';

const SUMMARY: TestExecutionSummary = {
  totalTestCases: 1,
  passed: 1,
  failed: 0,
  results: [],
};

const NAVIGATION_GRAPH = {
  rootScreenId: 'screen-1',
  screenIds: ['screen-1'],
  edges: [],
};

function createMocks() {
  const fileReader: jest.Mocked<IFileReader> = {
    read: jest.fn().mockResolvedValue(JSON.stringify(NAVIGATION_GRAPH)),
    readBinary: jest.fn(),
  };
  const fileWriter: jest.Mocked<IFileWriter> = { write: jest.fn().mockResolvedValue(undefined) };
  const htmlRenderer: jest.Mocked<IHtmlReportRenderer> = {
    render: jest.fn().mockReturnValue('<html></html>'),
  };
  const clock: jest.Mocked<IClock> = {
    now: jest.fn().mockReturnValue('2026-01-01T00:00:00.000Z'),
    nowMs: jest.fn().mockReturnValue(1_700_000_000_000),
  };
  const logger = createMockLogger();

  return { fileReader, fileWriter, htmlRenderer, clock, logger };
}

function createGenerator(mocks: ReturnType<typeof createMocks>) {
  return new ReportGenerator(
    mocks.fileReader,
    mocks.fileWriter,
    mocks.htmlRenderer,
    mocks.clock,
    mocks.logger,
  );
}

describe('ReportGenerator', () => {
  it('reads the navigation graph, writes a JSON report and an HTML report, and returns both paths', async () => {
    const mocks = createMocks();
    const generator = createGenerator(mocks);

    const result = await generator.generate(SUMMARY);

    expect(result.isOk()).toBe(true);
    const { jsonReportPath, htmlReportPath } = result.unwrap();
    expect(jsonReportPath).toContain('report-1700000000000.json');
    expect(htmlReportPath).toContain('report-1700000000000.html');

    const [writtenJsonPath, writtenJson] = mocks.fileWriter.write.mock.calls[0];
    expect(writtenJsonPath).toBe(jsonReportPath);
    const parsed = JSON.parse(writtenJson as string);
    expect(parsed.summary).toEqual(SUMMARY);
    expect(parsed.navigationGraph).toEqual(NAVIGATION_GRAPH);
    expect(parsed.generatedAt).toBe('2026-01-01T00:00:00.000Z');

    expect(mocks.htmlRenderer.render).toHaveBeenCalledWith(
      expect.objectContaining({ summary: SUMMARY, navigationGraph: NAVIGATION_GRAPH }),
      expect.stringContaining('reports'),
    );
    const [writtenHtmlPath, writtenHtml] = mocks.fileWriter.write.mock.calls[1];
    expect(writtenHtmlPath).toBe(htmlReportPath);
    expect(writtenHtml).toBe('<html></html>');
  });

  it('degrades to a null navigation graph when the artifact file cannot be read', async () => {
    const mocks = createMocks();
    mocks.fileReader.read.mockRejectedValue(new Error('ENOENT: no such file'));
    const generator = createGenerator(mocks);

    const result = await generator.generate(SUMMARY);

    expect(result.isOk()).toBe(true);
    expect(mocks.htmlRenderer.render).toHaveBeenCalledWith(
      expect.objectContaining({ navigationGraph: null }),
      expect.any(String),
    );
    expect(mocks.logger.warn).toHaveBeenCalledWith(
      'No navigation graph available for this report',
      expect.objectContaining({ reason: 'ENOENT: no such file' }),
    );
  });

  it('degrades to a null navigation graph when the artifact file is not valid JSON', async () => {
    const mocks = createMocks();
    mocks.fileReader.read.mockResolvedValue('{not valid json');
    const generator = createGenerator(mocks);

    const result = await generator.generate(SUMMARY);

    expect(result.isOk()).toBe(true);
    expect(mocks.htmlRenderer.render).toHaveBeenCalledWith(
      expect.objectContaining({ navigationGraph: null }),
      expect.any(String),
    );
  });

  it('returns a ReportGenerationError when writing the report fails', async () => {
    const mocks = createMocks();
    mocks.fileWriter.write.mockRejectedValue(new Error('disk full'));
    const generator = createGenerator(mocks);

    const result = await generator.generate(SUMMARY);

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(ReportGenerationError);
    expect(result.unwrapErr().message).toMatch(/disk full/);
  });
});
