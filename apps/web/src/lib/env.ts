/**
 * Client-safe environment configuration. `NEXT_PUBLIC_API_URL` is inlined at
 * build time by Next.js, so this is readable from both Server and Client
 * Components. Mirrors the pattern already used by `lib/site-config.ts`.
 */

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ??
  "http://localhost:3001";
