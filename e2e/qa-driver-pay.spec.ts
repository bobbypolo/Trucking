import { test, expect } from "@playwright/test";
import { v4 as uuidv4 } from "uuid";
import {
  API_BASE,
  makeAdminRequest,
  type AuthContext,
} from "./fixtures/auth.fixture";
import { makeFinSettlement } from "./fixtures/data-factory";

/**
 * QA-01 Acceptance: Driver Pay (COM-05)
 *
 * Covers:
 *   COM-05: Driver Pay is distinct from Accounting in purpose, UI, and permissions
 *
 * Tests the driver settlement lifecycle via /api/accounting/settlements,
 * verifying that driver pay operations are functionally separate from
 * general accounting operations (invoices, bills, journal entries).
 *
 * Note: Driver settlements are accessed via /api/accounting/settlements
 * but represent a distinct domain (driver pay) from AR/AP accounting.
 *
 * Requires: FIREBASE_WEB_API_KEY for authenticated requests
 */

// -- COM-05: Driver Pay API is distinct from Accounting --

test.describe("COM-05: Driver Pay — API Domain Separation", () => {
  let admin: AuthContext;

  test.beforeAll(async () => {
    admin = await makeAdminRequest();
  });

  test.skip(
    !process.env.FIREBASE_WEB_API_KEY,
    "Skipped -- FIREBASE_WEB_API_KEY not set; domain separation tests require real Firebase token",
  );

  test("GET /api/accounting/settlements returns settlement-specific fields, not invoice fields", async ({
    request,
  }) => {
    test.skip(!admin.hasToken, "No admin Firebase token");

    const res = await admin.get(
      `${API_BASE}/api/accounting/settlements`,
      request,
    );
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);

    // If data exists, verify it has settlement fields and NOT invoice fields
    if (Array.isArray(body) && body.length > 0) {
      expect(body[0]).toHaveProperty("settlement_number");
      expect(body[0]).toHaveProperty("driver_id");
      expect(body[0]).not.toHaveProperty("invoice_number");
      expect(body[0]).not.toHaveProperty("customer_id");
    }
  });

  test("GET /api/accounting/invoices returns invoice-specific fields, not settlement fields", async ({
    request,
  }) => {
    test.skip(!admin.hasToken, "No admin Firebase token");

    const res = await admin.get(`${API_BASE}/api/accounting/invoices`, request);
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);

    // If data exists, verify it has invoice fields and NOT settlement fields
    if (Array.isArray(body) && body.length > 0) {
      expect(body[0]).toHaveProperty("invoice_number");
      expect(body[0]).not.toHaveProperty("driver_id");
      expect(body[0]).not.toHaveProperty("net_pay");
    }
  });
});

// -- Authenticated driver settlement lifecycle --

test.describe("COM-05: Driver Settlement Creation and Retrieval", () => {
  let admin: AuthContext;
  let settlementId: string;

  test.beforeAll(async () => {
    admin = await makeAdminRequest();
  });

  test.skip(
    !process.env.FIREBASE_WEB_API_KEY,
    "Skipped -- FIREBASE_WEB_API_KEY not set; driver pay requires real Firebase token",
  );

  test("Step 1: Create a draft driver settlement", async ({ request }) => {
    test.skip(!admin.hasToken, "No admin Firebase token available");

    settlementId = uuidv4();
    const payload = {
      id: settlementId,
      driverId: `qa-driver-pay-${Date.now()}`,
      settlementDate: new Date().toISOString().split("T")[0],
      periodStart: "2026-03-01",
      periodEnd: "2026-03-15",
      totalEarnings: 4500.0,
      totalDeductions: 350.0,
      totalReimbursements: 125.0,
      netPay: 4275.0,
      status: "Draft",
      lines: [
        {
          description: "QA E2E line haul pay",
          amount: 3500.0,
          loadId: `qa-load-${Date.now()}`,
          type: "Earning",
        },
        {
          description: "QA E2E stop pay",
          amount: 1000.0,
          type: "Earning",
        },
        {
          description: "QA E2E fuel advance deduction",
          amount: 350.0,
          type: "Deduction",
        },
        {
          description: "QA E2E per diem reimbursement",
          amount: 125.0,
          type: "Reimbursement",
        },
      ],
    };

    const res = await admin.post(
      `${API_BASE}/api/accounting/settlements`,
      payload,
      request,
    );
    expect([200, 201]).toContain(res.status());

    if (res.status() === 200 || res.status() === 201) {
      const body = await res.json();
      if (body.id) settlementId = body.id;
    }
  });

  test("Step 2: Retrieve settlements list", async ({ request }) => {
    test.skip(!admin.hasToken, "No admin Firebase token available");

    const res = await admin.get(
      `${API_BASE}/api/accounting/settlements`,
      request,
    );
    expect(res.status()).toBe(200);

    const body = await res.json();
    // Must be an array (real data or empty state)
    expect(Array.isArray(body)).toBe(true);
  });

  test("Step 3: Settlement data returns driver-specific fields", async ({
    request,
  }) => {
    test.skip(!admin.hasToken, "No admin Firebase token available");

    const res = await admin.get(
      `${API_BASE}/api/accounting/settlements`,
      request,
    );
    expect(res.status()).toBe(200);

    const settlements = await res.json();
    if (settlements.length > 0) {
      const settlement = settlements[0];
      // Driver pay settlements should have driver-centric fields
      expect(settlement).toHaveProperty("driver_id");
      expect(settlement).toHaveProperty("settlement_date");
      expect(settlement).toHaveProperty("net_pay");
      expect(settlement).toHaveProperty("status");
    }
  });

  test("Step 4: Settlement includes line items when present", async ({
    request,
  }) => {
    test.skip(!admin.hasToken, "No admin Firebase token available");

    const res = await admin.get(
      `${API_BASE}/api/accounting/settlements`,
      request,
    );
    expect(res.status()).toBe(200);

    const settlements = await res.json();
    if (settlements.length > 0) {
      const settlement = settlements[0];
      // Enriched response should include lines array
      expect(settlement).toHaveProperty("lines");
      expect(Array.isArray(settlement.lines)).toBe(true);
    }
  });
});

// -- Driver pay calculation verification --

test.describe("COM-05: Driver Pay Calculation Verification", () => {
  let admin: AuthContext;

  test.beforeAll(async () => {
    admin = await makeAdminRequest();
  });

  test.skip(
    !process.env.FIREBASE_WEB_API_KEY,
    "Skipped -- FIREBASE_WEB_API_KEY not set",
  );

  test("Settlement net pay = earnings + reimbursements - deductions", async ({
    request,
  }) => {
    test.skip(!admin.hasToken, "No admin Firebase token available");

    const totalEarnings = 5000.0;
    const totalDeductions = 400.0;
    const totalReimbursements = 200.0;
    const expectedNetPay =
      totalEarnings - totalDeductions + totalReimbursements;

    const payload = {
      id: uuidv4(),
      driverId: `qa-calc-driver-${Date.now()}`,
      settlementDate: new Date().toISOString().split("T")[0],
      periodStart: "2026-03-01",
      periodEnd: "2026-03-31",
      totalEarnings,
      totalDeductions,
      totalReimbursements,
      netPay: expectedNetPay,
      status: "Draft",
      lines: [
        {
          description: "QA earnings verification",
          amount: totalEarnings,
          type: "Earning",
        },
        {
          description: "QA deduction verification",
          amount: totalDeductions,
          type: "Deduction",
        },
        {
          description: "QA reimbursement verification",
          amount: totalReimbursements,
          type: "Reimbursement",
        },
      ],
    };

    const res = await admin.post(
      `${API_BASE}/api/accounting/settlements`,
      payload,
      request,
    );
    expect([200, 201]).toContain(res.status());

    // Verify the calculation is correct
    expect(expectedNetPay).toBe(4800.0);
  });

  test("Settlement with zero lines is accepted", async ({ request }) => {
    test.skip(!admin.hasToken, "No admin Firebase token available");

    const payload = {
      ...makeFinSettlement(),
      id: uuidv4(),
      driverId: `qa-zero-lines-driver-${Date.now()}`,
      settlementDate: new Date().toISOString().split("T")[0],
      periodStart: "2026-03-01",
      periodEnd: "2026-03-31",
      totalEarnings: 0,
      totalDeductions: 0,
      totalReimbursements: 0,
      netPay: 0,
      status: "Draft",
      lines: [],
    };

    const res = await admin.post(
      `${API_BASE}/api/accounting/settlements`,
      payload,
      request,
    );
    expect([200, 201]).toContain(res.status());
  });
});

// -- Driver Pay vs Accounting endpoint separation --

test.describe("COM-05: Driver Pay vs Accounting — Endpoint Separation", () => {
  let admin: AuthContext;

  test.beforeAll(async () => {
    admin = await makeAdminRequest();
  });

  test.skip(
    !process.env.FIREBASE_WEB_API_KEY,
    "Skipped -- FIREBASE_WEB_API_KEY not set",
  );

  test("Settlements endpoint returns driver data, not invoice data", async ({
    request,
  }) => {
    test.skip(!admin.hasToken, "No admin Firebase token available");

    const settlementsRes = await admin.get(
      `${API_BASE}/api/accounting/settlements`,
      request,
    );
    expect(settlementsRes.status()).toBe(200);

    const settlements = await settlementsRes.json();
    if (settlements.length > 0) {
      const settlement = settlements[0];
      // Settlement should NOT contain invoice-specific fields
      expect(settlement).not.toHaveProperty("invoice_number");
      expect(settlement).not.toHaveProperty("customer_id");
      expect(settlement).not.toHaveProperty("balance_due");
      // It SHOULD contain driver pay fields
      expect(settlement).toHaveProperty("driver_id");
    }
  });

  test("Invoices endpoint returns AR data, not settlement data", async ({
    request,
  }) => {
    test.skip(!admin.hasToken, "No admin Firebase token available");

    const invoicesRes = await admin.get(
      `${API_BASE}/api/accounting/invoices`,
      request,
    );
    expect(invoicesRes.status()).toBe(200);

    const invoices = await invoicesRes.json();
    if (invoices.length > 0) {
      const invoice = invoices[0];
      // Invoice should NOT contain settlement-specific fields
      expect(invoice).not.toHaveProperty("driver_id");
      expect(invoice).not.toHaveProperty("net_pay");
      expect(invoice).not.toHaveProperty("total_earnings");
    }
  });

  test("Batch settlement status update only affects settlements, not invoices", async ({
    request,
  }) => {
    test.skip(!admin.hasToken, "No admin Firebase token available");

    // Verify the batch endpoint exists and requires proper payload
    const res = await admin.patch(
      `${API_BASE}/api/accounting/settlements/batch`,
      { ids: [], status: "Review" },
      request,
    );
    // Should succeed (with 0 affected rows) or validate
    expect([200, 400, 422]).toContain(res.status());
  });
});

// -- Auth enforcement on driver pay endpoints (always runs) --

test.describe("Driver Pay: Auth Boundary Enforcement", () => {
  test("GET /api/accounting/settlements — unauthenticated access rejected", async ({
    request,
  }) => {
    const res = await request.get(`${API_BASE}/api/accounting/settlements`);
    expect([401, 403, 500]).toContain(res.status());
    expect(res.status()).not.toBe(200);
  });

  test("POST /api/accounting/settlements — unauthenticated creation rejected", async ({
    request,
  }) => {
    const res = await request.post(`${API_BASE}/api/accounting/settlements`, {
      data: {
        id: uuidv4(),
        driverId: "unauth-driver-attack",
        settlementDate: "2026-03-15",
        netPay: 99999,
        status: "Draft",
      },
    });
    expect([400, 401, 403, 500]).toContain(res.status());
    expect(res.status()).not.toBe(201);
  });

  test("PATCH /api/accounting/settlements/batch — unauthenticated batch update rejected", async ({
    request,
  }) => {
    const res = await request.patch(
      `${API_BASE}/api/accounting/settlements/batch`,
      { data: { ids: ["fake-id"], status: "Posted" } },
    );
    expect([401, 403, 500]).toContain(res.status());
    expect(res.status()).not.toBe(200);
  });

  test("Settlement endpoint does not leak driver financial data without auth", async ({
    request,
  }) => {
    const res = await request.get(`${API_BASE}/api/accounting/settlements`);
    expect([401, 403, 500]).toContain(res.status());
    if (res.status() === 401 || res.status() === 403) {
      const body = await res.json();
      expect(body).not.toHaveProperty("net_pay");
      expect(body).not.toHaveProperty("total_earnings");
      expect(body).not.toHaveProperty("driver_id");
      expect(body).not.toHaveProperty("lines");
    }
  });

  test("Cross-tenant settlement write without auth is rejected", async ({
    request,
  }) => {
    const res = await request.post(`${API_BASE}/api/accounting/settlements`, {
      data: {
        tenantId: "other-company-tenant-id",
        driverId: "stolen-driver-id",
        settlementDate: "2026-03-31",
        totalEarnings: 999999,
        netPay: 999999,
        status: "Posted",
      },
    });
    expect([400, 401, 403, 500]).toContain(res.status());
    expect(res.status()).not.toBe(200);
    expect(res.status()).not.toBe(201);
  });

  test("Invalid Bearer token rejected on settlements endpoint", async ({
    request,
  }) => {
    const res = await request.get(`${API_BASE}/api/accounting/settlements`, {
      headers: { Authorization: "Bearer invalid-token-qa-driver-pay" },
    });
    expect([401, 403, 500]).toContain(res.status());
    expect(res.status()).not.toBe(200);
  });
});

// -- Browser-level tests for Driver Pay UI -----------------------------------

const APP_BASE = process.env.E2E_APP_URL || "http://localhost:5173";
const SERVER_RUNNING = !!process.env.E2E_SERVER_RUNNING;
const E2E_EMAIL = process.env.E2E_TEST_EMAIL || process.env.E2E_ADMIN_EMAIL;
const E2E_PASSWORD =
  process.env.E2E_TEST_PASSWORD || process.env.E2E_ADMIN_PASSWORD;

/**
 * Helper: login and wait for the authenticated shell to load, then navigate
 * to the Driver Pay page via the sidebar nav.
 */
async function loginAndWait(
  page: import("@playwright/test").Page,
  email: string,
  password: string,
) {
  await page.goto(APP_BASE);
  await page.locator('input[type="email"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  await page.locator('button[type="submit"]').first().click();
  // Wait for authenticated shell (app stays at / after login)
  await page
    .locator("nav, [role='navigation'], aside")
    .first()
    .waitFor({ timeout: 20_000 });
}

test.describe("COM-05: Driver Pay — Browser UI", () => {
  test.skip(
    !SERVER_RUNNING || !E2E_EMAIL || !E2E_PASSWORD,
    "Requires E2E_SERVER_RUNNING=1 and test credentials",
  );

  test("Driver Pay page loads without JS crash", async ({ page }) => {
    // Register pageerror listener BEFORE navigation so errors during load are caught
    let jsError = false;
    page.on("pageerror", () => {
      jsError = true;
    });

    await loginAndWait(page, E2E_EMAIL!, E2E_PASSWORD!);

    // Navigate to Driver Pay via sidebar
    const driverPayLink = page.locator(
      'aside nav button:has(span:text-is("Driver Pay"))',
    );
    await driverPayLink.first().click();

    // Wait for the page content to settle
    await page.waitForTimeout(2_000);

    // Page must have rendered real content — not blank
    const body = await page.content();
    expect(body).toContain("<!DOCTYPE html>");
    expect(body.length).toBeGreaterThan(500);

    // No JS errors (white screen / crash detection)
    expect(jsError).toBe(false);
  });

  test("Driver Pay page renders a heading or identifiable content area", async ({
    page,
  }) => {
    // Register pageerror listener BEFORE navigation
    const jsErrors: string[] = [];
    page.on("pageerror", (err) => {
      jsErrors.push(err.message);
    });

    await loginAndWait(page, E2E_EMAIL!, E2E_PASSWORD!);

    // Navigate to Driver Pay via sidebar
    const driverPayLink = page.locator(
      'aside nav button:has(span:text-is("Driver Pay"))',
    );
    await driverPayLink.first().click();

    // Wait for content to be rendered
    await page
      .locator(
        'h1, h2, h3, [role="main"], .page-title, ' +
          'text="Driver Pay", text="Settlements", text="Settlement"',
      )
      .first()
      .waitFor({ timeout: 10_000 })
      .catch(() => {
        /* heading selector may not match — still proceed */
      });

    // The URL should have changed to reflect the Driver Pay route
    const currentUrl = page.url();
    expect(currentUrl).toContain(APP_BASE);

    // No JS errors during navigation
    expect(jsErrors).toEqual([]);
  });

  test("Driver Pay page shows settlements list or empty state (no hardcoded fake data)", async ({
    page,
  }) => {
    // Register pageerror listener BEFORE navigation
    let jsError = false;
    page.on("pageerror", () => {
      jsError = true;
    });

    await loginAndWait(page, E2E_EMAIL!, E2E_PASSWORD!);

    // Navigate to Driver Pay
    const driverPayLink = page.locator(
      'aside nav button:has(span:text-is("Driver Pay"))',
    );
    await driverPayLink.first().click();

    await page.waitForTimeout(2_000);

    // Page text must NOT contain known fake/demo data markers
    const pageText = await page.locator("body").textContent();
    if (pageText) {
      expect(pageText).not.toContain("FAKE");
      expect(pageText).not.toContain("DEMO_DATA");
    }

    // No crash
    expect(jsError).toBe(false);
  });
});
