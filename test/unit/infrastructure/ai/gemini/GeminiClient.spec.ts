import { GeminiClient } from '../../../../../src/infrastructure/ai/gemini/GeminiClient';
import { IHttpClient } from '../../../../../src/shared/http/IHttpClient';
import { IRateLimiter } from '../../../../../src/shared/rate-limit/IRateLimiter';
import { IGeminiPromptBuilder } from '../../../../../src/infrastructure/ai/gemini/IGeminiPromptBuilder';
import { IGeminiResponseParser } from '../../../../../src/infrastructure/ai/gemini/IGeminiResponseParser';
import { GeminiClientConfig } from '../../../../../src/infrastructure/ai/gemini/GeminiClientConfig';
import { GeminiClientError } from '../../../../../src/core/errors/GeminiClientError';
import { createMockLogger } from '../../../support/createMockLogger';

const CONFIG: GeminiClientConfig = {
  apiKey: 'FAKE_SECRET_KEY',
  model: 'gemini-2.5-flash',
  baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
  timeoutMs: 5000,
  maxRetries: 2,
  retryBackoffMs: 1,
  rateLimit: { maxRequests: 10, windowMs: 1000 },
};

function createMocks() {
  const httpClient: jest.Mocked<IHttpClient> = { request: jest.fn() };
  const promptBuilder: jest.Mocked<IGeminiPromptBuilder> = {
    build: jest.fn().mockReturnValue('{"contents":[]}'),
  };
  const responseParser: jest.Mocked<IGeminiResponseParser> = { parse: jest.fn() };
  const rateLimiter: jest.Mocked<IRateLimiter> = {
    acquire: jest.fn().mockResolvedValue(undefined),
  };
  const logger = createMockLogger();

  return { httpClient, promptBuilder, responseParser, rateLimiter, logger };
}

function createClient(
  mocks: ReturnType<typeof createMocks>,
  configOverrides: Partial<GeminiClientConfig> = {},
) {
  return new GeminiClient(
    mocks.httpClient,
    mocks.promptBuilder,
    mocks.responseParser,
    mocks.rateLimiter,
    mocks.logger,
    {
      ...CONFIG,
      ...configOverrides,
    },
  );
}

describe('GeminiClient', () => {
  it('builds the request, calls the API, and returns parsed JSON on success', async () => {
    const mocks = createMocks();
    mocks.httpClient.request.mockResolvedValue({ status: 200, body: 'raw-response' });
    mocks.responseParser.parse.mockReturnValue({ screenName: 'Home' });
    const client = createClient(mocks);

    const result = await client.generateJson({ prompt: 'Describe this screen.' });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toEqual({ screenName: 'Home' });
    expect(mocks.promptBuilder.build).toHaveBeenCalledWith({ prompt: 'Describe this screen.' });
    expect(mocks.rateLimiter.acquire).toHaveBeenCalledTimes(1);
    expect(mocks.httpClient.request).toHaveBeenCalledWith({
      url: `${CONFIG.baseUrl}/models/${CONFIG.model}:generateContent?key=${CONFIG.apiKey}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"contents":[]}',
      timeoutMs: CONFIG.timeoutMs,
    });
    expect(mocks.responseParser.parse).toHaveBeenCalledWith('raw-response');
  });

  it('retries on a 5xx response and succeeds once the API recovers', async () => {
    const mocks = createMocks();
    mocks.httpClient.request
      .mockResolvedValueOnce({ status: 503, body: 'unavailable' })
      .mockResolvedValueOnce({ status: 200, body: 'raw-response' });
    mocks.responseParser.parse.mockReturnValue({ ok: true });
    const client = createClient(mocks);

    const result = await client.generateJson({ prompt: 'test' });

    expect(result.isOk()).toBe(true);
    expect(mocks.httpClient.request).toHaveBeenCalledTimes(2);
    expect(mocks.rateLimiter.acquire).toHaveBeenCalledTimes(2);
  });

  it('retries on a 429 (rate limited) response', async () => {
    const mocks = createMocks();
    mocks.httpClient.request
      .mockResolvedValueOnce({ status: 429, body: 'too many requests' })
      .mockResolvedValueOnce({ status: 200, body: 'raw-response' });
    mocks.responseParser.parse.mockReturnValue({ ok: true });
    const client = createClient(mocks);

    const result = await client.generateJson({ prompt: 'test' });

    expect(result.isOk()).toBe(true);
    expect(mocks.httpClient.request).toHaveBeenCalledTimes(2);
  });

  it('retries on a network-level error from the HTTP client', async () => {
    const mocks = createMocks();
    mocks.httpClient.request
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValueOnce({ status: 200, body: 'raw-response' });
    mocks.responseParser.parse.mockReturnValue({ ok: true });
    const client = createClient(mocks);

    const result = await client.generateJson({ prompt: 'test' });

    expect(result.isOk()).toBe(true);
    expect(mocks.httpClient.request).toHaveBeenCalledTimes(2);
  });

  it('does not retry on a 4xx client error and fails immediately', async () => {
    const mocks = createMocks();
    mocks.httpClient.request.mockResolvedValue({ status: 400, body: 'invalid request' });
    const client = createClient(mocks);

    const result = await client.generateJson({ prompt: 'test' });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(GeminiClientError);
    expect(mocks.httpClient.request).toHaveBeenCalledTimes(1);
  });

  it('returns a GeminiClientError once retries are exhausted against a persistent 5xx', async () => {
    const mocks = createMocks();
    mocks.httpClient.request.mockResolvedValue({ status: 503, body: 'unavailable' });
    const client = createClient(mocks, { maxRetries: 2 });

    const result = await client.generateJson({ prompt: 'test' });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(GeminiClientError);
    expect(mocks.httpClient.request).toHaveBeenCalledTimes(3);
  });

  it('returns a GeminiClientError when the response parser rejects the content', async () => {
    const mocks = createMocks();
    mocks.httpClient.request.mockResolvedValue({ status: 200, body: 'raw-response' });
    mocks.responseParser.parse.mockImplementation(() => {
      throw new Error('not valid json');
    });
    const client = createClient(mocks);

    const result = await client.generateJson({ prompt: 'test' });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(GeminiClientError);
    expect(result.unwrapErr().message).toMatch(/not valid json/);
  });

  it('never logs the API key', async () => {
    const mocks = createMocks();
    mocks.httpClient.request.mockResolvedValue({ status: 200, body: 'raw-response' });
    mocks.responseParser.parse.mockReturnValue({ ok: true });
    const client = createClient(mocks);

    await client.generateJson({ prompt: 'test' });

    const allLoggedArgs = [
      ...mocks.logger.info.mock.calls,
      ...mocks.logger.warn.mock.calls,
      ...mocks.logger.error.mock.calls,
      ...mocks.logger.debug.mock.calls,
    ]
      .flat()
      .map((arg) => JSON.stringify(arg));

    expect(allLoggedArgs.some((entry) => entry.includes(CONFIG.apiKey))).toBe(false);
  });
});
