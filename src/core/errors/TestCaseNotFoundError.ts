import { DomainError } from './DomainError';

export class TestCaseNotFoundError extends DomainError {
  readonly code = 'TEST_CASE_NOT_FOUND_ERROR';
}
