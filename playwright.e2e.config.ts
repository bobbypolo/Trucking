import { defineConfig, devices } from "@playwright/test";

/**
 * Minimal Playwright config for running E2E tests against already-running servers.
 * Server: http://localhost:5000 (Express)
 * Frontend: http://localhost:3000 (Vite)
 * No webServer block — servers must be started externally.
 */
export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  timeout: 60_000,
  fullyParallel: false,
  retries: 1,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: process.env.E2E_APP_URL || "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
