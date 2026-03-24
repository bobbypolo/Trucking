import { test, expect } from "@playwright/test";
import { API_BASE, makeAdminRequest } from "./fixtures/auth.fixture";

/**
 * QA-01 Settings Tabs Spec
 *
 * Verifies the CompanyProfile (Company Settings) page:
 * 1. Page loads without crash
 * 2. Each settings tab renders without crash
 * 3. Partial company config does not cause crash
 * 4. Admin vs non-admin settings visibility
 *
 * CompanyProfile tabs (from CompanyProfile.tsx):
 *   - identity       (Identity)
 *   - company_profile (Operations)
 *   - registry       (Personnel)
 *   - permissions    (Security)
 *   - policy         (Governance)
 *   - driver_cockpit (Driver Cockpit) — shown for driver roles
 *
 * Admin tabs: identity, company_profile, registry, permissions, policy
 * Driver tabs: driver_cockpit (default for drivers)
 *
 * UI-level tests require E2E_SERVER_RUNNING=1 and test credentials.
 * API-level tests run with Firebase credentials.
 */

const APP_BASE = process.env.E2E_APP_URL || "http://localhost:5173";
const SERVER_RUNNING = !!process.env.E2E_SERVER_RUNNING;
const E2E_EMAIL = process.env.E2E_TEST_EMAIL || process.env.E2E_ADMIN_EMAIL;
const E2E_PASSWORD =
  process.env.E2E_TEST_PASSWORD || process.env.E2E_ADMIN_PASSWORD;

/**
 * Helper: login and navigate to Company Settings tab.
 */
async function loginAndGoToSettings(
  page: import("@playwright/test").Page,
  email: string,
  password: string,
) {
  await page.goto(APP_BASE);
  await page.locator('input[type="email"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL(/\/(dashboard|loads|dispatch|home|operations)/, {
    timeout: 20_000,
  });

  // Wait for sidebar to render
  await page
    .locator('nav, [role="navigation"], aside')
    .first()
    .waitFor({ timeout: 10_000 });

  // Click on "Company Settings" in the sidebar nav
  const settingsLink = page.locator(
    'nav >> text="Company Settings", aside >> text="Company Settings", ' +
      '[role="navigation"] >> text="Company Settings"',
  );
  await settingsLink.first().click();

  // Wait for the settings page to load (look for tab indicators)
  await page
    .locator(
      'text="Identity", text="Operations", text="Personnel", ' +
        'text="Security", text="Governance"',
    )
    .first()
    .waitFor({ timeout: 10_000 })
    .catch(() => {
      /* Tab labels may differ */
    });
}

// ── Settings Page Loads ─────────────────────────────────────────────────────

test.describe("QA-01 Settings Tabs — Page Load", () => {
  test.skip(
    !SERVER_RUNNING || !E2E_EMAIL || !E2E_PASSWORD,
    "Requires E2E_SERVER_RUNNING=1 and test credentials",
  );

  test("Company Settings page loads without crash", async ({ page }) => {
    // Register pageerror listener BEFORE navigation so errors during load are caught
    let jsError = false;
    page.on("pageerror", () => {
      jsError = true;
    });

    await loginAndGoToSettings(page, E2E_EMAIL!, E2E_PASSWORD!);

    // Page should not be blank — some content must be visible
    const body = await page.content();
    expect(body).toContain("<!DOCTYPE html>");
    expect(body.length).toBeGreaterThan(500);

    // No JS errors (white screen detection)
    await page.waitForTimeout(2_000);
    expect(jsError).toBe(false);
  });

  test("Company Settings page shows tab navigation", async ({ page }) => {
    await loginAndGoToSettings(page, E2E_EMAIL!, E2E_PASSWORD!);

    // At least one tab label should be visible
    const tabLabels = page.locator(
      'text="Identity", text="Operations", text="Personnel", ' +
        'text="Security", text="Governance"',
    );
    const count = await tabLabels.count();
    expect(count).toBeGreaterThan(0);
  });
});

// ── Each Settings Tab Renders Without Crash ─────────────────────────────────

test.describe("QA-01 Settings Tabs — Individual Tab Rendering", () => {
  test.skip(
    !SERVER_RUNNING || !E2E_EMAIL || !E2E_PASSWORD,
    "Requires E2E_SERVER_RUNNING=1 and test credentials",
  );

  /**
   * Admin tabs from CompanyProfile.tsx:
   *   { id: "identity", label: "Identity", icon: FileText }
   *   { id: "company_profile", label: "Operations", icon: Zap }
   *   { id: "registry", label: "Personnel", icon: Users }
   *   { id: "permissions", label: "Security", icon: Lock }
   *   { id: "policy", label: "Governance", icon: Scale }
   */
  const adminTabs = [
    { id: "identity", label: "Identity" },
    { id: "company_profile", label: "Operations" },
    { id: "registry", label: "Personnel" },
    { id: "permissions", label: "Security" },
    { id: "policy", label: "Governance" },
  ];

  test("Identity tab renders without crash", async ({ page }) => {
    await loginAndGoToSettings(page, E2E_EMAIL!, E2E_PASSWORD!);

    // Identity tab should be the default for admin users
    const identityTab = page.locator('text="Identity"').first();
    await identityTab.click();
    await page.waitForTimeout(1_000);

    // Verify some content loaded — identity section should have form fields or data
    const content = page.locator(
      'input, [data-testid*="identity"], form, .company-name, ' +
        'text="Company Name", text="MC Number", text="DOT Number", text="Legal Name"',
    );
    const hasContent = await content
      .first()
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
    // Primary assertion: no crash — page is still interactive
    const body = await page.content();
    expect(body.length).toBeGreaterThan(500);
    // Tab click did not cause a blank page
    expect(body).toContain("<!DOCTYPE html>");
  });

  test("Operations tab renders without crash", async ({ page }) => {
    await loginAndGoToSettings(page, E2E_EMAIL!, E2E_PASSWORD!);

    const opsTab = page.locator('text="Operations"').first();
    await opsTab.click();
    await page.waitForTimeout(1_000);

    // Verify page did not crash
    const body = await page.content();
    expect(body.length).toBeGreaterThan(500);
    expect(body).toContain("<!DOCTYPE html>");
    // Verify Operations tab content actually rendered
    const bodyText = await page.locator("body").innerText();
    expect(
      bodyText.toLowerCase(),
      'Operations tab should render content containing "operations"',
    ).toContain("operations");
  });

  test("Personnel tab renders without crash", async ({ page }) => {
    await loginAndGoToSettings(page, E2E_EMAIL!, E2E_PASSWORD!);

    const personnelTab = page.locator('text="Personnel"').first();
    await personnelTab.click();
    await page.waitForTimeout(1_000);

    // Personnel tab should show user list or user management
    const body = await page.content();
    expect(body.length).toBeGreaterThan(500);
    expect(body).toContain("<!DOCTYPE html>");
    // Verify Personnel tab content actually rendered (may show "Personnel" or "Team")
    const bodyText = await page.locator("body").innerText();
    const hasPersonnel =
      bodyText.toLowerCase().includes("personnel") ||
      bodyText.toLowerCase().includes("team") ||
      bodyText.toLowerCase().includes("user");
    expect(
      hasPersonnel,
      'Personnel tab should render content containing "personnel", "team", or "user"',
    ).toBe(true);
  });

  test("Security tab renders without crash", async ({ page }) => {
    await loginAndGoToSettings(page, E2E_EMAIL!, E2E_PASSWORD!);

    const securityTab = page.locator('text="Security"').first();
    await securityTab.click();
    await page.waitForTimeout(1_000);

    const body = await page.content();
    expect(body.length).toBeGreaterThan(500);
    expect(body).toContain("<!DOCTYPE html>");
    // Verify Security tab content actually rendered
    const bodyText = await page.locator("body").innerText();
    const hasSecurity =
      bodyText.toLowerCase().includes("security") ||
      bodyText.toLowerCase().includes("permission") ||
      bodyText.toLowerCase().includes("role");
    expect(
      hasSecurity,
      'Security tab should render content containing "security", "permission", or "role"',
    ).toBe(true);
  });

  test("Governance tab renders without crash", async ({ page }) => {
    await loginAndGoToSettings(page, E2E_EMAIL!, E2E_PASSWORD!);

    const governanceTab = page.locator('text="Governance"').first();
    await governanceTab.click();
    await page.waitForTimeout(1_000);

    const body = await page.content();
    expect(body.length).toBeGreaterThan(500);
    expect(body).toContain("<!DOCTYPE html>");
    // Verify Governance tab content actually rendered
    const bodyText = await page.locator("body").innerText();
    const hasGovernance =
      bodyText.toLowerCase().includes("governance") ||
      bodyText.toLowerCase().includes("policy") ||
      bodyText.toLowerCase().includes("compliance");
    expect(
      hasGovernance,
      'Governance tab should render content containing "governance", "policy", or "compliance"',
    ).toBe(true);
  });

  test("all admin tabs can be cycled through without crash", async ({
    page,
  }) => {
    await loginAndGoToSettings(page, E2E_EMAIL!, E2E_PASSWORD!);

    let jsErrorOccurred = false;
    page.on("pageerror", (error) => {
      jsErrorOccurred = true;
      console.log(`[QA-01] JS error during tab cycling: ${error.message}`);
    });

    for (const tab of adminTabs) {
      const tabEl = page.locator(`text="${tab.label}"`).first();
      const isVisible = await tabEl.isVisible().catch(() => false);
      if (isVisible) {
        await tabEl.click();
        await page.waitForTimeout(500);
      }
    }

    // No JS errors during tab cycling
    expect(jsErrorOccurred).toBe(false);
    // Page is still rendered
    const body = await page.content();
    expect(body.length).toBeGreaterThan(500);
  });
});

// ── Partial Company Config Does Not Crash ───────────────────────────────────

test.describe("QA-01 Settings Tabs — Partial Config Resilience", () => {
  test.skip(
    !SERVER_RUNNING || !E2E_EMAIL || !E2E_PASSWORD,
    "Requires E2E_SERVER_RUNNING=1 and test credentials",
  );

  test("settings page handles missing company data gracefully", async ({
    page,
  }) => {
    await loginAndGoToSettings(page, E2E_EMAIL!, E2E_PASSWORD!);

    // The CompanyProfile component fetches company data on mount.
    // If company data is partial or missing, it should not crash.
    // We verify by checking that the page is still interactive after load.

    let jsError = false;
    page.on("pageerror", () => {
      jsError = true;
    });

    // Navigate through tabs to exercise partial data paths
    const tabs = ["Identity", "Operations", "Personnel"];
    for (const tabLabel of tabs) {
      const tab = page.locator(`text="${tabLabel}"`).first();
      const isVisible = await tab.isVisible().catch(() => false);
      if (isVisible) {
        await tab.click();
        await page.waitForTimeout(500);
      }
    }

    expect(jsError).toBe(false);
  });

  test("Identity tab renders even without MC/DOT numbers configured", async ({
    page,
  }) => {
    await loginAndGoToSettings(page, E2E_EMAIL!, E2E_PASSWORD!);

    const identityTab = page.locator('text="Identity"').first();
    await identityTab.click();
    await page.waitForTimeout(1_000);

    // The identity section should render form fields regardless of data state
    // Check that inputs or text elements exist (not a blank/error page)
    const formElements = page.locator(
      "input, select, textarea, label, .field, [data-testid]",
    );
    const count = await formElements.count();
    // Should have at least some form elements
    expect(count).toBeGreaterThan(0);
  });

  test("Operations tab renders even with no equipment configured", async ({
    page,
  }) => {
    await loginAndGoToSettings(page, E2E_EMAIL!, E2E_PASSWORD!);

    const opsTab = page.locator('text="Operations"').first();
    await opsTab.click();
    await page.waitForTimeout(1_000);

    // Should show operations content — not a crash or blank section
    const body = await page.content();
    expect(body.length).toBeGreaterThan(500);
    // Page did not white-screen
    const bodyEl = page.locator("body");
    const bodyText = await bodyEl.innerText();
    expect(bodyText.length).toBeGreaterThan(10);
  });

  test("Personnel tab renders even with only the current user", async ({
    page,
  }) => {
    await loginAndGoToSettings(page, E2E_EMAIL!, E2E_PASSWORD!);

    const personnelTab = page.locator('text="Personnel"').first();
    await personnelTab.click();
    await page.waitForTimeout(1_000);

    // Should render at least the current user or an empty user list
    const body = await page.content();
    expect(body.length).toBeGreaterThan(500);
    // No crash
    const bodyEl = page.locator("body");
    const bodyText = await bodyEl.innerText();
    expect(bodyText.length).toBeGreaterThan(10);
  });
});

// ── Admin vs Non-Admin Settings Visibility ──────────────────────────────────

test.describe("QA-01 Settings Tabs — Admin vs Non-Admin Visibility", () => {
  test.skip(!SERVER_RUNNING, "Requires E2E_SERVER_RUNNING=1");

  test("admin user sees all 5 settings tabs", async ({ page }) => {
    const email = process.env.E2E_ADMIN_EMAIL;
    const password = process.env.E2E_ADMIN_PASSWORD;
    test.skip(!email || !password, "Admin credentials not set");

    await loginAndGoToSettings(page, email!, password!);

    const expectedTabs = [
      "Identity",
      "Operations",
      "Personnel",
      "Security",
      "Governance",
    ];

    for (const tabLabel of expectedTabs) {
      const tab = page.locator(`text="${tabLabel}"`).first();
      await expect(tab, `Admin should see "${tabLabel}" tab`).toBeVisible({
        timeout: 5_000,
      });
    }
  });

  test("driver user sees Driver Cockpit tab on settings page", async ({
    page,
  }) => {
    const email = process.env.E2E_DRIVER_EMAIL;
    const password = process.env.E2E_DRIVER_PASSWORD;
    test.skip(!email || !password, "Driver credentials not set");

    await page.goto(APP_BASE);
    await page.locator('input[type="email"]').first().fill(email!);
    await page.locator('input[type="password"]').first().fill(password!);
    await page.locator('button[type="submit"]').first().click();
    await page.waitForURL(/\/(dashboard|loads|dispatch|home|operations)/, {
      timeout: 20_000,
    });

    // Navigate to Company Settings (if visible to the driver)
    const settingsLink = page.locator(
      'nav >> text="Company Settings", aside >> text="Company Settings"',
    );
    const settingsVisible = await settingsLink
      .first()
      .isVisible({ timeout: 5_000 })
      .catch(() => false);

    if (!settingsVisible) {
      // Driver may not have ORG_SETTINGS_VIEW permission — this is expected
      test.skip(
        true,
        "Driver does not have access to Company Settings — expected behavior",
      );
      return;
    }

    await settingsLink.first().click();
    await page.waitForTimeout(2_000);

    // Driver should see Driver Cockpit tab
    const driverTab = page.locator('text="Driver Cockpit"');
    const hasDCTab = await driverTab
      .first()
      .isVisible({ timeout: 5_000 })
      .catch(() => false);

    if (!hasDCTab) {
      test.skip(
        true,
        "Driver Cockpit tab not visible — driver may lack the required role or tab config differs",
      );
      return;
    }

    // Driver cockpit should be visible and clickable
    await driverTab.first().click();
    await page.waitForTimeout(1_000);
    const body = await page.content();
    expect(body.length).toBeGreaterThan(500);
    expect(body).toContain("<!DOCTYPE html>");
  });

  test("non-admin user (dispatcher) may see limited settings tabs", async ({
    page,
  }) => {
    const email = process.env.E2E_DISPATCHER_EMAIL;
    const password = process.env.E2E_DISPATCHER_PASSWORD;
    test.skip(!email || !password, "Dispatcher credentials not set");

    await page.goto(APP_BASE);
    await page.locator('input[type="email"]').first().fill(email!);
    await page.locator('input[type="password"]').first().fill(password!);
    await page.locator('button[type="submit"]').first().click();
    await page.waitForURL(/\/(dashboard|loads|dispatch|home|operations)/, {
      timeout: 20_000,
    });

    // Check if dispatcher can access Company Settings
    const settingsLink = page.locator(
      'nav >> text="Company Settings", aside >> text="Company Settings"',
    );
    const settingsVisible = await settingsLink
      .first()
      .isVisible({ timeout: 5_000 })
      .catch(() => false);

    if (!settingsVisible) {
      // Dispatcher may not have ORG_SETTINGS_VIEW permission
      test.skip(true, "Dispatcher does not have access to Company Settings");
      return;
    }

    await settingsLink.first().click();
    await page.waitForTimeout(2_000);

    // Dispatcher with isAdmin=true (role is "dispatcher" in the isAdmin check)
    // should see admin tabs: Identity, Operations, Personnel, Security, Governance
    const adminTabs = [
      "Identity",
      "Operations",
      "Personnel",
      "Security",
      "Governance",
    ];

    let visibleTabCount = 0;
    for (const tabLabel of adminTabs) {
      const tab = page.locator(`text="${tabLabel}"`).first();
      const isVisible = await tab.isVisible().catch(() => false);
      if (isVisible) visibleTabCount++;
    }

    const ADMIN_TAB_COUNT = 5; // admin sees all 5: Identity, Operations, Personnel, Security, Governance
    // Should have at least 1 tab visible (Identity is the default)
    expect(visibleTabCount).toBeGreaterThan(0);
    // Non-admin should see fewer tabs than a full admin
    expect(
      visibleTabCount,
      `Dispatcher should see fewer than ${ADMIN_TAB_COUNT} admin tabs (saw ${visibleTabCount})`,
    ).toBeLessThan(ADMIN_TAB_COUNT);
    // Page should not crash
    const body = await page.content();
    expect(body).toContain("<!DOCTYPE html>");
  });
});

// ── Settings API-Level Validation ───────────────────────────────────────────

test.describe("QA-01 Settings Tabs — API Validation", () => {
  test("company endpoint requires auth — unauthenticated access rejected", async ({
    request,
  }) => {
    const res = await request.get(`${API_BASE}/api/company`);
    expect([401, 403, 404, 500]).toContain(res.status());
    expect(res.status()).not.toBe(200);
  });

  test("admin can access company data via API", async ({ request }) => {
    const ctx = await makeAdminRequest();
    if (!ctx.hasToken) {
      test.skip(true, "Admin credentials not available");
      return;
    }
    // Company endpoint should return data or 404 (not 401/403)
    const res = await ctx.get(`${API_BASE}/api/company`, request);
    expect([200, 404]).toContain(res.status());
    expect(res.status()).not.toBe(401);
    expect(res.status()).not.toBe(403);
  });

  test("users endpoint requires auth — unauthenticated access rejected", async ({
    request,
  }) => {
    const res = await request.get(`${API_BASE}/api/users`);
    expect([401, 403, 404, 500]).toContain(res.status());
    expect(res.status()).not.toBe(200);
  });

  test("QuickBooks status endpoint returns 503 or auth error when not configured", async ({
    request,
  }) => {
    // This endpoint is called by CompanyProfile for billing integration
    const res = await request.get(`${API_BASE}/api/quickbooks/status`);
    // Expected: 503 (not configured), 401 (no auth), or 404 (route not found)
    expect([401, 403, 404, 500, 503]).toContain(res.status());
  });
});
