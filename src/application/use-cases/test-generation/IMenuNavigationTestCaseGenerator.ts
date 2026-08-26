import { TestCase } from '../../../core/entities/TestCase';
import { TestCaseGenerationError } from '../../../core/errors/TestCaseGenerationError';
import { MenuNavigationTestCaseRequest } from '../../dto/MenuNavigationTestCaseRequest';
import { Result } from '../../../shared/result/Result';

export interface IMenuNavigationTestCaseGenerator {
  generate(
    request: MenuNavigationTestCaseRequest,
  ): Promise<Result<TestCase[], TestCaseGenerationError>>;
}
