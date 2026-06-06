import { defineConfig, devices } from "@playwright/test";

const BASE_URL = "https://dylans-watches-ecommerce-site.vercel.app";

export default defineConfig({
  testDir: "./tests",
  // Run global setup first to create the admin storageState (auth cookie).
  globalSetup: require.resolve("./tests/global-setup"),
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["list"], ["html", { open: "never" }]],
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: "admin",
      testMatch: /admin\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        // Reuse the authenticated admin session saved by global-setup.
        storageState: "tests/.auth/admin.json",
      },
    },
    {
      name: "store",
      testMatch: /store\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
