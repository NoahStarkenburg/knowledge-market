import { test, expect } from "@playwright/test";
import { TEST_USER } from "./helpers";

test.describe("Settings pages", () => {
  test.describe("Account section", () => {
    test("displays the account settings with display name input", async ({ page }) => {
      await page.goto("/settings/account");
      await page.waitForTimeout(500);
      await expect(page.getByRole("heading", { name: /^account$/i })).toBeVisible();
      await expect(page.getByPlaceholder(/display name/i)).toBeVisible();
    });

    test("can update display name", async ({ page }) => {
      await page.goto("/settings/account");
      const nameInput = page.getByPlaceholder(/display name/i);
      await nameInput.clear();
      await nameInput.fill("E2E Admin");
      await page.getByRole("button", { name: /^save$/i }).click();
      await expect(page.getByText(/saved/i)).toBeVisible({ timeout: 5000 });
    });

    test("shows change password fields", async ({ page }) => {
      await page.goto("/settings/account");
      await page.waitForTimeout(500);
      await expect(page.locator("h3").filter({ hasText: /change password/i })).toBeVisible();
      await expect(page.getByPlaceholder("Current password")).toBeVisible();
      await expect(page.getByPlaceholder("New password", { exact: true })).toBeVisible();
      await expect(page.getByPlaceholder("Confirm new password")).toBeVisible();
    });

    test("shows email address (read-only)", async ({ page }) => {
      await page.goto("/settings/account");
      await page.waitForTimeout(500);
      // The email appears in both the navbar and the account card; target the card one
      await expect(page.getByText(TEST_USER.email).nth(1)).toBeVisible();
    });

    test("has sign out and delete account buttons", async ({ page }) => {
      await page.goto("/settings/account");
      // Use text-based filter to target the specific button in the card, not the nav icon
      await expect(page.locator("button").filter({ hasText: /^sign out$/i })).toBeVisible();
      await expect(page.getByRole("button", { name: /delete account/i })).toBeVisible();
    });

    test("forgot password link navigates correctly", async ({ page }) => {
      await page.goto("/settings/account");
      await page.getByRole("button", { name: /reset via email/i }).click();
      await expect(page).toHaveURL(/\/forgot-password/);
    });
  });

  test.describe("Orders section", () => {
    test("displays orders page with filter controls", async ({ page }) => {
      await page.goto("/settings/orders");
      await expect(page.getByRole("heading", { name: /orders/i })).toBeVisible();
      await expect(page.getByRole("button", { name: /^all$/i })).toBeVisible();
      await expect(page.getByRole("button", { name: /pending/i })).toBeVisible();
      await expect(page.getByRole("button", { name: /^paid$/i })).toBeVisible();
      await expect(page.getByRole("button", { name: /refunded/i })).toBeVisible();
    });

    test("has search and date range filters", async ({ page }) => {
      await page.goto("/settings/orders");
      await expect(page.getByPlaceholder(/search/i)).toBeVisible();
      const dateInputs = page.locator('input[type="date"]');
      await expect(dateInputs).toHaveCount(2);
    });

    test("can switch between status tabs", async ({ page }) => {
      await page.goto("/settings/orders");
      await page.waitForTimeout(1000);
      await page.getByRole("button", { name: /^paid$/i }).click();
      await page.waitForTimeout(500);
      await page.getByRole("button", { name: /^all$/i }).click();
      await page.waitForTimeout(500);
      await expect(page.getByRole("heading", { name: /orders/i })).toBeVisible();
    });

    test("shows empty state or order cards", async ({ page }) => {
      await page.goto("/settings/orders");
      await page.waitForTimeout(2000);
      const hasOrders = (await page.locator("li").count()) > 0;
      const hasEmptyState = (await page.getByText(/no orders found/i).count()) > 0;
      expect(hasOrders || hasEmptyState).toBe(true);
    });
  });

  test.describe("Settings navigation", () => {
    test("settings redirects to settings/overview", async ({ page }) => {
      await page.goto("/settings");
      await expect(page).toHaveURL(/\/settings\/overview/);
    });
  });
});
