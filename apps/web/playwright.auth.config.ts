import { defineConfig, devices } from "@playwright/test";
import { WEB_E2E_BASE_URL } from "./tests/e2e-auth/support/constants";

/**
 * Dedicated Playwright config for spec 002's auth e2e flows (register →
 * login → profile → logout; unauthenticated `/app/*` redirect;
 * forgot/reset-password). Separate from `playwright.config.ts` (spec 001's
 * landing-page suite, which never calls the API) for two reasons:
 *
 * 1. Spec 001's config builds+serves `apps/web` on `127.0.0.1:4310` with no
 *    backend at all — adding a live `apps/api` dependency to every run of
 *    that suite would be pure overhead (and a new failure mode) for tests
 *    that don't need it.
 * 2. The auth flows need the refresh-token cookie to be visible to both
 *    the web app (via `middleware.ts`) and the API (via `POST
 *    /auth/refresh`/`/auth/logout`) — since that cookie is host-scoped,
 *    not origin-scoped, this config deliberately uses "localhost" (see
 *    `WEB_E2E_BASE_URL`) rather than spec-001's "127.0.0.1" for both, so
 *    the cookie set by `apps/api` on one port is sent by the browser on
 *    requests to the other.
 *
 * `globalSetup` boots the live `apps/api` process this suite talks to (see
 * `tests/e2e-auth/support/global-setup.ts`) and returns its own teardown
 * (process shutdown + best-effort test-user cleanup).
 */
export default defineConfig({
  testDir: "./tests/e2e-auth",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  timeout: 30_000,
  globalSetup: "./tests/e2e-auth/support/global-setup.ts",
  use: {
    baseURL: WEB_E2E_BASE_URL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "auth-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // Same production-build pattern as `playwright.config.ts` — reflects
    // what actually ships. `NEXT_PUBLIC_API_URL` isn't set explicitly:
    // `apps/web/src/lib/env.ts`'s own fallback default
    // ("http://localhost:3001") already matches `API_E2E_PORT`.
    command: `pnpm build && PORT=${new URL(WEB_E2E_BASE_URL).port} pnpm start`,
    url: WEB_E2E_BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
