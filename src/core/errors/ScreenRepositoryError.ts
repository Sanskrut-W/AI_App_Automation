import { DomainError } from './DomainError';

export class ScreenRepositoryError extends DomainError {
  readonly code = 'SCREEN_REPOSITORY_ERROR';
}
