import { DomainError } from './DomainError';

export class ScreenAnalysisError extends DomainError {
  readonly code = 'SCREEN_ANALYSIS_ERROR';
}
