import { test, expect } from "@playwright/test";

const MARKETING_ROUTES = [
  "/",
  "/how-it-works",
  "/about",
  "/pricing",
  "/terms",
  "/privacy",
];

test.describe("sitemap.xml and robots.txt (AC11, AC12)", () => {
  test("sitemap.xml lists every marketing URL", async ({ request }) => {
    const response = await request.get("/sitemap.xml");
    expect(response.ok()).toBe(true);

    const body = await response.text();
    expect(body).toContain("<urlset");

    const locs = [...body.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
    for (const route of MARKETING_ROUTES) {
      const matches = locs.some((loc) => {
        const url = new URL(loc);
        return url.pathname === route || (route === "/" && url.pathname === "");
      });
      expect(matches, `sitemap should list ${route}`).toBe(true);
    }
  });

  test("robots.txt allows marketing pages and disallows /app", async ({
    request,
  }) => {
    const response = await request.get("/robots.txt");
    expect(response.ok()).toBe(true);

    const body = await response.text();
    expect(body).toMatch(/Disallow:\s*\/app/);
    expect(body).toContain("Sitemap:");
    expect(body).not.toMatch(/Disallow:\s*\/\s*$/m);
  });
});
