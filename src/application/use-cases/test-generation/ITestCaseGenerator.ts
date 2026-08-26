import { TestCase } from '../../../core/entities/TestCase';
import { TestCaseGenerationError } from '../../../core/errors/TestCaseGenerationError';
import { TestCaseGenerationRequest } from '../../dto/TestCaseGenerationRequest';
import { Result } from '../../../shared/result/Result';

export interface ITestCaseGenerator {
  generate(
    request: TestCaseGenerationRequest,
  ): Promise<Result<TestCase[], TestCaseGenerationError>>;
}
