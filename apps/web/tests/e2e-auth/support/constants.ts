import os from "node:os";
import path from "node:path";

/**
 * Port the dedicated e2e `apps/api` instance listens on (see
 * `global-setup.ts`). Matches the documented local-dev convention
 * (`.env.example`: `NEXT_PUBLIC_API_URL="http://localhost:3001"`, which is
 * also `apps/web/src/lib/env.ts`'s fallback default) and avoids the
 * unrelated Docker container already bound to :3000 on dev machines.
 */
export const API_E2E_PORT = 3001;
export const API_E2E_BASE_URL = `http://localhost:${API_E2E_PORT}`;

/**
 * Host+port of the Playwright-managed web server for this config (see
 * `playwright.auth.config.ts`). Deliberately "localhost" (not "127.0.0.1",
 * unlike the spec-001 config) so it matches `API_E2E_BASE_URL`'s hostname:
 * the refresh-token cookie the API sets is host-scoped, not port-scoped
 * (spec 002 section 4), so a matching hostname is what lets the browser
 * carry that cookie across the two different ports/origins involved here.
 */
export const WEB_E2E_PORT = 4310;
export const WEB_E2E_BASE_URL = `http://localhost:${WEB_E2E_PORT}`;

/**
 * Every account this suite creates uses an email under this reserved test
 * domain, so `global-setup.ts`'s teardown can delete exactly (and only)
 * those rows from the shared dev database afterwards without ever risking
 * real or Jest-created data.
 */
export const E2E_EMAIL_DOMAIN = "e2e.capitalflow.test";

/** Builds a unique-per-run email so parallel/repeated runs never collide. */
export function e2eEmail(label: string): string {
  return `e2e-${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@${E2E_EMAIL_DOMAIN}`;
}

/**
 * Where `global-setup.ts` pipes the live `apps/api` process's stdout/stderr
 * so the forgot-password test can read the `ConsoleEmailAdapter`'s logged
 * reset link (spec 002 AC34) — the only way to observe it, since raw reset
 * tokens are never persisted, only their SHA-256 hash (spec 002 section 4).
 */
export const API_E2E_LOG_FILE = path.join(
  os.tmpdir(),
  "capitalflow-api-e2e.log",
);
