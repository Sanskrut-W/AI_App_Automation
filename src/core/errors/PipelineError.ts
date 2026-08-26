import { DomainError } from './DomainError';

export class PipelineError extends DomainError {
  readonly code = 'PIPELINE_ERROR';
}
