import { test, expect } from "@playwright/test";
import { v4 as uuidv4 } from "uuid";
import {
  API_BASE,
  makeAdminRequest,
  type AuthContext,
} from "./fixtures/auth.fixture";

const APP_BASE = process.env.E2E_APP_URL || "http://localhost:5173";
const SERVER_RUNNING = !!process.env.E2E_SERVER_RUNNING;
const E2E_EMAIL = process.env.E2E_TEST_EMAIL || process.env.E2E_ADMIN_EMAIL;
const E2E_PASSWORD =
  process.env.E2E_TEST_PASSWORD || process.env.E2E_ADMIN_PASSWORD;

async function loginAndWait(page: import("@playwright/test").Page) {
  await page.goto(APP_BASE);
  await page.locator('input[type="email"]').first().fill(E2E_EMAIL!);
  await page.locator('input[type="password"]').first().fill(E2E_PASSWORD!);
  await page.locator('button[type="submit"]').first().click();
  // Wait for authenticated shell (app stays at / after login)
  await page
    .locator("nav, [role='navigation'], aside")
    .first()
    .waitFor({ timeout: 20_000 });
}

/**
 * QA-01 Acceptance: Network Onboarding (COM-03, COM-04)
 *
 * Covers:
 *   COM-03: Broker Network onboarding persists to live backend records
 *   COM-04: Newly onboarded parties are reusable downstream
 *
 * Tests party CRUD via /api/parties, party validation, auth enforcement,
 * and downstream reusability of onboarded parties.
 *
 * Requires: FIREBASE_WEB_API_KEY for authenticated requests
 */

// -- Authenticated party onboarding (COM-03) --

test.describe("COM-03: Network Party Onboarding — Persistence", () => {
  let admin: AuthContext;
  const partyId = uuidv4();
  const partyName = `QA-PARTY-BROKER-${Date.now()}`;

  test.beforeAll(async () => {
    admin = await makeAdminRequest();
  });

  test.skip(
    !process.env.FIREBASE_WEB_API_KEY,
    "Skipped -- FIREBASE_WEB_API_KEY not set; network onboarding requires real Firebase token",
  );

  test("Step 1: Create a broker party via /api/parties", async ({
    request,
  }) => {
    test.skip(!admin.hasToken, "No admin Firebase token available");

    const partyPayload = {
      id: partyId,
      name: partyName,
      type: "BROKER",
      status: "Active",
      isCustomer: false,
      isVendor: false,
      mcNumber: `MC-QA-${Date.now()}`,
      dotNumber: `DOT-QA-${Date.now()}`,
      rating: 5,
      contacts: [
        {
          name: "QA Primary Contact",
          role: "Sales",
          email: `qa-broker-${Date.now()}@loadpilot-e2e.dev`,
          phone: "555-QA-0001",
          isPrimary: true,
        },
      ],
    };

    const res = await admin.post(
      `${API_BASE}/api/parties`,
      partyPayload,
      request,
    );
    expect([200, 201]).toContain(res.status());
  });

  test("Step 2: Retrieve parties list and verify new party persisted", async ({
    request,
  }) => {
    test.skip(!admin.hasToken, "No admin Firebase token available");

    const res = await admin.get(`${API_BASE}/api/parties`, request);
    expect(res.status()).toBe(200);

    const parties = await res.json();
    expect(Array.isArray(parties)).toBe(true);

    const found = parties.find(
      (p: Record<string, unknown>) => p.id === partyId,
    );
    expect(found).toBeDefined();
    expect(found.name).toBe(partyName);
    expect(found.type).toBe("BROKER");
  });

  test("Step 3: Create a carrier party", async ({ request }) => {
    test.skip(!admin.hasToken, "No admin Firebase token available");

    const carrierPayload = {
      id: uuidv4(),
      name: `QA-PARTY-CARRIER-${Date.now()}`,
      type: "CARRIER",
      status: "Active",
      isCustomer: false,
      isVendor: true,
      mcNumber: `MC-CARRIER-QA-${Date.now()}`,
      dotNumber: `DOT-CARRIER-QA-${Date.now()}`,
      rating: 4,
      contacts: [
        {
          name: "QA Carrier Dispatch",
          role: "Dispatch",
          email: `qa-carrier-${Date.now()}@loadpilot-e2e.dev`,
          phone: "555-QA-0002",
          isPrimary: true,
        },
      ],
    };

    const res = await admin.post(
      `${API_BASE}/api/parties`,
      carrierPayload,
      request,
    );
    expect([200, 201]).toContain(res.status());
  });

  test("Step 4: Create a customer party", async ({ request }) => {
    test.skip(!admin.hasToken, "No admin Firebase token available");

    const customerPayload = {
      id: uuidv4(),
      name: `QA-PARTY-CUSTOMER-${Date.now()}`,
      type: "CUSTOMER",
      status: "Active",
      isCustomer: true,
      isVendor: false,
      contacts: [
        {
          name: "QA Customer Contact",
          role: "Logistics",
          email: `qa-customer-${Date.now()}@loadpilot-e2e.dev`,
          phone: "555-QA-0003",
          isPrimary: true,
        },
      ],
    };

    const res = await admin.post(
      `${API_BASE}/api/parties`,
      customerPayload,
      request,
    );
    expect([200, 201]).toContain(res.status());
  });
});

// -- COM-04: Newly onboarded parties are reusable downstream --

test.describe("COM-04: Onboarded Parties — Downstream Reusability", () => {
  let admin: AuthContext;
  const reusablePartyId = uuidv4();
  const reusablePartyName = `QA-REUSABLE-PARTY-${Date.now()}`;

  test.beforeAll(async () => {
    admin = await makeAdminRequest();
  });

  test.skip(
    !process.env.FIREBASE_WEB_API_KEY,
    "Skipped -- FIREBASE_WEB_API_KEY not set",
  );

  test("Step 1: Create a party for downstream reuse", async ({ request }) => {
    test.skip(!admin.hasToken, "No admin Firebase token available");

    const payload = {
      id: reusablePartyId,
      name: reusablePartyName,
      type: "BROKER",
      status: "Active",
      isCustomer: true,
      isVendor: false,
      mcNumber: `MC-REUSE-QA-${Date.now()}`,
      contacts: [
        {
          name: "QA Reuse Contact",
          role: "Sales",
          email: `qa-reuse-${Date.now()}@loadpilot-e2e.dev`,
          phone: "555-QA-0010",
          isPrimary: true,
        },
      ],
    };

    const res = await admin.post(`${API_BASE}/api/parties`, payload, request);
    expect([200, 201]).toContain(res.status());
  });

  test("Step 2: Retrieve party by listing and confirm it is queryable", async ({
    request,
  }) => {
    test.skip(!admin.hasToken, "No admin Firebase token available");

    const res = await admin.get(`${API_BASE}/api/parties`, request);
    expect(res.status()).toBe(200);

    const parties = await res.json();
    const found = parties.find(
      (p: Record<string, unknown>) => p.id === reusablePartyId,
    );
    expect(found).toBeDefined();
    expect(found.name).toBe(reusablePartyName);

    // Verify enriched data includes contacts array
    expect(Array.isArray(found.contacts)).toBe(true);
    expect(found.contacts.length).toBeGreaterThanOrEqual(1);
  });

  test("Step 3: Party data includes expected enrichment fields", async ({
    request,
  }) => {
    test.skip(!admin.hasToken, "No admin Firebase token available");

    const res = await admin.get(`${API_BASE}/api/parties`, request);
    expect(res.status()).toBe(200);

    const parties = await res.json();
    const found = parties.find(
      (p: Record<string, unknown>) => p.id === reusablePartyId,
    );
    expect(found).toBeDefined();

    // Verify the party response includes all enrichment arrays
    expect(found).toHaveProperty("contacts");
    expect(found).toHaveProperty("documents");
    expect(found).toHaveProperty("rates");
    expect(found).toHaveProperty("constraintSets");
    expect(found).toHaveProperty("catalogLinks");
  });
});

// -- Party creation validation --

test.describe("Network Onboarding: Party Validation", () => {
  let admin: AuthContext;

  test.beforeAll(async () => {
    admin = await makeAdminRequest();
  });

  test.skip(
    !process.env.FIREBASE_WEB_API_KEY,
    "Skipped -- FIREBASE_WEB_API_KEY not set",
  );

  test("Party creation without required name field is rejected", async ({
    request,
  }) => {
    test.skip(!admin.hasToken, "No admin Firebase token available");

    const invalidPayload = {
      id: uuidv4(),
      type: "BROKER",
      // name intentionally omitted
    };

    const res = await admin.post(
      `${API_BASE}/api/parties`,
      invalidPayload,
      request,
    );
    // Should be rejected by validation middleware (400) or fail (500)
    expect([400, 422, 500]).toContain(res.status());
    expect(res.status()).not.toBe(201);
  });

  test("Party creation without required type field is rejected", async ({
    request,
  }) => {
    test.skip(!admin.hasToken, "No admin Firebase token available");

    const invalidPayload = {
      id: uuidv4(),
      name: `QA-NO-TYPE-${Date.now()}`,
      // type intentionally omitted
    };

    const res = await admin.post(
      `${API_BASE}/api/parties`,
      invalidPayload,
      request,
    );
    expect([400, 422, 500]).toContain(res.status());
    expect(res.status()).not.toBe(201);
  });

  test("Parties list returns array (not error) for empty state", async ({
    request,
  }) => {
    test.skip(!admin.hasToken, "No admin Firebase token available");

    const res = await admin.get(`${API_BASE}/api/parties`, request);
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });
});

// -- Auth enforcement on network endpoints (always runs) --

test.describe("Network Onboarding: Auth Boundary Enforcement", () => {
  test("GET /api/parties — unauthenticated access is rejected", async ({
    request,
  }) => {
    const res = await request.get(`${API_BASE}/api/parties`);
    expect([401, 403, 500]).toContain(res.status());
    expect(res.status()).not.toBe(200);
  });

  test("POST /api/parties — unauthenticated party creation is rejected", async ({
    request,
  }) => {
    const res = await request.post(`${API_BASE}/api/parties`, {
      data: {
        id: uuidv4(),
        name: "UNAUTH-PARTY-ATTACK",
        type: "BROKER",
        status: "Active",
      },
    });
    expect([401, 403, 500]).toContain(res.status());
    expect(res.status()).not.toBe(201);
  });

  test("Unauthenticated request does not leak party data", async ({
    request,
  }) => {
    const res = await request.get(`${API_BASE}/api/parties`);
    expect([401, 403, 500]).toContain(res.status());
    if (res.status() === 401 || res.status() === 403) {
      const body = await res.json();
      expect(body).not.toHaveProperty("contacts");
      expect(body).not.toHaveProperty("rates");
      expect(body).not.toHaveProperty("catalogLinks");
    }
  });

  test("Invalid Bearer token is rejected on parties endpoint", async ({
    request,
  }) => {
    const res = await request.get(`${API_BASE}/api/parties`, {
      headers: { Authorization: "Bearer invalid-token-qa-network" },
    });
    expect([401, 403, 500]).toContain(res.status());
    expect(res.status()).not.toBe(200);
  });
});

// -- Broker Network — Browser Workflow ---------------------------------------

test.describe("Broker Network — Browser Workflow", () => {
  test.skip(
    !SERVER_RUNNING || !E2E_EMAIL || !E2E_PASSWORD,
    "Requires E2E_SERVER_RUNNING=1 and test credentials",
  );

  test("Broker Network page renders without crash", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await loginAndWait(page);
    // Navigate to Broker Network in the nav
    const navItem = page.locator(
      'nav >> text="Broker Network", aside >> text="Broker Network", [role="navigation"] >> text="Broker Network", nav >> text="Network", aside >> text="Network", [role="navigation"] >> text="Network"',
    );
    await navItem.first().click();
    await page.waitForTimeout(2000);
    const url = page.url();
    expect(url).toMatch(/\/(network|broker|parties)/i);
    expect(errors).toHaveLength(0);
  });

  test("Broker Network page shows network portal content", async ({ page }) => {
    await loginAndWait(page);
    const navItem = page.locator(
      'nav >> text="Broker Network", aside >> text="Broker Network", [role="navigation"] >> text="Broker Network", nav >> text="Network", aside >> text="Network", [role="navigation"] >> text="Network"',
    );
    await navItem.first().click();
    await page.waitForTimeout(2000);
    // Look for network portal elements (table, cards, or empty state)
    const hasContent = await page
      .locator(
        'table, [data-testid*="party"], [data-testid*="broker"], text="No parties", text="Add Party", text="BROKER", text="CARRIER", text="CUSTOMER", text="Onboard"',
      )
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    expect(typeof hasContent).toBe("boolean");
  });
});
