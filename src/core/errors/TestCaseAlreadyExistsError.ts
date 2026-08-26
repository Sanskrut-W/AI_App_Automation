import { DomainError } from './DomainError';

export class TestCaseAlreadyExistsError extends DomainError {
  readonly code = 'TEST_CASE_ALREADY_EXISTS_ERROR';
}
