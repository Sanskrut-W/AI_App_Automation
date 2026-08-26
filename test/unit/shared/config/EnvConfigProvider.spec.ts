import path from 'path';
import { EnvConfigProvider } from '../../../../src/shared/config/EnvConfigProvider';
import { ConfigValidationError } from '../../../../src/shared/config/ConfigValidationError';

describe('EnvConfigProvider', () => {
  const configDir = path.resolve(__dirname, '../../../fixtures/config');
  // Isolates every test from the real project-root .env (which is present on a developer's
  // machine once they've configured GEMINI_API_KEY etc.) — these tests assert on file-based
  // config precedence and must not be affected by whatever real env vars happen to be set.
  const envFilePath = path.resolve(configDir, '.env.does-not-exist');

  afterEach(() => {
    delete process.env.LOGGING_LEVEL;
  });

  it('merges default and environment-specific config, with env-specific values taking precedence', () => {
    const provider = new EnvConfigProvider({ configDir, envFilePath });

    expect(provider.get('app.name')).toBe('mobile-testing-platform');
    expect(provider.get('logging.level')).toBe('debug');
  });

  it('falls back to a default value when a key is missing', () => {
    const provider = new EnvConfigProvider({ configDir, envFilePath });

    expect(provider.getOrDefault('logging.transport', 'console')).toBe('console');
  });

  it('throws ConfigValidationError when get() is called on a missing key', () => {
    const provider = new EnvConfigProvider({ configDir, envFilePath });

    expect(() => provider.get('does.not.exist')).toThrow(ConfigValidationError);
  });

  it('throws during validate() when a required key is missing', () => {
    const provider = new EnvConfigProvider({
      configDir,
      envFilePath,
      requiredKeys: ['does.not.exist'],
    });

    expect(() => provider.validate()).toThrow(ConfigValidationError);
  });

  it('does not throw during validate() when all required keys are present', () => {
    const provider = new EnvConfigProvider({
      configDir,
      envFilePath,
      requiredKeys: ['logging.level'],
    });

    expect(() => provider.validate()).not.toThrow();
  });

  it('prefers an environment variable override over file-based config', () => {
    process.env.LOGGING_LEVEL = 'warn';
    const provider = new EnvConfigProvider({ configDir, envFilePath });

    expect(provider.get('logging.level')).toBe('warn');
  });
});
