import { DomainError } from './DomainError';

export class ManualTestCaseSourceError extends DomainError {
  readonly code = 'MANUAL_TEST_CASE_SOURCE_ERROR';
}
