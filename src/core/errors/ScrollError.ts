import { DomainError } from './DomainError';

export class ScrollError extends DomainError {
  readonly code = 'SCROLL_ERROR';
}
