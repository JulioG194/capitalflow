import { test, expect } from "@playwright/test";

test.describe("Mobile nav hamburger menu (AC25)", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("toggles open/closed via mouse and exposes the marketing links", async ({
    page,
  }) => {
    await page.goto("/");

    // Located by the stable aria-controls relationship rather than its
    // accessible name, since the name itself toggles between "Abrir menú"
    // and "Cerrar menú".
    const toggle = page.locator('button[aria-controls="mobile-nav-panel"]');
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");

    const panel = page.locator("#mobile-nav-panel");
    await expect(panel).toBeVisible();
    await expect(panel.getByRole("link", { name: "Cómo funciona" })).toBeVisible();
    await expect(
      panel.getByRole("link", { name: "Registrarse" }),
    ).toHaveAttribute("href", "/register");

    await toggle.click();
    await expect(panel).toBeHidden();
  });

  test("is fully keyboard-operable: Tab to the toggle, Enter to open, links are reachable", async ({
    page,
  }) => {
    await page.goto("/");

    const toggle = page.locator('button[aria-controls="mobile-nav-panel"]');
    await toggle.focus();
    await expect(toggle).toBeFocused();

    await page.keyboard.press("Enter");
    await expect(toggle).toHaveAttribute("aria-expanded", "true");

    // Tab from the (now "Cerrar menú") toggle into the panel's first link.
    await page.keyboard.press("Tab");
    const firstPanelLink = page
      .locator("#mobile-nav-panel")
      .getByRole("link")
      .first();
    await expect(firstPanelLink).toBeFocused();
  });
});
