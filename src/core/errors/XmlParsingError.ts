import { DomainError } from './DomainError';

export class XmlParsingError extends DomainError {
  readonly code = 'XML_PARSING_ERROR';
}
