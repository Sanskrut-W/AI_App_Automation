import { DomainError } from './DomainError';

export class TestCaseGenerationError extends DomainError {
  readonly code = 'TEST_CASE_GENERATION_ERROR';
}
