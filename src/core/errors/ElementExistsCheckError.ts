import { DomainError } from './DomainError';

export class ElementExistsCheckError extends DomainError {
  readonly code = 'ELEMENT_EXISTS_CHECK_ERROR';
}
