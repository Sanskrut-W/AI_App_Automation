import { DomainError } from './DomainError';

export class AppCloseError extends DomainError {
  readonly code = 'APP_CLOSE_ERROR';
}
