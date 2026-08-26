import { DomainError } from './DomainError';

export class XmlCaptureError extends DomainError {
  readonly code = 'XML_CAPTURE_ERROR';
}
