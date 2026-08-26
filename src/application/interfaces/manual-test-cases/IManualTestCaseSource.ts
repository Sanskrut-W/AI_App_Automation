import { ManualTestCaseInput } from '../../dto/ManualTestCaseInput';
import { ManualTestCaseSourceError } from '../../../core/errors/ManualTestCaseSourceError';
import { Result } from '../../../shared/result/Result';

/** Reads manually-authored test cases from an external file. The only current implementation
 * reads an Excel sheet (ExcelManualTestCaseReader); this port exists so a future source (e.g. CSV,
 * a test-management tool export) can be added without touching ManualTestCaseGenerator. A
 * malformed or missing file is an expected, recoverable failure (bad input, not a programmer
 * error), so — like every other repository/reader in this codebase — it's a Result, not a throw. */
export interface IManualTestCaseSource {
  read(filePath: string): Promise<Result<ManualTestCaseInput[], ManualTestCaseSourceError>>;
}
