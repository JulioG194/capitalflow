import {
  isOriginAllowed,
  type OriginAllowlistConfig,
} from '@capitalflow/shared-types';

/**
 * Concrete shape this module always builds — the "object options" branch of
 * Socket.io's `cors?: CorsOptions | CorsOptionsDelegate` (from the `cors`
 * npm package, re-exported transitively via engine.io's `ServerOptions`).
 * Declared locally, rather than importing/extracting the type from
 * `ServerOptions['cors']`, so callers get back a concrete, readable type
 * instead of a union they'd have to narrow — `cors` itself isn't a declared
 * dependency of this app, only a transitive one, so we don't import from it
 * directly either.
 */
export interface MarketCorsOptions {
  origin: (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void,
  ) => void;
  credentials: true;
}

/**
 * Builds the Socket.io `cors` option object from the same allowlist rule
 * apps/api's `main.ts` uses (spec 006 AC10) — see
 * `@capitalflow/shared-types`'s `isOriginAllowed`. Consumed by
 * `MarketIoAdapter#createIOServer` (see `market-io.adapter.ts`); kept as its
 * own pure function so the origin-check logic can be unit-tested without
 * spinning up a real Socket.io server or Nest application context.
 */
export function buildMarketCorsOptions(
  config: OriginAllowlistConfig,
): MarketCorsOptions {
  return {
    origin: (origin, callback) => {
      if (isOriginAllowed(origin, config)) {
        callback(null, true);
        return;
      }
      callback(new Error('CORS: origin not allowed'));
    },
    credentials: true,
  };
}
