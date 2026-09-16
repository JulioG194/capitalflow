import { AsyncLocalStorage } from 'node:async_hooks';

/** Store carried through a single HTTP request's async call chain. */
export interface RequestContextStore {
  requestId: string;
}

/**
 * Spec 006 AC33/design decision 4: `requestId` is propagated purely via
 * `AsyncLocalStorage` — never threaded through service method signatures,
 * never a module-level mutable variable. `RequestIdMiddleware` is the only
 * writer (`.run(...)`); `JsonLoggerService` is the only reader.
 */
export const requestContextStorage =
  new AsyncLocalStorage<RequestContextStore>();

/**
 * Returns the current request's id, or `undefined` when called outside an
 * active `AsyncLocalStorage` scope (e.g. a boot-time log). Callers must
 * treat `undefined` as "omit the field entirely" — never serialize it as
 * `null`/`""`/the literal string `"undefined"`.
 */
export function getRequestId(): string | undefined {
  return requestContextStorage.getStore()?.requestId;
}
