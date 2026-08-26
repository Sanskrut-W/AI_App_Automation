import { DomainError } from './DomainError';

export class StepInterpretationError extends DomainError {
  readonly code = 'STEP_INTERPRETATION_ERROR';
}
