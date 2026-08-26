import { DomainError } from './DomainError';

export class NavigationError extends DomainError {
  readonly code = 'NAVIGATION_ERROR';
}
