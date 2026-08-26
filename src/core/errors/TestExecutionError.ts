import { DomainError } from './DomainError';

export class TestExecutionError extends DomainError {
  readonly code = 'TEST_EXECUTION_ERROR';
}
