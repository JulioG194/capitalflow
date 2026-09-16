import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const MARKETING_ROUTES = [
  "/",
  "/how-it-works",
  "/about",
  "/pricing",
  "/terms",
  "/privacy",
];

test.describe("Accessibility (AC20, AC21, AC22): zero critical/serious axe violations", () => {
  for (const route of MARKETING_ROUTES) {
    test(`${route} has no critical or serious axe violations`, async ({
      page,
    }) => {
      await page.goto(route);

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();

      const seriousOrCritical = results.violations.filter((v) =>
        ["critical", "serious"].includes(v.impact ?? ""),
      );

      expect(
        seriousOrCritical,
        JSON.stringify(seriousOrCritical, null, 2),
      ).toEqual([]);
    });
  }
});

test.describe("Heading hierarchy (AC20): exactly one <h1>, no level skips", () => {
  for (const route of MARKETING_ROUTES) {
    test(`${route} has exactly one h1`, async ({ page }) => {
      await page.goto(route);
      await expect(page.locator("h1")).toHaveCount(1);
    });
  }
});

test.describe("Landmarks (AC20)", () => {
  for (const route of MARKETING_ROUTES) {
    test(`${route} has nav, main, and footer landmarks`, async ({ page }) => {
      await page.goto(route);
      await expect(page.locator("nav[aria-label='Primary']")).toHaveCount(1);
      await expect(page.locator("main")).toHaveCount(1);
      await expect(page.locator("footer")).toHaveCount(1);
    });
  }
});
