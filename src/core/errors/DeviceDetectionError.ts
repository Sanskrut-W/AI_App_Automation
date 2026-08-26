import { DomainError } from './DomainError';

export class DeviceDetectionError extends DomainError {
  readonly code = 'DEVICE_DETECTION_ERROR';
}
