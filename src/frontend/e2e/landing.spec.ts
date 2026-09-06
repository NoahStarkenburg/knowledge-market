import { test, expect } from "@playwright/test";

test.describe("Landing page", () => {
  test("loads the landing page with hero content", async ({ page }) => {
    await page.goto("/");
    // The landing page should have a hero heading
    await expect(page.locator("h1")).toBeVisible();
    // Should have "Get Started" button (links to /register when logged out)
    await expect(page.getByRole("link", { name: /get started/i })).toBeVisible();
  });

  test("Get Started link goes to register", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /get started/i }).click();
    await expect(page).toHaveURL(/\/register/);
  });
});
