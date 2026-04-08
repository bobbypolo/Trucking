/**
 * R-P6-04: Issue board create spec
 *
 * Opens ExceptionConsole, clicks "Create Issue".
 *
 * Invalid submission path: fill entityId but leave description empty so the
 * Create Issue button stays disabled — then verify the disabled state proves
 * the validation guard is active within 2 seconds.
 *
 * Valid submission path: fill both required fields (entityId + description),
 * submit. Assert the new issue appears in the issues-console list within
 * 12 seconds (10s polling interval from STORY-002 + 2s safety margin).
 *
 * Auth pattern from team05-issues-unification.spec.ts.
 */
import "dotenv/config";
import { test, expect } from "@playwright/test";
import { makeAdminRequest } from "../fixtures/auth.fixture";
import { APP_BASE } from "../fixtures/urls";

// Tests R-P6-04
test.describe("Pre-Demo Remediation — Issue Board Create (R-P6-04)", () => {
  test("invalid submit keeps button disabled within 2s; valid submit appears in list within 12s", async ({
    page,
  }) => {
    const auth = await makeAdminRequest();
    test.skip(
      !auth.hasToken,
      "SKIP:NO_TOKEN:admin — Firebase credentials unavailable",
    );

    // Login
    await page.goto(APP_BASE);
    await page
      .locator('input[type="email"]')
      .first()
      .fill(process.env.E2E_ADMIN_EMAIL ?? "admin@loadpilot.com");
    await page
      .locator('input[type="password"]')
      .first()
      .fill(process.env.E2E_ADMIN_PASSWORD ?? "Admin123");
    await page.locator('button[type="submit"]').first().click();
    await expect(
      page.getByRole("button", { name: /Sign Out/i }).first(),
    ).toBeVisible({ timeout: 30_000 });

    // Navigate to Issues & Alerts (ExceptionConsole)
    await page
      .getByRole("navigation")
      .getByRole("button", { name: /Issues/i })
      .first()
      .click();
    await expect(page.getByTestId("issues-console")).toBeVisible({
      timeout: 10_000,
    });

    // Open Create Issue modal
    await page
      .getByRole("button", { name: /Create Issue/i })
      .first()
      .click();
    await expect(
      page.getByRole("heading", { name: /Create Issue/i }),
    ).toBeVisible({ timeout: 5_000 });

    // ── Invalid submission path (R-P6-04 guard check) ─────────────────
    // Fill entityId but leave description empty → button must be disabled
    await page.locator("#issueEntityId").fill("Load #E2E-TEST");
    // description is still empty — button should be disabled immediately
    const submitBtn = page.getByRole("button", {
      name: /^Create Issue$/i,
    });
    // Assert disabled within 2 seconds (validation guard active)
    await expect(submitBtn).toBeDisabled({ timeout: 2_000 });

    // ── Valid submission path (R-P6-04 poll check) ────────────────────
    const issueDesc = `E2E issue ${Date.now()}`;
    await page.locator("#issueDescription").fill(issueDesc);

    // Button should now be enabled
    await expect(submitBtn).toBeEnabled({ timeout: 2_000 });
    await submitBtn.click();

    // Modal closes on success
    await expect(
      page.getByRole("heading", { name: /Create Issue/i }),
    ).not.toBeVisible({ timeout: 5_000 });

    // New issue appears in the issues-console list within 12s (R-P6-04)
    await expect(
      page.getByTestId("issues-console").getByText(issueDesc),
    ).toBeVisible({ timeout: 12_000 });
  });
});
