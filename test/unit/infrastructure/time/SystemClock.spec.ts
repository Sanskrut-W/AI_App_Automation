import { SystemClock } from '../../../../src/infrastructure/time/SystemClock';

describe('SystemClock', () => {
  it('returns the current time as an ISO-8601 string', () => {
    const clock = new SystemClock();
    const before = Date.now();

    const result = clock.now();
    const parsed = Date.parse(result);

    expect(Number.isNaN(parsed)).toBe(false);
    expect(parsed).toBeGreaterThanOrEqual(before - 1000);
    expect(result).toBe(new Date(parsed).toISOString());
  });

  it('returns the current time as epoch milliseconds', () => {
    const clock = new SystemClock();
    const before = Date.now();

    const result = clock.nowMs();

    expect(result).toBeGreaterThanOrEqual(before);
    expect(result).toBeLessThanOrEqual(Date.now());
  });
});
