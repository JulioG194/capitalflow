import { test, expect } from "@playwright/test";

test.describe("Homepage JSON-LD structured data (AC13)", () => {
  test("emits a valid @graph with Organization and WebSite", async ({
    page,
  }) => {
    await page.goto("/");

    const jsonLdText = await page
      .locator('script[type="application/ld+json"]')
      .first()
      .textContent();

    expect(jsonLdText).toBeTruthy();
    const data = JSON.parse(jsonLdText!);

    expect(data["@context"]).toBe("https://schema.org");
    expect(Array.isArray(data["@graph"])).toBe(true);

    const types = data["@graph"].map((node: { "@type": string }) => node["@type"]);
    expect(types).toContain("Organization");
    expect(types).toContain("WebSite");

    const website = data["@graph"].find(
      (node: { "@type": string }) => node["@type"] === "WebSite",
    );
    expect(website.potentialAction["@type"]).toBe("SearchAction");

    const org = data["@graph"].find(
      (node: { "@type": string }) => node["@type"] === "Organization",
    );
    expect(org.name).toBeTruthy();
    expect(org.url).toBeTruthy();
    expect(org.logo).toBeTruthy();
  });
});
