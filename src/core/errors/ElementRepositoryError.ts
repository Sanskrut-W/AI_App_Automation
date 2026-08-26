import { DomainError } from './DomainError';

export class ElementRepositoryError extends DomainError {
  readonly code = 'ELEMENT_REPOSITORY_ERROR';
}
