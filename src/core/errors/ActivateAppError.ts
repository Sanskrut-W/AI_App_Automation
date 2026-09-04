import { DomainError } from './DomainError';

export class ActivateAppError extends DomainError {
  readonly code = 'ACTIVATE_APP_ERROR';
}
