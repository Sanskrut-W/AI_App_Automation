import { redactSensitiveData } from '../../../../src/infrastructure/logging/redactFormat';

describe('redactSensitiveData', () => {
  it('redacts known sensitive keys while preserving other fields', () => {
    const transform = redactSensitiveData();
    const info = { level: 'info', message: 'test', apiKey: 'secret-value', user: 'alice' };

    const result = transform.transform(info, {}) as Record<string, unknown>;

    expect(result.apiKey).toBe('[REDACTED]');
    expect(result.user).toBe('alice');
    expect(result.message).toBe('test');
  });

  it('redacts sensitive keys nested inside metadata objects', () => {
    const transform = redactSensitiveData();
    const info = {
      level: 'info',
      message: 'login attempt',
      credentials: { token: 'abc123', username: 'bob' },
    };

    const result = transform.transform(info, {}) as Record<string, unknown>;
    const credentials = result.credentials as Record<string, unknown>;

    expect(credentials.token).toBe('[REDACTED]');
    expect(credentials.username).toBe('bob');
  });
});
