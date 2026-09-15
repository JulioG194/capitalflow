import { nextBackoffMs } from './backoff';

describe('nextBackoffMs (AC11/AC13)', () => {
  it('AC11: each successive delay is strictly greater until the cap', () => {
    const delays = [0, 1, 2, 3, 4].map((attempt) =>
      nextBackoffMs(attempt, 1000, 2, 30_000),
    );
    expect(delays).toEqual([1000, 2000, 4000, 8000, 16000]);
    for (let i = 1; i < delays.length; i += 1) {
      expect(delays[i]).toBeGreaterThan(delays[i - 1]!);
    }
  });

  it('AC11: delays never exceed the configured max cap', () => {
    expect(nextBackoffMs(10, 1000, 2, 30_000)).toBe(30_000);
    expect(nextBackoffMs(20, 1000, 2, 30_000)).toBe(30_000);
  });

  it('AC13: attempt 0 after a reset returns the base delay, not the capped value', () => {
    expect(nextBackoffMs(8, 1000, 2, 30_000)).toBe(30_000);
    expect(nextBackoffMs(0, 1000, 2, 30_000)).toBe(1000);
  });
});
