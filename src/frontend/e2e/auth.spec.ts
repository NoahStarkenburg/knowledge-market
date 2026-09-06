import { test, expect } from "@playwright/test";
import { freshEmail, registerViaUI } from "./helpers";

test.describe("Authentication", () => {
  test("shows login form with email and password fields", async ({ page }) => {
    // Navigate first so localStorage is accessible, then clear auth
    await page.goto("/login");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });

  test("shows error on invalid credentials", async ({ page }) => {
    await page.goto("/login");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.getByLabel("Email").fill("nonexistent@test.com");
    await page.getByLabel("Password").fill("wrongpassword");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator("ul li").first()).toBeVisible({ timeout: 10_000 });
  });

  test("authenticated user lands on courses page", async ({ page }) => {
    // StorageState already has auth
    await page.goto("/courses");
    await expect(page.getByRole("heading", { name: /courses/i })).toBeVisible();
  });

  test("admin user sees Admin link in nav", async ({ page }) => {
    await page.goto("/courses");
    await expect(page.getByRole("link", { name: /admin/i })).toBeVisible();
  });

  test("register a new account and auto-login", async ({ page }) => {
    const email = freshEmail();
    await page.goto("/register");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await registerViaUI(page, email, "TestPass@123!");
    await expect(page).not.toHaveURL(/\/register/, { timeout: 10_000 });
  });

  test("unauthenticated user is redirected to login from protected routes", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.goto("/courses");
    await expect(page).toHaveURL(/\/login/);
  });

  test("logout from settings page redirects to login", async ({ page }) => {
    await page.goto("/settings/account");
    await page.waitForTimeout(500);
    // Target the button with exact text "Sign out" (not the navbar icon with title)
    await page.locator("button").filter({ hasText: /^Sign out$/i }).click();
    await expect(page).toHaveURL(/\/login/);
  });
});
