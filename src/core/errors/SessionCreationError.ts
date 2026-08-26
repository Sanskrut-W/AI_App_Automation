import { DomainError } from './DomainError';

export class SessionCreationError extends DomainError {
  readonly code = 'SESSION_CREATION_ERROR';
}
