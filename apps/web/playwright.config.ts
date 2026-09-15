import { defineConfig, devices } from "@playwright/test";

/**
 * E2E config for the marketing site. Runs against a production build
 * (`next build && next start`) rather than the dev server so ISR/static
 * rendering, bundle sizes, and no-JS SSR checks reflect what ships (AC8, AC16,
 * AC19).
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4310",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"] },
    },
  ],
  webServer: {
    // Port 3000 is occupied by an unrelated local Docker container on some
    // dev machines; 4310 avoids the collision. Next.js reads PORT from env.
    command: "pnpm build && PORT=4310 pnpm start",
    url: "http://127.0.0.1:4310",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
