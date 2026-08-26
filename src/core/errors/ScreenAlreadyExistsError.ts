import { DomainError } from './DomainError';

export class ScreenAlreadyExistsError extends DomainError {
  readonly code = 'SCREEN_ALREADY_EXISTS_ERROR';
}
