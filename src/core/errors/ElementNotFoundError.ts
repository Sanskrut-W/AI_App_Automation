import { DomainError } from './DomainError';

export class ElementNotFoundError extends DomainError {
  readonly code = 'ELEMENT_NOT_FOUND_ERROR';
}
