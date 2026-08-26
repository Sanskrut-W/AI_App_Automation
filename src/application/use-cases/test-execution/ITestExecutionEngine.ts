import { TestExecutionError } from '../../../core/errors/TestExecutionError';
import { Result } from '../../../shared/result/Result';
import { TestExecutionRequest } from '../../dto/TestExecutionRequest';
import { TestExecutionSummary } from '../../dto/TestExecutionSummary';

export interface ITestExecutionEngine {
  execute(request: TestExecutionRequest): Promise<Result<TestExecutionSummary, TestExecutionError>>;
}
