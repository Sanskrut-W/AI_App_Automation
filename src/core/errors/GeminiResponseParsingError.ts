import { DomainError } from './DomainError';

export class GeminiResponseParsingError extends DomainError {
  readonly code = 'GEMINI_RESPONSE_PARSING_ERROR';
}
