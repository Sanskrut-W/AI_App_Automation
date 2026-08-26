import { SlidingWindowRateLimiter } from '../../../../src/infrastructure/rate-limit/SlidingWindowRateLimiter';
import { IClock } from '../../../../src/shared/time/IClock';

function createMockClock(initial = 0): jest.Mocked<IClock> & { advance: (ms: number) => void } {
  let current = initial;
  return {
    now: jest.fn(() => new Date(current).toISOString()),
    nowMs: jest.fn(() => current),
    advance: (ms: number) => {
      current += ms;
    },
  };
}

describe('SlidingWindowRateLimiter', () => {
  it('allows requests up to the limit without delaying', async () => {
    const clock = createMockClock();
    const sleepFn = jest.fn().mockResolvedValue(undefined);
    const limiter = new SlidingWindowRateLimiter(3, 60000, clock, sleepFn);

    await limiter.acquire();
    await limiter.acquire();
    await limiter.acquire();

    expect(sleepFn).not.toHaveBeenCalled();
  });

  it('delays once the limit within the window is reached', async () => {
    const clock = createMockClock();
    const sleepFn = jest.fn().mockImplementation(async (ms: number) => {
      clock.advance(ms);
    });
    const limiter = new SlidingWindowRateLimiter(2, 1000, clock, sleepFn);

    await limiter.acquire();
    await limiter.acquire();
    await limiter.acquire();

    expect(sleepFn).toHaveBeenCalledTimes(1);
    expect(sleepFn).toHaveBeenCalledWith(1000);
  });

  it('allows a new request once the oldest timestamp has fallen out of the window', async () => {
    const clock = createMockClock();
    const sleepFn = jest.fn().mockResolvedValue(undefined);
    const limiter = new SlidingWindowRateLimiter(1, 1000, clock, sleepFn);

    await limiter.acquire();
    clock.advance(1000);
    await limiter.acquire();

    expect(sleepFn).not.toHaveBeenCalled();
  });
});
