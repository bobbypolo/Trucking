/**
 * R-P6-01: Onboarding multi-user sync spec
 *
 * User A creates a Contractor party via the NetworkPortal API.
 * User B's NetworkPortal sees the new party within 7 seconds
 * (5s polling interval from STORY-002 + 2s safety margin).
 *
 * Auth pattern reused from team05-onboarding-entities.spec.ts.
 */
import "dotenv/config";
import { test, expect } from "@playwright/test";
import { makeAdminRequest } from "../fixtures/auth.fixture";
import { API_BASE, APP_BASE } from "../fixtures/urls";

// Tests R-P6-01
test.describe("Pre-Demo Remediation — Onboarding multi-user sync (R-P6-01)", () => {
  test("User A creates Contractor party; User B sees it within 7 seconds", async ({
    browser,
    request,
  }) => {
    const auth = await makeAdminRequest();
    test.skip(
      !auth.hasToken,
      "SKIP:NO_TOKEN:admin — Firebase credentials unavailable",
    );

    // User A: create a uniquely-named party via shared API request context
    const partyName = `E2E-Contractor-${Date.now()}`;

    const createRes = await request.post(`${API_BASE}/api/parties`, {
      headers: {
        Authorization: `Bearer ${auth.idToken}`,
        "Content-Type": "application/json",
      },
      data: {
        name: partyName,
        type: "Contractor",
        entityClass: "Contractor",
        status: "Draft",
        isCustomer: false,
        isVendor: true,
        email: `e2e-${Date.now()}@example.com`,
      },
    });
    expect([200, 201]).toContain(createRes.status());

    // User B context: open NetworkPortal and poll for the new party
    const ctxB = await browser.newContext();
    const pageB = await ctxB.newPage();

    await pageB.goto(APP_BASE);
    await pageB
      .locator('input[type="email"]')
      .first()
      .fill(process.env.E2E_ADMIN_EMAIL ?? "admin@loadpilot.com");
    await pageB
      .locator('input[type="password"]')
      .first()
      .fill(process.env.E2E_ADMIN_PASSWORD ?? "Admin123");
    await pageB.locator('button[type="submit"]').first().click();
    await expect(
      pageB.getByRole("button", { name: /Sign Out/i }).first(),
    ).toBeVisible({ timeout: 30_000 });

    // Navigate to Onboarding / NetworkPortal
    await pageB
      .getByRole("navigation")
      .getByRole("button", { name: /Onboarding/i })
      .first()
      .click();
    const portal = pageB.getByTestId("onboarding-portal");
    await expect(portal).toBeVisible({ timeout: 10_000 });

    // Polling is 5s; assert new party visible within 7s margin (R-P6-01)
    await expect(portal.getByText(partyName)).toBeVisible({ timeout: 7_000 });

    await ctxB.close();
  });
});
