import { PipelineError } from '../../../core/errors/PipelineError';
import { Result } from '../../../shared/result/Result';
import { PipelineRequest } from '../../dto/PipelineRequest';
import { PipelineResult } from '../../dto/PipelineResult';
import { ExecuteStoredSuiteRequest } from '../../dto/ExecuteStoredSuiteRequest';
import { ExecuteStoredSuiteResult } from '../../dto/ExecuteStoredSuiteResult';
import { ImportManualTestCasesRequest } from '../../dto/ImportManualTestCasesRequest';
import { ImportManualTestCasesResult } from '../../dto/ImportManualTestCasesResult';

export interface IPipelineOrchestrator {
  /** Full flow: install, crawl, AI-analyze new screens, generate new test cases, execute the entire stored suite, report. */
  run(request: PipelineRequest): Promise<Result<PipelineResult, PipelineError>>;
  /** No APK, no crawl, no AI — just runs an already-tested app's stored suite again (e.g. for daily regression) and reports. */
  executeStoredSuite(
    request: ExecuteStoredSuiteRequest,
  ): Promise<Result<ExecuteStoredSuiteResult, PipelineError>>;
  /** No APK, no device, no crawl — turns a manually-authored Excel test-case sheet into real,
   * executable test cases using elements/screenshots a prior crawl already captured. Run the
   * result later via executeStoredSuite({ module: 'manual' }). */
  importManualTestCases(
    request: ImportManualTestCasesRequest,
  ): Promise<Result<ImportManualTestCasesResult, PipelineError>>;
}
