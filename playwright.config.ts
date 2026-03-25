import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E Test Configuration
 * Phase 6: E2E Testing Foundation & Validation
 *
 * Tests are structured to be discovered by `npx playwright test --list`.
 * In CI (no server), tests are skipped. In local dev, tests run against localhost:5173.
 */
export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",

  /* Maximum time one test can run */
  timeout: 30_000,

  /* Run tests in files in parallel */
  fullyParallel: false,

  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only */
  retries: process.env.CI ? 2 : 1,

  /* Opt out of parallel tests on CI */
  workers: process.env.CI ? 1 : undefined,

  /* Reporter to use */
  reporter: "list",

  use: {
    /* Base URL to use in tests e.g. await page.goto('/') */
    baseURL: "http://localhost:5173",

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
        env: {
          ...process.env,
          RATE_LIMIT_MAX: "10000",
        },
        stdout: "pipe",
        stderr: "pipe",
      },
        {
          command: "npm run dev",
          url: `http://localhost:${process.env.VITE_PORT ?? 5173}`,
          timeout: 60_000,
          reuseExistingServer: true,
          env: {
            ...process.env,
        },
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
        env: {
          ...process.env,
          RATE_LIMIT_MAX: "10000",
        },
        stdout: "pipe",
        stderr: "pipe",
      },
      ],
});
