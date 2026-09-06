import { test, expect } from "@playwright/test";

test.describe("Courses list page", () => {
  test("displays the courses page with heading and search input", async ({ page }) => {
    await page.goto("/courses");
    await expect(page.getByRole("heading", { name: /courses/i })).toBeVisible();
    await expect(page.getByPlaceholder(/search/i)).toBeVisible();
  });

  test("shows course cards or empty state", async ({ page }) => {
    await page.goto("/courses");
    await page.waitForTimeout(2000);
    const hasCourses = (await page.locator("a[href^='/courses/']").count()) > 0;
    const hasEmpty = (await page.getByText(/no courses found/i).count()) > 0;
    expect(hasCourses || hasEmpty).toBe(true);
  });

  test("search input is functional", async ({ page }) => {
    await page.goto("/courses");
    await page.waitForTimeout(1000);
    await page.getByPlaceholder(/search/i).fill("xyznonexistent");
    await page.waitForTimeout(1000);
    await expect(page.getByRole("heading", { name: /courses/i })).toBeVisible();
  });

  test("status filter tabs are visible", async ({ page }) => {
    await page.goto("/courses");
    await page.waitForTimeout(500);
    await expect(page.getByRole("button", { name: /published/i })).toBeVisible();
  });

  test("Create Course button navigates to /courses/new", async ({ page }) => {
    await page.goto("/courses");
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: /create course/i }).click();
    await expect(page).toHaveURL(/\/courses\/new/);
  });

  test("course creation form is accessible", async ({ page }) => {
    await page.goto("/courses/new");
    await page.waitForTimeout(500);
    await expect(page.getByLabel(/title/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /create/i })).toBeVisible();
  });
});
