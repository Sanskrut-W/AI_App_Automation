import { DomainError } from './DomainError';

export class ScreenshotCaptureError extends DomainError {
  readonly code = 'SCREENSHOT_CAPTURE_ERROR';
}
