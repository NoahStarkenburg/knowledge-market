import { type Page, expect } from "@playwright/test";

/**
 * Admin user — auto-seeded by the API on startup.
 * Global setup logs in as this user and saves storageState,
 * so most tests don't need to call loginViaUI.
 */
export const TEST_USER = {
  email: "admin@knowledgemarket.dev",
  password: "Admin@KM2026!",
};

/** Unique email for fresh registrations. */
export function freshEmail(): string {
  return `e2e-${Date.now()}@test.knowledgemarket.dev`;
}

/**
 * Log in via the UI. Only use this for auth-specific tests
 * (e.g., testing login flow itself). Other tests should rely on storageState.
 */
export async function loginViaUI(page: Page, email: string, password: string) {
  // Clear existing auth first so we start fresh
  await page.evaluate(() => localStorage.clear());
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 10_000 });
}

/**
 * Register a new account via the UI.
 */
export async function registerViaUI(page: Page, email: string, password: string) {
  await page.goto("/register");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: /create account/i }).click();
}
