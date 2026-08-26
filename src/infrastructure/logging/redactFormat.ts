import { format } from 'winston';

const SENSITIVE_KEYS = new Set([
  'apikey',
  'api_key',
  'token',
  'authorization',
  'password',
  'secret',
  'gemini_api_key',
]);

function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactValue);
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, val]) => [
        key,
        SENSITIVE_KEYS.has(key.toLowerCase()) ? '[REDACTED]' : redactValue(val),
      ]),
    );
  }
  return value;
}

/**
 * Mutates `info` in place (rather than returning a new object) so winston's internal
 * Symbol-keyed properties (level/message/splat markers) survive the transform chain.
 */
export const redactSensitiveData = format((info) => {
  const record = info as unknown as Record<string, unknown>;

  Object.keys(record).forEach((key) => {
    if (key === 'level' || key === 'message') {
      return;
    }
    record[key] = SENSITIVE_KEYS.has(key.toLowerCase()) ? '[REDACTED]' : redactValue(record[key]);
  });

  return info;
});
