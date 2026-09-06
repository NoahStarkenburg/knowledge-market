import { test, expect } from "@playwright/test";

test.describe("Navigation & redirects", () => {
  test("navbar is visible with links when logged in", async ({ page }) => {
    await page.goto("/courses");
    // The nav should be visible
    await expect(page.locator("nav")).toBeVisible();
  });

  test("/profile redirects to /settings/overview", async ({ page }) => {
    await page.goto("/profile");
    await expect(page).toHaveURL(/\/settings\/overview/);
  });

  test("/orders redirects to /settings/orders", async ({ page }) => {
    await page.goto("/orders");
    await expect(page).toHaveURL(/\/settings\/orders/);
  });
});
