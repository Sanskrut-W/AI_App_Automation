import { DomainError } from './DomainError';

export class ClearTextError extends DomainError {
  readonly code = 'CLEAR_TEXT_ERROR';
}
