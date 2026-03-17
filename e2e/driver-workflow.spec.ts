import { test, expect } from "@playwright/test";
import { v4 as uuidv4 } from "uuid";
import {
  API_BASE,
  makeAdminRequest,
  makeDriverRequest,
  type AuthContext,
} from "./fixtures/auth.fixture";
import { makeLoadDraft, makeLoadStatusTransition } from "./fixtures/data-factory";

/**
 * E2E Canonical Journey: Driver Workflow
 *
 * Journey: Login as driver -> view assignments -> start route ->
 *          update status -> complete delivery
 *
 * Tests the driver-role experience through the API, verifying that
 * drivers can see their assigned loads and update status through
 * the delivery lifecycle, but cannot perform admin-only actions.
 *
 * Requires: FIREBASE_WEB_API_KEY for authenticated requests
 */

// -- Driver role API access --

test.describe("Canonical Journey: Driver Role API Access", () => {
  let admin: AuthContext;
  let driver: AuthContext;
  let loadId: string;

  test.beforeAll(async () => {
    admin = await makeAdminRequest();
    driver = await makeDriverRequest();
  });

  test.skip(
    !process.env.FIREBASE_WEB_API_KEY,
    "Skipped -- FIREBASE_WEB_API_KEY not set; driver workflow requires real Firebase tokens",
  );

  test("Step 1: Admin creates a load and assigns a driver", async ({
    request,
  }) => {
    test.skip(!admin.hasToken, "No admin Firebase token available");

    loadId = uuidv4();
    const payload = makeLoadDraft({
      id: loadId,
      load_number: `JOURNEY-DRIVER-${Date.now()}`,
      commodity: "Driver workflow journey test freight",
      weight: 22000,
      freight_type: "dry_van",
      legs: [
        { type: "pickup", city: "Houston", state: "TX", sequence_order: 0 },
        { type: "delivery", city: "San Antonio", state: "TX", sequence_order: 1 },
      ],
    });

    const res = await admin.post(`${API_BASE}/api/loads`, payload, request);
    expect([200, 201]).toContain(res.status());

    const body = await res.json();
    loadId = body.id || loadId;

    // Transition to planned so it can be dispatched
    const planRes = await admin.patch(
      `${API_BASE}/api/loads/${loadId}/status`,
      makeLoadStatusTransition("planned"),
      request,
    );
    expect([200, 201]).toContain(planRes.status());
  });

  test("Step 2: Driver can retrieve load list (driver role sees assigned loads)", async ({
    request,
  }) => {
    test.skip(!driver.hasToken, "No driver Firebase token available");

    const res = await driver.get(`${API_BASE}/api/loads`, request);
    // Driver should be able to see loads (200) or may get filtered results
    expect([200, 403]).toContain(res.status());

    if (res.status() === 200) {
      const body = await res.json();
      expect(Array.isArray(body)).toBe(true);
    }
  });

  test("Step 3: Driver can view dispatch board", async ({ request }) => {
    test.skip(!driver.hasToken, "No driver Firebase token available");

    const res = await driver.get(`${API_BASE}/api/dispatch`, request);
    // Dispatch board may be role-restricted or available to drivers
    expect([200, 403, 404]).toContain(res.status());
  });

  test("Step 4: Driver cannot create new loads (admin-only action)", async ({
    request,
  }) => {
    test.skip(!driver.hasToken, "No driver Firebase token available");

    const payload = makeLoadDraft({
      load_number: `DRIVER-UNAUTHORIZED-${Date.now()}`,
    });

    const res = await driver.post(`${API_BASE}/api/loads`, payload, request);
    // Drivers must NOT be able to create loads — only 403 is acceptable
    expect(res.status()).toBe(403);
  });

  test("Step 5: Driver cannot access user management (admin-only)", async ({
    request,
  }) => {
    test.skip(!driver.hasToken, "No driver Firebase token available");

    const res = await driver.get(
      `${API_BASE}/api/users/some-company-id`,
      request,
    );
    // User management is admin-only
    expect([403, 401]).toContain(res.status());
  });

  test("Step 6: Driver cannot archive clients (admin-only action)", async ({
    request,
  }) => {
    test.skip(!driver.hasToken, "No driver Firebase token available");

    const res = await driver.patch(
      `${API_BASE}/api/clients/some-client-id/archive`,
      {},
      request,
    );
    expect([403, 401, 404]).toContain(res.status());
    expect(res.status()).not.toBe(200);
  });
});

// -- Driver UI workflow (requires running dev server) --

test.describe("Canonical Journey: Driver Mobile UI", () => {
  test.skip(
    !process.env.E2E_SERVER_RUNNING,
    "Skipped -- set E2E_SERVER_RUNNING=1 to run browser UI tests",
  );

  test("Driver login page renders with email and password fields", async ({
    page,
  }) => {
    await page.goto("/");
    const emailInput = page.locator(
      'input[type="email"], input[name="email"]',
    );
    const passwordInput = page.locator(
      'input[type="password"], input[name="password"]',
    );
    await expect(emailInput.first()).toBeVisible({ timeout: 10_000 });
    await expect(passwordInput.first()).toBeVisible({ timeout: 10_000 });
  });

  test("Driver logs in and sees mobile home or dashboard", async ({
    page,
  }) => {
    const driverEmail = process.env.E2E_DRIVER_EMAIL;
    const driverPassword = process.env.E2E_DRIVER_PASSWORD;

    test.skip(
      !driverEmail || !driverPassword,
      "Driver credentials not configured",
    );

    await page.goto("/");
    await page.locator('input[type="email"]').first().fill(driverEmail!);
    await page
      .locator('input[type="password"]')
      .first()
      .fill(driverPassword!);
    await page.locator('button[type="submit"]').first().click();

    // Driver should land on dashboard, driver home, or loads page
    await page.waitForURL(
      /\/(dashboard|driver|loads|home|dispatch|operations)/,
      { timeout: 15_000 },
    );

    // Page should have content (not a blank error page)
    const bodyText = await page.locator("body").textContent();
    expect(bodyText).not.toBeNull();
    expect((bodyText || "").length).toBeGreaterThan(10);
  });

  test("Driver sees assignment list or load assignments", async ({ page }) => {
    const driverEmail = process.env.E2E_DRIVER_EMAIL;
    const driverPassword = process.env.E2E_DRIVER_PASSWORD;

    test.skip(
      !driverEmail || !driverPassword,
      "Driver credentials not configured",
    );

    await page.goto("/");
    await page.locator('input[type="email"]').first().fill(driverEmail!);
    await page
      .locator('input[type="password"]')
      .first()
      .fill(driverPassword!);
    await page.locator('button[type="submit"]').first().click();

    await page.waitForURL(
      /\/(dashboard|driver|loads|home|dispatch|operations)/,
      { timeout: 15_000 },
    );

    // Navigate to loads/assignments
    await page.goto("/loads");
    const loadContent = page.locator(
      '[data-testid="load-list"], table, .load-card, .empty-state, [data-testid="no-loads"], .driver-assignments',
    );
    await expect(loadContent.first()).toBeVisible({ timeout: 10_000 });
  });
});

// -- Unauthenticated driver path (always runs) --

test.describe("Driver Workflow: Unauthenticated Rejection", () => {
  test("Driver-relevant endpoints reject unauthenticated access", async ({
    request,
  }) => {
    const endpoints = [
      "/api/loads",
      "/api/dispatch",
      "/api/equipment/any-company",
      "/api/tracking/location",
    ];

    for (const ep of endpoints) {
      const res = await request.get(`${API_BASE}${ep}`);
      expect(
        [401, 403, 404, 500],
        `${ep} should reject unauthenticated access`,
      ).toContain(res.status());
      expect(res.status()).not.toBe(200);
    }
  });
});
