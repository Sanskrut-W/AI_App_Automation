import { DomainError } from './DomainError';

export class EmulatorBootTimeoutError extends DomainError {
  readonly code = 'EMULATOR_BOOT_TIMEOUT_ERROR';
}
