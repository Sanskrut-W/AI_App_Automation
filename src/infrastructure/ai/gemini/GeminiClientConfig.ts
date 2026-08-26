import { IConfigProvider } from '../../../shared/config/IConfigProvider';

export interface GeminiRateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export interface GeminiClientConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
  timeoutMs: number;
  maxRetries: number;
  retryBackoffMs: number;
  rateLimit: GeminiRateLimitConfig;
}

/**
 * GEMINI_API_KEY is read as a literal env-var-style key: EnvConfigProvider upper-cases and
 * dot-replaces whatever key string it's given, so passing this exact literal resolves straight
 * to process.env.GEMINI_API_KEY without needing it to also exist in a JSON config file. Fails
 * fast (via IConfigProvider.get) if the key is missing — never optional, never defaulted.
 */
export function loadGeminiConfig(configProvider: IConfigProvider): GeminiClientConfig {
  return {
    apiKey: configProvider.get<string>('GEMINI_API_KEY'),
    model: configProvider.getOrDefault('ai.gemini.model', 'gemini-2.5-flash'),
    baseUrl: configProvider.getOrDefault(
      'ai.gemini.baseUrl',
      'https://generativelanguage.googleapis.com/v1beta',
    ),
    timeoutMs: configProvider.getOrDefault('ai.gemini.timeoutMs', 30000),
    maxRetries: configProvider.getOrDefault('ai.gemini.maxRetries', 3),
    retryBackoffMs: configProvider.getOrDefault('ai.gemini.retryBackoffMs', 1000),
    rateLimit: {
      maxRequests: configProvider.getOrDefault('ai.gemini.rateLimit.maxRequests', 15),
      windowMs: configProvider.getOrDefault('ai.gemini.rateLimit.windowMs', 60000),
    },
  };
}
