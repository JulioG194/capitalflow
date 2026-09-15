import { test, expect } from "@playwright/test";

/**
 * AC8: marketing pages render fully server-side and are usable with
 * JavaScript disabled. Uses a Playwright browser context with
 * `javaScriptEnabled: false` rather than `curl`, since it also verifies CTA
 * links are real navigable <a> elements, not just present markup.
 */
test.describe("Homepage renders and is navigable with JavaScript disabled (AC8)", () => {
  test("hero content and CTA are present without JS", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();

    await page.goto("/");

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Aprende a invertir sin arriesgar un solo peso real",
      }),
    ).toBeVisible();

    const registerCta = page.getByRole("link", { name: "Registrarse gratis" }).first();
    await expect(registerCta).toBeVisible();
    await expect(registerCta).toHaveAttribute("href", "/register");

    await expect(
      page.getByText(
        "Simulador de inversiones con fines educativos. No se manejan fondos reales.",
      ).first(),
    ).toBeVisible();

    await context.close();
  });

  test("CTA link navigates to /register without JS (real <a>, not onClick)", async ({
    browser,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();

    await page.goto("/");
    await page.getByRole("link", { name: "Registrarse gratis" }).first().click();
    await expect(page).toHaveURL(/\/register$/);

    await context.close();
  });
});
