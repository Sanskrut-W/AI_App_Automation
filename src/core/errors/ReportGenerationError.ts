import { DomainError } from './DomainError';

export class ReportGenerationError extends DomainError {
  readonly code = 'REPORT_GENERATION_ERROR';
}
