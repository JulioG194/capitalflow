/**
 * Exponential reconnect delay (spec 003 AC11/AC13). `attempt` is 0-based:
 * the first retry uses `baseMs`, each subsequent retry multiplies by
 * `multiplier`, capped at `maxMs`. A successful reconnect resets `attempt`
 * to 0 (AC13) — that reset lives in FinnhubService, not here.
 */
export function nextBackoffMs(
  attempt: number,
  baseMs: number,
  multiplier: number,
  maxMs: number,
): number {
  const delay = baseMs * multiplier ** attempt;
  return Math.min(delay, maxMs);
}
