export interface IRateLimiter {
  /** Resolves once it's safe to proceed — may delay internally to stay within the configured limit. */
  acquire(): Promise<void>;
}
