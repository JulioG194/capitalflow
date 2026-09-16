import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { e2eEmail } from "./support/constants";
import { seedQuote, clearQuote } from "./support/redis-seed";

/**
 * Spec 005 (`specs/005-invest-flow.md`) AC18-AC34 + section 8's Playwright
 * plan. Reuses the same live-`apps/api` `globalSetup`/`playwright.auth.config.ts`
 * this suite already boots for spec 002/004's flows (see `auth.spec.ts`,
 * `portfolio.spec.ts`) — no new Playwright config is introduced.
 *
 * The successful-invest scenario seeds a real price into the same Redis
 * instance `apps/api`'s `PortfolioService.invest` reads (`support/redis-seed.ts`)
 * rather than mocking `POST /portfolio/invest` itself, so that path exercises
 * the real endpoint end-to-end; only the error-path scenarios (422/503/429)
 * mock the response, since those are specific server outcomes this suite
 * cannot easily force through the real service (e.g. actually exhausting the
 * 30/hour invest rate limit).
 *
 * All tests below except the final unauthenticated-redirect one share a
 * single registered+logged-in session (one `registerAndLogin` call in
 * `beforeAll`, reused via one persistent `page`/`BrowserContext`) instead of
 * registering a fresh user per test. Spec 002's login throttle is IP-keyed
 * at 5 requests/60s, and this suite runs in the same single Playwright
 * worker as `auth.spec.ts` (3 logins) and `portfolio.spec.ts` (1 login) — a
 * naive per-test register+login here would push the shared 60s window over
 * that limit and intermittently 429 an unrelated spec's login.
 */

const INVEST_SYMBOL = "AAPL";
const INVEST_PRICE = "150.00";

async function registerAndLogin(page: Page, label: string): Promise<void> {
  const email = e2eEmail(label);
  const password = "Password123";

  await page.goto("/register");
  await page.getByLabel("Name").fill("Ada Lovelace");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/login\?registered=1$/);

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/app\/profile$/);
}

interface MockInvestResponse {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
}

test.describe.serial("authenticated /app/invest", () => {
  let context: BrowserContext;
  let page: Page;
  let investCalls = 0;
  let mockResponse: MockInvestResponse | null = null;

  test.beforeAll(async ({ browser }) => {
    await seedQuote(INVEST_SYMBOL, INVEST_PRICE);

    context = await browser.newContext();
    page = await context.newPage();
    await registerAndLogin(page, "invest-flow");

    // A single route handler for the whole describe block: passes through
    // to the real API (counting calls) unless a test has set `mockResponse`.
    await page.route("**/portfolio/invest", async (route) => {
      if (mockResponse) {
        await route.fulfill({
          status: mockResponse.status,
          contentType: "application/json",
          headers: mockResponse.headers,
          body: JSON.stringify(mockResponse.body),
        });
        return;
      }
      investCalls += 1;
      await route.continue();
    });
  });

  test.afterAll(async () => {
    await clearQuote(INVEST_SYMBOL);
    await context.close();
  });

  test("calculator never calls the invest endpoint (AC18-AC22)", async () => {
    await page.goto("/app/invest");
    await expect(page.getByRole("heading", { name: "Invest" })).toBeVisible();

    await page.getByLabel("Simulated amount").fill("1000");
    await page.getByLabel("Plan").selectOption("agresivo");
    await page.getByLabel("Term (months)").fill("24");
    await expect(page.getByText(/Illustrative estimate, not guaranteed/)).toBeVisible();

    expect(investCalls).toBe(0);
  });

  test("a confirmed invest updates the balance without a reload (AC23-AC27)", async () => {
    await page.goto("/app/invest");
    await expect(page.getByText("$10,000.00").first()).toBeVisible();

    await page.getByLabel("Symbol").selectOption(INVEST_SYMBOL);
    await page.getByLabel("Amount to invest").fill("100.00");
    await page.getByRole("button", { name: "Invest" }).click();

    const dialog = page.getByRole("dialog", { name: "Confirm investment" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(INVEST_SYMBOL)).toBeVisible();
    await expect(dialog.getByText("$100.00")).toBeVisible();

    await dialog.getByRole("button", { name: "Confirm" }).click();
    await expect(dialog.getByText("Simulated investment placed")).toBeVisible();
    await expect(dialog).not.toBeVisible();

    // Balance reflects the new investment via a client-side refetch, no page reload.
    await expect(page.getByText("$9,900.00")).toBeVisible();
    expect(investCalls).toBe(1);
  });

  test("422 INSUFFICIENT_FUNDS keeps the modal open with the entered amount (AC28)", async () => {
    mockResponse = {
      status: 422,
      body: { message: "Insufficient funds", code: "INSUFFICIENT_FUNDS" },
    };

    await page.goto("/app/invest");
    await page.getByLabel("Symbol").selectOption(INVEST_SYMBOL);
    await page.getByLabel("Amount to invest").fill("150.00");
    await page.getByRole("button", { name: "Invest" }).click();

    const dialog = page.getByRole("dialog", { name: "Confirm investment" });
    await dialog.getByRole("button", { name: "Confirm" }).click();

    await expect(dialog.getByRole("alert")).toContainText("You don't have enough simulated cash");
    await expect(dialog).toBeVisible();
    await expect(page.getByLabel("Amount to invest")).toHaveValue("150.00");

    mockResponse = null;
  });

  test("503 PRICE_UNAVAILABLE keeps the modal open with a retry-oriented message (AC29)", async () => {
    mockResponse = {
      status: 503,
      body: { message: "Price unavailable", code: "PRICE_UNAVAILABLE" },
    };

    await page.goto("/app/invest");
    await page.getByLabel("Symbol").selectOption(INVEST_SYMBOL);
    await page.getByLabel("Amount to invest").fill("50.00");
    await page.getByRole("button", { name: "Invest" }).click();

    const dialog = page.getByRole("dialog", { name: "Confirm investment" });
    await dialog.getByRole("button", { name: "Confirm" }).click();

    await expect(dialog.getByRole("alert")).toContainText("Please try again");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(INVEST_SYMBOL)).toBeVisible();
    await expect(dialog.getByText("$50.00")).toBeVisible();

    mockResponse = null;
  });

  test("429 too many requests surfaces a wait time derived from Retry-After (AC30)", async () => {
    mockResponse = {
      status: 429,
      body: { message: "Too many requests" },
      // `Access-Control-Expose-Headers` is required alongside `Retry-After`
      // itself: this is a cross-origin `fetch()` (spec 002's cookie/CORS
      // setup puts `apps/web` and `apps/api` on different origins), and
      // `Retry-After` is not on the browser's CORS response-header
      // safelist — without exposing it explicitly, `Response.headers.get()`
      // returns `null` for it even though the header is physically present
      // on the wire. See this file's final comment: the real `apps/api`
      // (`main.ts`'s `app.enableCors()`) does not currently set this either.
      headers: { "Retry-After": "37", "Access-Control-Expose-Headers": "Retry-After" },
    };

    await page.goto("/app/invest");
    await page.getByLabel("Symbol").selectOption(INVEST_SYMBOL);
    await page.getByLabel("Amount to invest").fill("25.00");
    await page.getByRole("button", { name: "Invest" }).click();

    const dialog = page.getByRole("dialog", { name: "Confirm investment" });
    await dialog.getByRole("button", { name: "Confirm" }).click();

    const alert = dialog.getByRole("alert");
    await expect(alert).toContainText("Too many investment attempts");
    await expect(alert).toContainText("37 seconds");

    mockResponse = null;
  });
});

test.describe("unauthenticated access to /app/invest", () => {
  test("redirects to /login, preserving the original path as ?redirect= (AC34)", async ({
    page,
  }) => {
    await page.goto("/app/invest");
    await expect(page).toHaveURL(/\/login\?redirect=%2Fapp%2Finvest$/);
  });
  // NOTE: the AC30 test above adds `Access-Control-Expose-Headers:
  // Retry-After` to its *mocked* 429 response, matching what the real
  // `apps/api` now sends — `src/main.ts`'s `app.enableCors()` sets
  // `exposedHeaders: ["Retry-After"]` (fixed in 59d1ab5), so `apps/web`'s
  // cross-origin `fetch()` can read a real `Retry-After` header from this
  // endpoint and from spec 002's identically-shaped login throttle.
});
