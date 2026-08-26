import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import { Workbook } from 'exceljs';
import { ExcelManualTestCaseReader } from '../../../../../src/infrastructure/persistence/excel/ExcelManualTestCaseReader';
import { createMockLogger } from '../../../support/createMockLogger';

/** Builds a real .xlsx file mirroring the real Betway QA sheet's exact column layout (Test Case
 * Name, a web-suite status tag, Objective, an unused column, Step Number, Step Description,
 * Expected Result), with the merged-cell convention represented as literal blanks on continuation
 * rows — the same shape exceljs would report whether the source used true merged cells or not. */
async function writeSampleWorkbook(
  filePath: string,
  rows: Array<(string | number)[]>,
): Promise<void> {
  const workbook = new Workbook();
  const worksheet = workbook.addWorksheet('Test Cases');
  worksheet.addRow([
    'Test Case',
    'Status',
    'Objective',
    'Unused',
    'Step',
    'Step Description',
    'Expected Result',
  ]);
  for (const row of rows) {
    worksheet.addRow(row);
  }
  await workbook.xlsx.writeFile(filePath);
}

describe('ExcelManualTestCaseReader', () => {
  let tempFilePath: string;

  beforeEach(() => {
    tempFilePath = path.join(os.tmpdir(), `manual-test-cases-${Date.now()}-${Math.random()}.xlsx`);
  });

  afterEach(async () => {
    await fs.rm(tempFilePath, { force: true });
  });

  it('groups rows into test cases via the merged-cell (blank-continuation) convention, ignoring the status/unused columns', async () => {
    await writeSampleWorkbook(tempFilePath, [
      [
        'Verify login',
        'PA-Xpath change needed',
        'To check login',
        '',
        1,
        'Enter mobile number',
        'Mobile accepted',
      ],
      ['', 'PA-Xpath change needed', '', '', 2, 'Enter password', 'Password accepted'],
      ['', '', '', '', 3, 'Click login', 'User logged in'],
      [
        'Verify menu',
        'PA-Xpath change needed',
        'To check menu',
        '',
        1,
        'Click hamburger menu',
        'Menu opens',
      ],
    ]);
    const reader = new ExcelManualTestCaseReader(createMockLogger());

    const result = await reader.read(tempFilePath);

    expect(result.isOk()).toBe(true);
    const testCases = result.unwrap();
    expect(testCases).toHaveLength(2);
    expect(testCases[0]).toEqual({
      testCaseName: 'Verify login',
      objective: 'To check login',
      steps: [
        { stepNumber: 1, description: 'Enter mobile number', expectedResult: 'Mobile accepted' },
        { stepNumber: 2, description: 'Enter password', expectedResult: 'Password accepted' },
        { stepNumber: 3, description: 'Click login', expectedResult: 'User logged in' },
      ],
    });
    expect(testCases[1].testCaseName).toBe('Verify menu');
    expect(testCases[1].steps).toHaveLength(1);
  });

  it('skips a row with no step description', async () => {
    await writeSampleWorkbook(tempFilePath, [
      ['Verify login', '', 'To check login', '', 1, 'Enter mobile number', 'Mobile accepted'],
      ['', '', '', '', 2, '', ''],
      ['', '', '', '', 3, 'Click login', 'User logged in'],
    ]);
    const reader = new ExcelManualTestCaseReader(createMockLogger());

    const result = await reader.read(tempFilePath);

    expect(result.unwrap()[0].steps).toHaveLength(2);
  });

  it('logs a warning but still includes the row when step numbers are not sequential', async () => {
    const logger = createMockLogger();
    await writeSampleWorkbook(tempFilePath, [
      ['Verify login', '', 'To check login', '', 1, 'Enter mobile number', 'Mobile accepted'],
      ['', '', '', '', 7, 'Click login', 'User logged in'],
    ]);
    const reader = new ExcelManualTestCaseReader(logger);

    const result = await reader.read(tempFilePath);

    expect(result.unwrap()[0].steps).toHaveLength(2);
    expect(logger.warn).toHaveBeenCalledWith(
      'Step number does not follow sequentially from the previous row',
      expect.objectContaining({ expectedStepNumber: 2, actualStepNumber: 7 }),
    );
  });

  it('returns a ManualTestCaseSourceError (not a throw) when the file does not exist', async () => {
    const reader = new ExcelManualTestCaseReader(createMockLogger());

    const result = await reader.read(path.join(os.tmpdir(), 'does-not-exist-12345.xlsx'));

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().message).toMatch(/Failed to read manual test cases/);
  });
});
