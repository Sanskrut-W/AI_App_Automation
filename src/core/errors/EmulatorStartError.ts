import { DomainError } from './DomainError';

export class EmulatorStartError extends DomainError {
  readonly code = 'EMULATOR_START_ERROR';
}
