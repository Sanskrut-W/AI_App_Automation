import { TestCase } from '../../../core/entities/TestCase';
import { TestCaseGenerationError } from '../../../core/errors/TestCaseGenerationError';
import { ManualTestCaseGenerationRequest } from '../../dto/ManualTestCaseGenerationRequest';
import { Result } from '../../../shared/result/Result';

export interface IManualTestCaseGenerator {
  generate(
    request: ManualTestCaseGenerationRequest,
  ): Promise<Result<TestCase[], TestCaseGenerationError>>;
}
