import { test, expect } from "@playwright/test";

test.describe("Branded 404 page (spec 001 §5 edge case)", () => {
  test("a bogus URL renders the branded 404 with a link back home", async ({
    page,
  }) => {
    const response = await page.goto("/this-page-does-not-exist");
    expect(response?.status()).toBe(404);

    await expect(
      page.getByRole("heading", { name: "We couldn't find this page" }),
    ).toBeVisible();

    const homeLink = page.getByRole("link", { name: "Back to home" });
    await expect(homeLink).toHaveAttribute("href", "/");

    await homeLink.click();
    await expect(page).toHaveURL(/\/$/);
  });
});
