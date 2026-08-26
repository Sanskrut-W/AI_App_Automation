import { DomainError } from './DomainError';

export class EmulatorStopError extends DomainError {
  readonly code = 'EMULATOR_STOP_ERROR';
}
