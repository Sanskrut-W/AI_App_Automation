import { DomainError } from './DomainError';

export class XmlSaveError extends DomainError {
  readonly code = 'XML_SAVE_ERROR';
}
