/**
 * Client-safe environment configuration. `NEXT_PUBLIC_*` vars are inlined at
 * build time by Next.js, so this is readable from both Server and Client
 * Components. Mirrors the pattern already used by `lib/site-config.ts`.
 *
 * Production (Vercel): leave `NEXT_PUBLIC_API_URL` unset/empty and set
 * server-only `API_UPSTREAM_URL` to the Render API. Browser fetches hit
 * same-origin `/auth`, `/portfolio`, `/health`; `next.config.ts` rewrites
 * them upstream so auth cookies land on the Vercel host (spec 006 cookie
 * fix). Local dev: `NEXT_PUBLIC_API_URL=http://localhost:3001` (direct).
 */

function normalizeBaseUrl(value: string | undefined, fallback: string): string {
  if (value === undefined || value.trim() === "") {
    return fallback;
  }
  return value.replace(/\/$/, "");
}

/**
 * Empty string in production (same-origin via rewrites). Non-empty absolute
 * URL in local/dev when talking to Nest directly.
 */
export const API_URL = normalizeBaseUrl(
  process.env.NEXT_PUBLIC_API_URL,
  process.env.NODE_ENV === "production" ? "" : "http://localhost:3001",
);

/**
 * Base URL of `apps/market-stream`'s Socket.io server (spec 003 section 4).
 * Remains a cross-origin WSS URL in production — socket auth is the Bearer
 * access token in the handshake, not cookies.
 */
export const MARKET_STREAM_URL = normalizeBaseUrl(
  process.env.NEXT_PUBLIC_MARKET_STREAM_URL,
  "http://localhost:3002",
);
