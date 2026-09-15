import { test, expect } from "@playwright/test";

test.describe("Branded 404 page (spec 001 §5 edge case)", () => {
  test("a bogus URL renders the branded 404 with a link back home", async ({
    page,
  }) => {
    const response = await page.goto("/this-page-does-not-exist");
    expect(response?.status()).toBe(404);

    await expect(
      page.getByRole("heading", { name: "No encontramos esta página" }),
    ).toBeVisible();

    const homeLink = page.getByRole("link", { name: "Volver al inicio" });
    await expect(homeLink).toHaveAttribute("href", "/");

    await homeLink.click();
    await expect(page).toHaveURL(/\/$/);
  });
});
