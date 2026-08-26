import { retryWithBackoff } from '../../../../src/shared/retry/retryWithBackoff';

function createInstantSleep() {
  return jest.fn().mockResolvedValue(undefined);
}

describe('retryWithBackoff', () => {
  it('returns the result immediately when fn succeeds on the first attempt', async () => {
    const fn = jest.fn().mockResolvedValue('ok');

    const result = await retryWithBackoff(fn, { maxRetries: 3, baseDelayMs: 10 });

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries with exponential backoff until fn succeeds', async () => {
    const sleepFn = createInstantSleep();
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValue('ok');

    const result = await retryWithBackoff(fn, { maxRetries: 3, baseDelayMs: 10, sleepFn });

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
    expect(sleepFn).toHaveBeenNthCalledWith(1, 10);
    expect(sleepFn).toHaveBeenNthCalledWith(2, 20);
  });

  it('throws the last error once maxRetries is exhausted', async () => {
    const sleepFn = createInstantSleep();
    const error = new Error('always fails');
    const fn = jest.fn().mockRejectedValue(error);

    await expect(retryWithBackoff(fn, { maxRetries: 2, baseDelayMs: 5, sleepFn })).rejects.toBe(
      error,
    );
    expect(fn).toHaveBeenCalledTimes(3); // initial attempt + 2 retries
  });

  it('does not retry when shouldRetry returns false, even if attempts remain', async () => {
    const sleepFn = createInstantSleep();
    const error = new Error('non-retryable');
    const fn = jest.fn().mockRejectedValue(error);

    await expect(
      retryWithBackoff(fn, { maxRetries: 5, baseDelayMs: 5, sleepFn, shouldRetry: () => false }),
    ).rejects.toBe(error);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(sleepFn).not.toHaveBeenCalled();
  });

  it('invokes onRetry with the attempt number, error, and delay before each retry', async () => {
    const sleepFn = createInstantSleep();
    const onRetry = jest.fn();
    const error = new Error('transient');
    const fn = jest.fn().mockRejectedValueOnce(error).mockResolvedValue('ok');

    await retryWithBackoff(fn, { maxRetries: 3, baseDelayMs: 10, sleepFn, onRetry });

    expect(onRetry).toHaveBeenCalledWith(1, error, 10);
  });
});
