import { DomainError } from './DomainError';

export class GeminiClientError extends DomainError {
  readonly code = 'GEMINI_CLIENT_ERROR';
}
