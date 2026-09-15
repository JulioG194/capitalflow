import { test, expect } from "@playwright/test";

test.describe("Top nav structure and links (AC24)", () => {
  // These assertions target the desktop nav bar specifically (the mobile
  // hamburger's own link set is covered by mobile-nav.spec.ts), so force a
  // desktop-sized viewport regardless of which Playwright project runs it.
  test.use({ viewport: { width: 1280, height: 800 } });

  test("logo links home, and marketing nav links resolve without 404", async ({
    page,
    request,
  }) => {
    await page.goto("/how-it-works");
    await page.getByRole("link", { name: /CapitalFlow/i }).first().click();
    await expect(page).toHaveURL(/\/$/);

    const marketingLinks: Array<[string, string]> = [
      ["Cómo funciona", "/how-it-works"],
      ["Precios", "/pricing"],
      ["Nosotros", "/about"],
    ];

    for (const [label, path] of marketingLinks) {
      const response = await request.get(path);
      expect(response.status(), `${label} (${path}) should not 404`).toBe(
        200,
      );
    }
  });

  test("Iniciar sesión and Registrarse point to /login and /register", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(
      page.getByRole("link", { name: "Iniciar sesión" }).first(),
    ).toHaveAttribute("href", "/login");

    const registerLinks = page.getByRole("link", { name: "Registrarse" });
    await expect(registerLinks.first()).toHaveAttribute("href", "/register");
  });

  test("footer legal links (/terms, /privacy) resolve without 404 (AC6, AC7)", async ({
    request,
  }) => {
    for (const path of ["/terms", "/privacy"]) {
      const response = await request.get(path);
      expect(response.status(), `${path} should not 404`).toBe(200);
    }
  });

  test("home → Registrarse lands on /register (even if a stub, per spec)", async ({
    page,
  }) => {
    await page.goto("/");
    await page
      .getByRole("link", { name: "Registrarse gratis" })
      .first()
      .click();
    await expect(page).toHaveURL(/\/register$/);
  });
});
