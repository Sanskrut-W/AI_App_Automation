import { IRateLimiter } from '../../shared/rate-limit/IRateLimiter';
import { IClock } from '../../shared/time/IClock';

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Allows at most maxRequests calls to acquire() within any rolling windowMs period, delaying the caller otherwise. */
export class SlidingWindowRateLimiter implements IRateLimiter {
  private readonly timestamps: number[] = [];

  constructor(
    private readonly maxRequests: number,
    private readonly windowMs: number,
    private readonly clock: IClock,
    private readonly sleepFn: (ms: number) => Promise<void> = defaultSleep,
  ) {}

  async acquire(): Promise<void> {
    for (;;) {
      const now = this.clock.nowMs();
      this.prune(now);

      if (this.timestamps.length < this.maxRequests) {
        this.timestamps.push(now);
        return;
      }

      const oldest = this.timestamps[0];
      const waitMs = this.windowMs - (now - oldest);
      await this.sleepFn(Math.max(waitMs, 0));
    }
  }

  private prune(now: number): void {
    while (this.timestamps.length > 0 && now - this.timestamps[0] >= this.windowMs) {
      this.timestamps.shift();
    }
  }
}
