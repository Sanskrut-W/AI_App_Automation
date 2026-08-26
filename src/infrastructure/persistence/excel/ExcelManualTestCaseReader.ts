import { Workbook, Cell } from 'exceljs';
import { IManualTestCaseSource } from '../../../application/interfaces/manual-test-cases/IManualTestCaseSource';
import { ManualTestCaseInput } from '../../../application/dto/ManualTestCaseInput';
import { ManualTestCaseSourceError } from '../../../core/errors/ManualTestCaseSourceError';
import { Result } from '../../../shared/result/Result';
import { ILogger } from '../../../shared/logger/ILogger';

const HEADER_ROW_NUMBER = 1;
/** 1-based column positions, matching the real Betway QA sheet's layout: Test Case Name, a
 * web-automation-suite-specific status tag ("PA-Xpath change needed" — ignored), Objective, an
 * unused/reserved column, Step Number, Step Description, Expected Result. Test Case Name and
 * Objective follow Excel's merged-cell convention: populated on the first row of a test case,
 * blank on every row that continues it. */
const COLUMN = {
  testCaseName: 1,
  objective: 3,
  stepNumber: 5,
  description: 6,
  expectedResult: 7,
} as const;

/** Reads manually-authored test cases from an Excel workbook (see IManualTestCaseSource). */
export class ExcelManualTestCaseReader implements IManualTestCaseSource {
  constructor(private readonly logger: ILogger) {}

  async read(filePath: string): Promise<Result<ManualTestCaseInput[], ManualTestCaseSourceError>> {
    try {
      const workbook = await new Workbook().xlsx.readFile(filePath);
      const worksheet = workbook.worksheets[0];
      if (!worksheet) {
        throw new Error('The workbook has no worksheets.');
      }

      const testCases: ManualTestCaseInput[] = [];
      let current: ManualTestCaseInput | null = null;

      worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber <= HEADER_ROW_NUMBER) {
          return;
        }

        const testCaseName = this.cellText(row.getCell(COLUMN.testCaseName));
        const objective = this.cellText(row.getCell(COLUMN.objective));
        const stepNumberRaw = this.cellText(row.getCell(COLUMN.stepNumber));
        const description = this.cellText(row.getCell(COLUMN.description));
        const expectedResult = this.cellText(row.getCell(COLUMN.expectedResult));

        if (!description) {
          this.logger.debug('Skipping a row with no step description', { rowNumber });
          return;
        }

        const stepNumber = Number(stepNumberRaw);
        if (!Number.isFinite(stepNumber)) {
          this.logger.warn('Skipping a row with a non-numeric step number', {
            rowNumber,
            stepNumberRaw,
          });
          return;
        }

        if (testCaseName) {
          current = { testCaseName, objective, steps: [] };
          testCases.push(current);
        } else if (!current) {
          this.logger.warn(
            'Skipping a row that continues a test case, but no test case has started yet — check the sheet for a missing Test Case Name',
            { rowNumber },
          );
          return;
        }

        const testCase = current;
        const expectedNextStep = testCase.steps.length + 1;
        if (stepNumber !== expectedNextStep) {
          this.logger.warn('Step number does not follow sequentially from the previous row', {
            rowNumber,
            testCaseName: testCase.testCaseName,
            expectedStepNumber: expectedNextStep,
            actualStepNumber: stepNumber,
          });
        }

        testCase.steps.push({ stepNumber, description, expectedResult });
      });

      this.logger.info('Parsed manual test cases from Excel', {
        filePath,
        testCasesFound: testCases.length,
      });
      return Result.ok(testCases);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return Result.err(
        new ManualTestCaseSourceError(
          `Failed to read manual test cases from "${filePath}": ${message}`,
        ),
      );
    }
  }

  /** Best-effort plain-text extraction — cells are usually plain strings/numbers, but exceljs can
   * also hand back rich-text or hyperlink objects for a cell that merely looks like plain text in
   * the sheet. */
  private cellText(cell: Cell): string {
    const value = cell.value;
    if (value === null || value === undefined) {
      return '';
    }
    if (typeof value === 'object') {
      if ('text' in value && typeof value.text === 'string') {
        return value.text.trim();
      }
      if ('richText' in value && Array.isArray(value.richText)) {
        return value.richText
          .map((part) => part.text)
          .join('')
          .trim();
      }
      return String(value).trim();
    }
    return String(value).trim();
  }
}
