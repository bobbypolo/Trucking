import { test, expect } from "@playwright/test";
import { API_BASE, makeAdminRequest } from "./fixtures/auth.fixture";
const APP_BASE = process.env.E2E_APP_URL || "http://localhost:3103";

async function loginAsAdmin(page: import("@playwright/test").Page) {
  const email = process.env.E2E_ADMIN_EMAIL || process.env.E2E_TEST_EMAIL || "";
  const password =
    process.env.E2E_ADMIN_PASSWORD || process.env.E2E_TEST_PASSWORD || "";

  if (!email || !password) return false;

  await page.goto(APP_BASE);

  const emailInput = page.locator('input[type="email"], input[name="email"]');
  const passwordInput = page.locator(
    'input[type="password"], input[name="password"]',
  );
  const shellNav = page
    .locator('nav, [role="navigation"], aside, header')
    .first();
  if (!(await emailInput.isVisible().catch(() => false))) {
    return await shellNav.isVisible().catch(() => false);
  }

  await emailInput.fill(email);
  await passwordInput.fill(password);
  await page.locator('button[type="submit"]').first().click();
  await page
    .waitForURL(/\/(dashboard|loads|dispatch|home|operations)/, {
      timeout: 20_000,
    })
    .catch(() => {});
  if (!(await shellNav.isVisible().catch(() => false))) return false;
  return true;
}

test.describe("Team 3 - Embedded Map Evidence", () => {
  test("tracking live API returns a supported tracking state", async ({
    request,
  }) => {
    const auth = await makeAdminRequest();
    if (!auth.hasToken) {
      test.skip(true, "Admin credentials not available");
      return;
    }

    const res = await auth.get(`${API_BASE}/api/tracking/live`, request);
    // 200 = success (tier allowed or gracefully bypassed on legacy schema)
    // 403 = tier enforced and company lacks Fleet Core — valid, not a server error
    expect([200, 403]).toContain(res.status());
    if (res.status() === 403) return;

    const body = (await res.json()) as {
      trackingState?: string;
      providerDisplayName?: string | null;
    };

    expect([
      "configured-live",
      "configured-idle",
      "not-configured",
      "provider-error",
    ]).toContain(body.trackingState);

    if (body.providerDisplayName) {
      expect(["Samsara", "Generic Webhook"]).toContain(
        body.providerDisplayName,
      );
    }
  });

  test.describe("browser UI", () => {
    test.skip(
      !process.env.E2E_SERVER_RUNNING,
      "Skipped — set E2E_SERVER_RUNNING=1 to run browser UI tests",
    );

    test("Operations Center renders the embedded tracking map surface", async ({
      page,
    }) => {
      const loggedIn = await loginAsAdmin(page);
      if (!loggedIn) {
        test.skip(true, "Admin credentials unavailable");
        return;
      }

      await page.locator('[data-testid="nav-operations-hub"]').click();

      const bannerVisible = await page
        .locator('[data-testid="tracking-state-banner"]')
        .isVisible()
        .catch(() => false);
      const fallbackVisible = await page
        .locator('[data-testid="map-fallback"]')
        .isVisible()
        .catch(() => false);

      expect(bannerVisible || fallbackVisible).toBe(true);
      await expect(page.locator("body")).not.toContainText(/Fleet Map/i);
    });
  });
});
