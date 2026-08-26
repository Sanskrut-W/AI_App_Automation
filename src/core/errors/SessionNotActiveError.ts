import { DomainError } from './DomainError';

export class SessionNotActiveError extends DomainError {
  readonly code = 'SESSION_NOT_ACTIVE_ERROR';
}
