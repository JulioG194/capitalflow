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
  await page.getByLabel("Nombre").fill("Ada Lovelace");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(page).toHaveURL(/\/login\?registered=1$/);

  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
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
    await expect(page.getByRole("heading", { name: "Invertir" })).toBeVisible();

    await page.getByLabel("Monto simulado").fill("1000");
    await page.getByLabel("Plan").selectOption("agresivo");
    await page.getByLabel("Plazo (meses)").fill("24");
    await expect(page.getByText(/Estimación ilustrativa, no garantizada/)).toBeVisible();

    expect(investCalls).toBe(0);
  });

  test("a confirmed invest updates the balance without a reload (AC23-AC27)", async () => {
    await page.goto("/app/invest");
    await expect(page.getByText("$10,000.00").first()).toBeVisible();

    await page.getByLabel("Símbolo").selectOption(INVEST_SYMBOL);
    await page.getByLabel("Monto a invertir").fill("100.00");
    await page.getByRole("button", { name: "Invertir" }).click();

    const dialog = page.getByRole("dialog", { name: "Confirmar inversión" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(INVEST_SYMBOL)).toBeVisible();
    await expect(dialog.getByText("$100.00")).toBeVisible();

    await dialog.getByRole("button", { name: "Confirmar" }).click();
    await expect(dialog.getByText("Inversión simulada realizada")).toBeVisible();
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
    await page.getByLabel("Símbolo").selectOption(INVEST_SYMBOL);
    await page.getByLabel("Monto a invertir").fill("150.00");
    await page.getByRole("button", { name: "Invertir" }).click();

    const dialog = page.getByRole("dialog", { name: "Confirmar inversión" });
    await dialog.getByRole("button", { name: "Confirmar" }).click();

    await expect(dialog.getByRole("alert")).toContainText("No tienes suficiente efectivo simulado");
    await expect(dialog).toBeVisible();
    await expect(page.getByLabel("Monto a invertir")).toHaveValue("150.00");

    mockResponse = null;
  });

  test("503 PRICE_UNAVAILABLE keeps the modal open with a retry-oriented message (AC29)", async () => {
    mockResponse = {
      status: 503,
      body: { message: "Price unavailable", code: "PRICE_UNAVAILABLE" },
    };

    await page.goto("/app/invest");
    await page.getByLabel("Símbolo").selectOption(INVEST_SYMBOL);
    await page.getByLabel("Monto a invertir").fill("50.00");
    await page.getByRole("button", { name: "Invertir" }).click();

    const dialog = page.getByRole("dialog", { name: "Confirmar inversión" });
    await dialog.getByRole("button", { name: "Confirmar" }).click();

    await expect(dialog.getByRole("alert")).toContainText("Inténtalo de nuevo");
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
    await page.getByLabel("Símbolo").selectOption(INVEST_SYMBOL);
    await page.getByLabel("Monto a invertir").fill("25.00");
    await page.getByRole("button", { name: "Invertir" }).click();

    const dialog = page.getByRole("dialog", { name: "Confirmar inversión" });
    await dialog.getByRole("button", { name: "Confirmar" }).click();

    const alert = dialog.getByRole("alert");
    await expect(alert).toContainText("demasiados intentos");
    await expect(alert).toContainText("37 segundos");

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
  // NOTE (flagged, not silently worked around): the AC30 test above had to
  // add `Access-Control-Expose-Headers: Retry-After` to its *mocked* 429
  // response to make `Response.headers.get("Retry-After")` readable at all
  // from `apps/web`. The real `apps/api` (`src/main.ts`'s `app.enableCors()`)
  // does not set `exposedHeaders`, so in the deployed app (where `apps/web`
  // and `apps/api` are different origins) the frontend's `fetch()` cannot
  // actually read a real `Retry-After` header today, for this endpoint or
  // for spec 002's identically-shaped login throttle. `ConfirmInvestModal`'s
  // `retryAfterSeconds`-derived copy is implemented correctly and degrades
  // gracefully (the generic "too many attempts" message still renders, just
  // without a specific wait time) when the header is invisible, but the
  // AC30 behavior of *surfacing a wait time* only works once `apps/api` adds
  // `exposedHeaders: ["Retry-After"]` to its CORS config — out of scope for
  // this frontend-only task (`apps/api` is explicitly off-limits here), but
  // worth fixing there before relying on this behavior in production.
});
