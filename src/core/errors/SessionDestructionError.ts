import { DomainError } from './DomainError';

export class SessionDestructionError extends DomainError {
  readonly code = 'SESSION_DESTRUCTION_ERROR';
}
