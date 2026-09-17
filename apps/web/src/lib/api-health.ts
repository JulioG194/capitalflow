/**
 * Tiny pub/sub for API reachability during the first minute of a browser
 * session (spec 006 AC23). `authFetch` reports success/failure; the
 * cold-start banner subscribes and shows "waking up" only for network /
 * 502 / 503 failures before the first successful response.
 */

export type ApiHealthState = {
  waking: boolean;
  /** Epoch ms when this tab's cold-start window opened. */
  sessionStartedAt: number;
};

const COLD_START_WINDOW_MS = 60_000;

type Listener = (state: ApiHealthState) => void;

const sessionStartedAt = Date.now();
let waking = false;
const listeners = new Set<Listener>();

function notify(): void {
  const state: ApiHealthState = { waking, sessionStartedAt };
  for (const listener of listeners) {
    listener(state);
  }
}

function withinColdStartWindow(): boolean {
  return Date.now() - sessionStartedAt < COLD_START_WINDOW_MS;
}

export function subscribeToApiHealth(listener: Listener): () => void {
  listeners.add(listener);
  listener({ waking, sessionStartedAt });
  return () => {
    listeners.delete(listener);
  };
}

export function reportApiSuccess(): void {
  if (!waking) return;
  waking = false;
  notify();
}

export function reportApiFailure(status?: number): void {
  if (!withinColdStartWindow()) return;
  if (status !== undefined && status !== 502 && status !== 503) return;
  if (waking) return;
  waking = true;
  notify();
}

export function isWithinColdStartWindow(): boolean {
  return withinColdStartWindow();
}
