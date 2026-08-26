import { DomainError } from './DomainError';

export class ApkMetadataError extends DomainError {
  readonly code = 'APK_METADATA_ERROR';
}
