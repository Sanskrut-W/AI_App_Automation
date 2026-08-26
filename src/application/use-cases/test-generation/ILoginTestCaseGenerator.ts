import { TestCase } from '../../../core/entities/TestCase';
import { TestCaseGenerationError } from '../../../core/errors/TestCaseGenerationError';
import { LoginTestCaseRequest } from '../../dto/LoginTestCaseRequest';
import { Result } from '../../../shared/result/Result';

export interface ILoginTestCaseGenerator {
  generate(request: LoginTestCaseRequest): Promise<Result<TestCase[], TestCaseGenerationError>>;
}
