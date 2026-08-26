import path from 'path';
import { EnvConfigProvider } from '../../../../../src/shared/config/EnvConfigProvider';
import { loadGeminiConfig } from '../../../../../src/infrastructure/ai/gemini/GeminiClientConfig';
import { ConfigValidationError } from '../../../../../src/shared/config/ConfigValidationError';

describe('loadGeminiConfig', () => {
  const configDir = path.resolve(__dirname, '../../../../fixtures/config');
  // Isolates every test from the real project-root .env (which has a real GEMINI_API_KEY once a
  // developer has configured one) — these tests assert on env-var precedence/absence and must
  // not be affected by whatever real .env happens to exist on the machine running them.
  const envFilePath = path.resolve(configDir, '.env.does-not-exist');

  afterEach(() => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.AI_GEMINI_MODEL;
  });

  it('throws when GEMINI_API_KEY is not set (fails fast)', () => {
    const configProvider = new EnvConfigProvider({ configDir, envFilePath });

    expect(() => loadGeminiConfig(configProvider)).toThrow(ConfigValidationError);
  });

  it('reads the API key from the environment and applies sensible defaults', () => {
    process.env.GEMINI_API_KEY = 'test-key-123';
    const configProvider = new EnvConfigProvider({ configDir, envFilePath });

    const config = loadGeminiConfig(configProvider);

    expect(config.apiKey).toBe('test-key-123');
    expect(config.model).toBe('gemini-2.5-flash');
    expect(config.baseUrl).toBe('https://generativelanguage.googleapis.com/v1beta');
    expect(config.timeoutMs).toBe(30000);
    expect(config.maxRetries).toBe(3);
    expect(config.retryBackoffMs).toBe(1000);
    expect(config.rateLimit).toEqual({ maxRequests: 15, windowMs: 60000 });
  });

  it('allows overriding defaults via environment variables', () => {
    process.env.GEMINI_API_KEY = 'test-key-123';
    process.env.AI_GEMINI_MODEL = 'gemini-1.5-pro';
    const configProvider = new EnvConfigProvider({ configDir, envFilePath });

    const config = loadGeminiConfig(configProvider);

    expect(config.model).toBe('gemini-1.5-pro');
  });
});
