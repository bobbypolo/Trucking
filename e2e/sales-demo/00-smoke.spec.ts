/**
 * e2e/sales-demo/00-smoke.spec.ts — Phase 7 R-P7-04
 *
 * Bare-minimum smoke spec that runs before the 3 hero specs during
 * `npm run demo:certify:sales`. Catches catastrophic infrastructure
 * failures (server down, Firebase unset, app shell 500) so the hero
 * specs can assume the environment is sane.
 *
 * Guarded by two env vars:
 *   - SALES_DEMO_E2E=1        — enables the sales-demo spec bucket
 *   - E2E_SERVER_RUNNING=1    — confirms caller has already started
 *                                the dev server (set by demo-certify)
 *
 * If either guard is unset the spec uses test.skip() with a clear
 * message so the gate does not false-fail on developer machines.
 */
import { test, expect } from "@playwright/test";
import { API_BASE, APP_BASE } from "../fixtures/urls";

const SKIP_REASON =
  "sales-demo smoke requires SALES_DEMO_E2E=1 and E2E_SERVER_RUNNING=1";

test.describe("sales-demo smoke", () => {
  test("health + homepage render (R-P7-04)", async ({ page, request }) => {
    test.skip(
      process.env.SALES_DEMO_E2E !== "1" ||
        process.env.E2E_SERVER_RUNNING !== "1",
      SKIP_REASON,
    );

    // 1. API health check — catches server-down before any UI work.
    const health = await request.get(API_BASE + "/api/health");
    expect(health.status()).toBe(200);

    // 2. App shell renders without a 500 page.
    const response = await page.goto(APP_BASE + "/");
    expect(response?.status()).toBeLessThan(400);

    // 3. Root element is present. We intentionally do not log in here —
    // the 3 hero specs (01-03) own the authenticated walkthroughs.
    await expect(page.locator("#root")).toBeAttached({ timeout: 10_000 });
  });
});
