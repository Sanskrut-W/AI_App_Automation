export interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  /** Defaults to always retrying. Return false to fail immediately without exhausting maxRetries. */
  shouldRetry?: (error: unknown) => boolean;
  /** Called before each retry's delay, for logging. Not called on the initial (non-retry) attempt. */
  onRetry?: (attempt: number, error: unknown, delayMs: number) => void;
  sleepFn?: (ms: number) => Promise<void>;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Retries `fn` with exponential backoff (baseDelayMs * 2^attempt) until it succeeds or options are exhausted. */
export async function retryWithBackoff<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T> {
  const sleep = options.sleepFn ?? defaultSleep;
  let attempt = 0;

  for (;;) {
    try {
      return await fn();
    } catch (error) {
      const canRetry = options.shouldRetry ? options.shouldRetry(error) : true;
      if (!canRetry || attempt >= options.maxRetries) {
        throw error;
      }
      const delayMs = options.baseDelayMs * 2 ** attempt;
      options.onRetry?.(attempt + 1, error, delayMs);
      await sleep(delayMs);
      attempt += 1;
    }
  }
}
