import { test, expect } from "@playwright/test";

const MARKETING_ROUTES = [
  "/",
  "/how-it-works",
  "/about",
  "/pricing",
  "/terms",
  "/privacy",
];

test.describe("Images use next/image with alt, width, height (AC14)", () => {
  for (const route of MARKETING_ROUTES) {
    test(`${route} — every <img> has alt text and explicit dimensions`, async ({
      page,
    }) => {
      await page.goto(route);

      const images = page.locator("img");
      const count = await images.count();
      // Every marketing page renders the logo in the nav, so there's always
      // at least one image to check.
      expect(count).toBeGreaterThan(0);

      for (let i = 0; i < count; i++) {
        const img = images.nth(i);
        const alt = await img.getAttribute("alt");
        const width = await img.getAttribute("width");
        const height = await img.getAttribute("height");

        expect(alt, "img must have non-empty alt text").not.toBeNull();
        expect(alt!.length).toBeGreaterThan(0);
        expect(width, "img must have an explicit width").toBeTruthy();
        expect(height, "img must have an explicit height").toBeTruthy();
      }
    });
  }
});
