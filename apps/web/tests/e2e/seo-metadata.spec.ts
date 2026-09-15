import { test, expect } from "@playwright/test";

const MARKETING_ROUTES = [
  "/",
  "/how-it-works",
  "/about",
  "/pricing",
  "/terms",
  "/privacy",
];

test.describe("SEO metadata per marketing page (AC9, AC10, AC15, AC23)", () => {
  for (const route of MARKETING_ROUTES) {
    test(`${route} has a title, description, canonical, OG and Twitter tags`, async ({
      page,
    }) => {
      await page.goto(route);

      // AC23: lang="es" on <html>
      await expect(page.locator("html")).toHaveAttribute("lang", "es");

      const title = await page.title();
      expect(title.length).toBeGreaterThan(0);

      const description = await page
        .locator('meta[name="description"]')
        .getAttribute("content");
      expect(description).toBeTruthy();

      // AC15: canonical tag. Next.js normalizes a bare "/" path by dropping
      // the trailing slash when resolving against metadataBase, so the root
      // route's canonical is the bare origin.
      const canonical = await page
        .locator('link[rel="canonical"]')
        .getAttribute("href");
      expect(canonical).toBeTruthy();
      if (route === "/") {
        expect(canonical === "https://capitalflow.example" || canonical === "https://capitalflow.example/").toBe(true);
      } else {
        expect(canonical!.endsWith(route)).toBe(true);
      }

      // AC10: Open Graph + Twitter Card (non-empty; og:title is the raw,
      // un-templated page title, so it's checked for presence, not equality
      // with the templated <title> text).
      const ogTitle = await page
        .locator('meta[property="og:title"]')
        .getAttribute("content");
      expect(ogTitle).toBeTruthy();
      expect(title.startsWith(ogTitle!)).toBe(true);

      await expect(
        page.locator('meta[property="og:description"]'),
      ).toHaveAttribute("content", description!);
      await expect(page.locator('meta[property="og:image"]')).toHaveCount(1);
      await expect(page.locator('meta[property="og:type"]')).toHaveAttribute(
        "content",
        "website",
      );
      await expect(page.locator('meta[property="og:url"]')).toHaveCount(1);
      await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
        "content",
        "summary_large_image",
      );
    });
  }

  test("every marketing page has a distinct title and description (AC9)", async ({
    page,
  }) => {
    const titles = new Set<string>();
    const descriptions = new Set<string>();

    for (const route of MARKETING_ROUTES) {
      await page.goto(route);
      titles.add(await page.title());
      descriptions.add(
        (await page
          .locator('meta[name="description"]')
          .getAttribute("content")) ?? "",
      );
    }

    expect(titles.size).toBe(MARKETING_ROUTES.length);
    expect(descriptions.size).toBe(MARKETING_ROUTES.length);
  });
});
