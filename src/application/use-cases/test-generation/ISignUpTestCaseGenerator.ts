import { TestCase } from '../../../core/entities/TestCase';
import { TestCaseGenerationError } from '../../../core/errors/TestCaseGenerationError';
import { SignUpTestCaseRequest } from '../../dto/SignUpTestCaseRequest';
import { Result } from '../../../shared/result/Result';

export interface ISignUpTestCaseGenerator {
  generate(request: SignUpTestCaseRequest): Promise<Result<TestCase[], TestCaseGenerationError>>;
}
