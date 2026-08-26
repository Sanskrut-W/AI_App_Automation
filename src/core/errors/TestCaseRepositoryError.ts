import { DomainError } from './DomainError';

export class TestCaseRepositoryError extends DomainError {
  readonly code = 'TEST_CASE_REPOSITORY_ERROR';
}
