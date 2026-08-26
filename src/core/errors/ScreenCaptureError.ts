import { DomainError } from './DomainError';

export class ScreenCaptureError extends DomainError {
  readonly code = 'SCREEN_CAPTURE_ERROR';
}
