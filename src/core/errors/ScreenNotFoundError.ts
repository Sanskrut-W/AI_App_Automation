import { DomainError } from './DomainError';

export class ScreenNotFoundError extends DomainError {
  readonly code = 'SCREEN_NOT_FOUND_ERROR';
}
