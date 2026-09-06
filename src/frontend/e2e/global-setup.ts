import { chromium } from "@playwright/test";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
export const AUTH_FILE = join(__dirname, ".auth-state.json");

async function globalSetup() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Log in as admin
  await page.goto("http://localhost:5173/login");
  await page.getByLabel("Email").fill("admin@knowledgemarket.dev");
  await page.getByLabel("Password").fill("Admin@KM2026!");
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL("**/courses", { timeout: 10_000 });

  // Save auth state (cookies + localStorage)
  await page.context().storageState({ path: AUTH_FILE });

  await browser.close();
}

export default globalSetup;
