import { GeminiClientError } from '../../../core/errors/GeminiClientError';
import { IGeminiClient } from '../../../application/interfaces/ai/IGeminiClient';
import { GeminiGenerateOptions } from '../../../application/dto/GeminiGenerateOptions';
import { Result } from '../../../shared/result/Result';
import { ILogger } from '../../../shared/logger/ILogger';
import { HttpResponse, IHttpClient } from '../../../shared/http/IHttpClient';
import { IRateLimiter } from '../../../shared/rate-limit/IRateLimiter';
import { retryWithBackoff } from '../../../shared/retry/retryWithBackoff';
import { IGeminiPromptBuilder } from './IGeminiPromptBuilder';
import { IGeminiResponseParser } from './IGeminiResponseParser';
import { GeminiClientConfig } from './GeminiClientConfig';
import { GeminiRequestError } from './GeminiRequestError';

/** Reusable Gemini API client: config, prompt building, response parsing, retry, timeout, and rate limiting all composed here. Never logs the API key. */
export class GeminiClient implements IGeminiClient {
  constructor(
    private readonly httpClient: IHttpClient,
    private readonly promptBuilder: IGeminiPromptBuilder,
    private readonly responseParser: IGeminiResponseParser,
    private readonly rateLimiter: IRateLimiter,
    private readonly logger: ILogger,
    private readonly config: GeminiClientConfig,
  ) {}

  async generateJson<T>(options: GeminiGenerateOptions): Promise<Result<T, GeminiClientError>> {
    this.logger.info('Requesting Gemini completion', { model: this.config.model });

    try {
      const requestBody = this.promptBuilder.build(options);
      const url = `${this.config.baseUrl}/models/${this.config.model}:generateContent?key=${this.config.apiKey}`;

      const response = await retryWithBackoff(
        async () => {
          await this.rateLimiter.acquire();
          return this.sendRequest(url, requestBody);
        },
        {
          maxRetries: this.config.maxRetries,
          baseDelayMs: this.config.retryBackoffMs,
          shouldRetry: (error) => error instanceof GeminiRequestError && error.retryable,
          onRetry: (attempt, error, delayMs) => {
            this.logger.warn('Retrying Gemini request', {
              attempt,
              delayMs,
              reason: error instanceof Error ? error.message : String(error),
            });
          },
        },
      );

      const parsed = this.responseParser.parse<T>(response.body);
      this.logger.info('Gemini completion succeeded', { model: this.config.model });
      return Result.ok(parsed);
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error('Gemini request failed', error);
      }
      const message = error instanceof Error ? error.message : String(error);
      return Result.err(new GeminiClientError(`Gemini request failed: ${message}`));
    }
  }

  private async sendRequest(url: string, body: string): Promise<HttpResponse> {
    let response: HttpResponse;
    try {
      response = await this.httpClient.request({
        url,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        timeoutMs: this.config.timeoutMs,
      });
    } catch (error) {
      throw new GeminiRequestError(
        `Network error calling Gemini API: ${error instanceof Error ? error.message : String(error)}`,
        true,
      );
    }

    if (response.status === 429 || response.status >= 500) {
      throw new GeminiRequestError(`Gemini API returned status ${response.status}`, true);
    }
    if (response.status >= 400) {
      throw new GeminiRequestError(
        `Gemini API returned status ${response.status}: ${response.body}`,
        false,
      );
    }

    return response;
  }
}
