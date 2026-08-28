import { DomainError } from './DomainError';

export class ImeActionError extends DomainError {
  readonly code = 'IME_ACTION_ERROR';
}
