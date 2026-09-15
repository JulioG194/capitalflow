import { test, expect } from "@playwright/test";

const MARKETING_ROUTES = [
  "/",
  "/how-it-works",
  "/about",
  "/pricing",
  "/terms",
  "/privacy",
];

const DISCLAIMER_TEXT =
  "Simulador de inversiones con fines educativos. No se manejan fondos reales.";

test.describe("Simulator disclaimer visible on every marketing page (AC5)", () => {
  for (const route of MARKETING_ROUTES) {
    test(`${route} shows the exact disclaimer text`, async ({ page }) => {
      await page.goto(route);
      await expect(page.getByText(DISCLAIMER_TEXT).first()).toBeVisible();
    });
  }
});
