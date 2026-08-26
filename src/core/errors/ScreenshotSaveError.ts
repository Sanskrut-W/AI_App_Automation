import { DomainError } from './DomainError';

export class ScreenshotSaveError extends DomainError {
  readonly code = 'SCREENSHOT_SAVE_ERROR';
}
