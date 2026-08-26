import { DomainError } from './DomainError';

export class ApkValidationError extends DomainError {
  readonly code = 'APK_VALIDATION_ERROR';
}
