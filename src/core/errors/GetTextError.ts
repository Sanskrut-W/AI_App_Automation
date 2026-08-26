import { DomainError } from './DomainError';

export class GetTextError extends DomainError {
  readonly code = 'GET_TEXT_ERROR';
}
