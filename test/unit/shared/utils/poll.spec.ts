import { pollUntil } from '../../../../src/shared/utils/poll';

describe('pollUntil', () => {
  it('returns immediately when check() succeeds on the first call', async () => {
    const check = jest.fn().mockResolvedValue('immediate');

    const result = await pollUntil(check, { timeoutMs: 1000, intervalMs: 50 });

    expect(result).toBe('immediate');
    expect(check).toHaveBeenCalledTimes(1);
  });

  it('retries until check() returns a non-null/undefined value', async () => {
    let calls = 0;
    const check = jest.fn().mockImplementation(async () => {
      calls += 1;
      return calls >= 3 ? 'done' : null;
    });

    const result = await pollUntil(check, { timeoutMs: 1000, intervalMs: 5 });

    expect(result).toBe('done');
    expect(calls).toBe(3);
  });

  it('treats undefined the same as null and keeps retrying', async () => {
    let calls = 0;
    const check = jest.fn().mockImplementation(async () => {
      calls += 1;
      return calls >= 2 ? 42 : undefined;
    });

    const result = await pollUntil(check, { timeoutMs: 1000, intervalMs: 5 });

    expect(result).toBe(42);
  });

  it('returns null once the timeout elapses without a successful check', async () => {
    const check = jest.fn().mockResolvedValue(null);

    const result = await pollUntil(check, { timeoutMs: 30, intervalMs: 10 });

    expect(result).toBeNull();
  });
});
