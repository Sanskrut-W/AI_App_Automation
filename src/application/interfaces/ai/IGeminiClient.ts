import { GeminiGenerateOptions } from '../../dto/GeminiGenerateOptions';
import { GeminiClientError } from '../../../core/errors/GeminiClientError';
import { Result } from '../../../shared/result/Result';

/**
 * Reusable Gemini API client. Guarantees the returned value is genuinely parsed JSON (Gemini is
 * always asked for `application/json` responses, and the response is re-validated as JSON on
 * receipt) — never free text. Does not validate the JSON against any particular schema; that is
 * the caller's responsibility (see the future AI Screen Analyzer module).
 */
export interface IGeminiClient {
  generateJson<T = unknown>(options: GeminiGenerateOptions): Promise<Result<T, GeminiClientError>>;
}
