import { chromium, expect, type FullConfig } from "@playwright/test";
import fs from "fs";
import path from "path";

const BASE_URL = "https://dylans-watches-ecommerce-site.vercel.app";
const ADMIN_EMAIL = "bryan@mainstreetaiconsultants.com";
const ADMIN_PASSWORD = "UR45a!-vAf4!9-MSgr82!";

const AUTH_DIR = path.join(__dirname, ".auth");
const AUTH_FILE = path.join(AUTH_DIR, "admin.json");

/**
 * Logs in once via the real login form (a server action sets an httpOnly
 * `admin-session` cookie) and persists the resulting browser state so the
 * admin spec can reuse the session without re-authenticating per test.
 */
async function globalSetup(_config: FullConfig) {
  fs.mkdirSync(AUTH_DIR, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({ baseURL: BASE_URL });

  await page.goto("/login");
  await page.waitForLoadState("networkidle");

  // The login labels aren't associated with inputs (no for/id), so target by
  // the form field names the server action reads: username (email) + password.
  await page.locator('input[name="username"]').fill(ADMIN_EMAIL);
  await page.locator('input[name="password"]').fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();

  // After a successful login the server action redirects to the dashboard ("/").
  // A failed login redirects back to /login?error=1.
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
    timeout: 30_000,
  });
  await page.waitForLoadState("networkidle");

  // Confirm we actually landed on the authenticated dashboard.
  await expect(page).toHaveURL(new RegExp(`^${BASE_URL}/?$`));
  await expect(
    page.getByRole("heading", { name: "Dashboard" })
  ).toBeVisible();

  await page.context().storageState({ path: AUTH_FILE });
  await browser.close();
}

export default globalSetup;
