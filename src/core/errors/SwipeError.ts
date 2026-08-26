import { DomainError } from './DomainError';

export class SwipeError extends DomainError {
  readonly code = 'SWIPE_ERROR';
}
