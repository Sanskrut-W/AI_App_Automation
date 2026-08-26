import { DomainError } from './DomainError';

export class ElementAlreadyExistsError extends DomainError {
  readonly code = 'ELEMENT_ALREADY_EXISTS_ERROR';
}
