import { DomainError } from './DomainError';

export class TapError extends DomainError {
  readonly code = 'TAP_ERROR';
}
