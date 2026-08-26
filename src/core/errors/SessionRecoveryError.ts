import { DomainError } from './DomainError';

export class SessionRecoveryError extends DomainError {
  readonly code = 'SESSION_RECOVERY_ERROR';
}
