import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E Test Configuration
 * Phase 6: E2E Testing Foundation & Validation
 *
 * Tests are structured to be discovered by `npx playwright test --list`.
 * In CI (no server), tests are skipped. In local dev, tests run against localhost:3101/5000.
 */
export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",

  /* Maximum time one test can run — 60s for Firebase Auth login latency */
  timeout: 60_000,

  /* Run tests in files in parallel */
  fullyParallel: false,

  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,

  /* No retries in certification mode — flakes must be real failures.
   * Regular CI gets 2 retries; local dev gets 1. */
  retries: process.env.SALES_DEMO_E2E ? 0 : process.env.CI ? 2 : 1,

  /* Single worker for deterministic serial execution */
  workers: 1,

  /* Reporter to use */
  reporter: "list",

  use: {
    /* Base URL to use in tests e.g. await page.goto('/') */
    baseURL: "http://localhost:3101",

    /* Collect trace when retrying failed tests */
    trace: "on-first-retry",

    /* Take screenshot on failure */
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  /* Run the dev server before starting the tests.
   * REAL_E2E=1 — API-only tests: only Express server needed (no Vite).
   * E2E_SERVER_RUNNING=1 — Full UI tests: both Express + Vite needed.
   */
  webServer: process.env.E2E_SERVER_RUNNING
    ? [
        {
          command: "npm run server",
          url: `http://localhost:${process.env.PORT ?? 5000}/api/health`,
          timeout: 60_000,
          reuseExistingServer: true,
          env: { RATE_LIMIT_MAX: "10000" },
          stdout: "pipe",
          stderr: "pipe",
        },
        {
          command: "npm run dev",
          url: "http://localhost:3101",
          timeout: 60_000,
          reuseExistingServer: true,
          stdout: "pipe",
          stderr: "pipe",
        },
      ]
    : [
        {
          command: "npm run server",
          url: `http://localhost:${process.env.PORT ?? 5000}/api/health`,
          timeout: 60_000,
          reuseExistingServer: !process.env.CI,
          env: { RATE_LIMIT_MAX: "10000" },
          stdout: "pipe",
          stderr: "pipe",
        },
      ],
});
