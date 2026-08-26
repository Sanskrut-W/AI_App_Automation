import { DomainError } from './DomainError';

export class DeviceStatusError extends DomainError {
  readonly code = 'DEVICE_STATUS_ERROR';
}
