/**
 * Client-safe environment configuration. `NEXT_PUBLIC_API_URL` is inlined at
 * build time by Next.js, so this is readable from both Server and Client
 * Components. Mirrors the pattern already used by `lib/site-config.ts`.
 */

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ??
  "http://localhost:3001";

/**
 * Base URL of `apps/market-stream`'s Socket.io server (spec 003 section 4).
 * Browser-visible like `API_URL` above. Placeholder default port (3002) —
 * `apps/market-stream`'s own bootstrap still defaults to the unmodified Nest
 * skeleton's port 3000, which would collide with `apps/web`'s dev server;
 * this fallback assumes that gets resolved once the backend spec lands.
 */
export const MARKET_STREAM_URL =
  process.env.NEXT_PUBLIC_MARKET_STREAM_URL?.replace(/\/$/, "") ??
  "http://localhost:3002";
