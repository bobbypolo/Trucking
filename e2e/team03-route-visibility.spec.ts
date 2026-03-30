import { test, expect } from "@playwright/test";
import { makeAdminRequest } from "./fixtures/auth.fixture";
import { API_BASE, APP_BASE } from "./fixtures/urls";

async function loginAsAdmin(page: import("@playwright/test").Page) {
  const email =
    process.env.E2E_ADMIN_EMAIL || process.env.E2E_TEST_EMAIL || "";
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

test.describe("Team 3 - Route Visibility Evidence", () => {
  test("provider names exposed by tracking endpoints match supported providers only", async ({
    request,
  }) => {
    const auth = await makeAdminRequest();
    if (!auth.hasToken) {
      test.skip(true, "SKIP:NO_TOKEN:admin");
      return;
    }

    const res = await auth.get(`${API_BASE}/api/tracking/providers`, request);
    expect([200, 404]).toContain(res.status());
    if (res.status() !== 200) return;

    const providers = (await res.json()) as Array<{
      providerName?: string;
      providerDisplayName?: string | null;
    }>;

    for (const provider of providers) {
      const display = provider.providerDisplayName ?? provider.providerName ?? "";
      if (!display) continue;
      expect(["Samsara", "Generic Webhook"]).toContain(display);
    }
  });

  test.describe("browser UI", () => {
    test.skip(
      !process.env.E2E_SERVER_RUNNING,
      "SKIP:NO_UI_SERVER",
    );

    test("navigation exposes Telematics Setup but not Fleet Map", async ({
      page,
    }) => {
      const loggedIn = await loginAsAdmin(page);
      if (!loggedIn) {
        test.skip(true, "SKIP:NO_TOKEN:admin");
        return;
      }

      await expect(page.locator('[data-testid="nav-telematics"]')).toBeVisible();
      await expect(page.locator('[data-testid="nav-operations-hub"]')).toBeVisible();
      await expect(page.locator('[data-testid="nav-map"]')).toHaveCount(0);
      await expect(page.locator("body")).not.toContainText(/Fleet Map/i);
    });
  });
});
