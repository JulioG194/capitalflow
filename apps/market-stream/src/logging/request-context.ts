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
 *
 * Duplicated verbatim from `apps/api`'s copy (human-approved design
 * decision 1: small duplication between the two backend apps rather than
 * a shared package, since `@capitalflow/shared-types` is also imported by
 * `apps/web` and shouldn't gain a `@nestjs/common` dependency for this).
 */
export const requestContextStorage =
  new AsyncLocalStorage<RequestContextStore>();

/**
 * Returns the current request's id, or `undefined` when called outside an
 * active `AsyncLocalStorage` scope (e.g. a boot-time log, or any Socket.io
 * event handling — AC33 scopes `requestId` to HTTP requests only). Callers
 * must treat `undefined` as "omit the field entirely".
 */
export function getRequestId(): string | undefined {
  return requestContextStorage.getStore()?.requestId;
}
