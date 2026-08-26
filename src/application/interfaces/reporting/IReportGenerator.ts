import { TestExecutionSummary } from '../../dto/TestExecutionSummary';
import { ReportGenerationResult } from '../../dto/ReportGenerationResult';
import { ReportGenerationError } from '../../../core/errors/ReportGenerationError';
import { Result } from '../../../shared/result/Result';

/**
 * Port for turning a completed test execution run into human-readable report artifacts.
 * Storage/rendering-agnostic — an implementation could target HTML, PDF, or a hosted dashboard
 * without any change to callers.
 */
export interface IReportGenerator {
  generate(
    summary: TestExecutionSummary,
  ): Promise<Result<ReportGenerationResult, ReportGenerationError>>;
}
