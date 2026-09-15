import { test, expect } from "@playwright/test";
import { e2eEmail } from "./support/constants";

/**
 * Spec 004 (`specs/004-portfolio.md`) AC31 + section 8's Playwright plan.
 * Reuses the same live-`apps/api` `globalSetup`/`playwright.auth.config.ts`
 * this suite already boots for spec 002's flows (see `auth.spec.ts`) — no
 * new Playwright config is introduced.
 */

test.describe("register → login → view /app/portfolio baseline", () => {
  const email = e2eEmail("portfolio-flow");
  const password = "Password123";

  test("shows the $10,000 baseline summary, single cash slice, empty holdings, one deposit", async ({
    page,
  }) => {
    // --- Register + log in (spec 002 AC1/AC6) ---
    await page.goto("/register");
    await page.getByLabel("Nombre").fill("Katherine Johnson");
    await page.getByLabel("Correo electrónico").fill(email);
    await page.getByLabel("Contraseña").fill(password);
    await page.getByRole("button", { name: "Crear cuenta" }).click();
    await expect(page).toHaveURL(/\/login\?registered=1$/);

    await page.getByLabel("Correo electrónico").fill(email);
    await page.getByLabel("Contraseña").fill(password);
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await expect(page).toHaveURL(/\/app\/profile$/);

    // --- Navigate to /app/portfolio (spec 004 AC22) ---
    await page.goto("/app/portfolio");
    await expect(page.getByRole("heading", { name: "Mi cartera" })).toBeVisible();

    // --- Summary: $10,000 baseline, zero profit/ROI (AC4, AC25) ---
    await expect(page.getByText("Efectivo disponible")).toBeVisible();
    await expect(page.getByText("$10,000.00").first()).toBeVisible();
    await expect(page.getByText("ROI: 0.00%")).toBeVisible();

    // --- Allocation: a single "cash" slice at 100% (AC4, AC26) ---
    await expect(page.getByRole("img", { name: /distribución de la cartera/ })).toBeVisible();
    await expect(page.getByText("Efectivo — 100.00%")).toBeVisible();

    // --- Holdings: empty (AC12, AC27) ---
    await expect(page.getByText("Todavía no tienes posiciones activas.")).toBeVisible();

    // --- Transactions: exactly one deposit (AC2, AC28) ---
    await expect(page.getByText("Depósito")).toBeVisible();
    await expect(page.getByText("Completada")).toBeVisible();
  });
});

test.describe("unauthenticated access to /app/portfolio", () => {
  test("redirects to /login, preserving the original path as ?redirect= (AC31)", async ({
    page,
  }) => {
    await page.goto("/app/portfolio");
    await expect(page).toHaveURL(/\/login\?redirect=%2Fapp%2Fportfolio$/);
  });
});
