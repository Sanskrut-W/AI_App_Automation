import { DomainError } from './DomainError';

export class ScreenCaptureServiceError extends DomainError {
  readonly code = 'SCREEN_CAPTURE_SERVICE_ERROR';
}
