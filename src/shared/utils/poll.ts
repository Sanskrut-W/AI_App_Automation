export interface PollOptions {
  timeoutMs: number;
  intervalMs: number;
}

/** Calls `check` until it resolves to a defined, non-null value, or the timeout elapses (resolves null). */
export async function pollUntil<T>(
  check: () => Promise<T | null | undefined>,
  options: PollOptions,
): Promise<T | null> {
  const deadline = Date.now() + options.timeoutMs;

  for (;;) {
    const result = await check();
    if (result !== null && result !== undefined) {
      return result;
    }
    if (Date.now() >= deadline) {
      return null;
    }
    await sleep(options.intervalMs);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
