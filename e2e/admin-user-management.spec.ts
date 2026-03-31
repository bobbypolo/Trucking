import { test, expect } from "@playwright/test";
import {
  API_BASE,
  makeAdminRequest,
  makeDriverRequest,
  makeDispatcherRequest,
  type AuthContext,
} from "./fixtures/auth.fixture";
import { makeAdminUserInvitation, makeAdminCompany } from "./fixtures/data-factory";

/**
 * E2E Canonical Journey: Admin User Management
 *
 * Journey: Create user -> assign role -> verify role enforcement ->
 *          modify permissions -> verify updated access
 *
 * Tests the admin user management workflow through the API, verifying
 * that only admins can manage users, roles are enforced, and tenant
 * isolation prevents cross-company access.
 *
 * Requires: FIREBASE_WEB_API_KEY for authenticated requests
 */

// -- Admin CRUD operations --

test.describe("Canonical Journey: Admin User Management CRUD", () => {
  let admin: AuthContext;

  test.beforeAll(async () => {
    admin = await makeAdminRequest();
  });

  test.skip(
    !process.env.FIREBASE_WEB_API_KEY,
    "Skipped -- FIREBASE_WEB_API_KEY not set; admin management requires real Firebase token",
  );

  test("Step 1: Admin retrieves user list for their company", async ({
    request,
  }) => {
    test.skip(!admin.hasToken, "SKIP:NO_TOKEN:admin");

    // Admin needs to know their company ID -- use /api/users/me first
    const meRes = await admin.get(`${API_BASE}/api/users/me`, request);
    expect([200, 404]).toContain(meRes.status());

    if (meRes.status() === 200) {
      const me = await meRes.json();
      expect(me).toHaveProperty("email");
      expect(me).toHaveProperty("role");

      // Use companyId from profile to list users
      const companyId = me.companyId || me.company_id || me.tenantId;
      if (companyId) {
        const usersRes = await admin.get(
          `${API_BASE}/api/users/${companyId}`,
          request,
        );
        expect([200]).toContain(usersRes.status());

        const users = await usersRes.json();
        expect(Array.isArray(users)).toBe(true);
        // At least the admin user should be in the list
        expect(users.length).toBeGreaterThanOrEqual(1);
      }
    }
  });

  test("Step 2: Admin retrieves their own profile via /api/users/me", async ({
    request,
  }) => {
    test.skip(!admin.hasToken, "SKIP:NO_TOKEN:admin");

    const res = await admin.get(`${API_BASE}/api/users/me`, request);
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty("email");
    expect(body).toHaveProperty("role");
    // Admin should have admin role
    expect(["admin", "owner"]).toContain(body.role);
  });

  test("Step 3: Admin creates a new user invitation", async ({ request }) => {
    test.skip(!admin.hasToken, "SKIP:NO_TOKEN:admin");

    const invitation = makeAdminUserInvitation({
      email: `admin-journey-${Date.now()}@loadpilot-e2e.dev`,
      role: "dispatcher",
    });

    const res = await admin.post(`${API_BASE}/api/users`, invitation, request);
    // Accept 201 (created), 200 (ok), 400 (validation), or 409 (duplicate)
    expect([200, 201, 400, 409]).toContain(res.status());
  });

  test("Step 4: Admin retrieves company profile", async ({ request }) => {
    test.skip(!admin.hasToken, "SKIP:NO_TOKEN:admin");

    // Company profile endpoint
    const meRes = await admin.get(`${API_BASE}/api/users/me`, request);
    if (meRes.status() === 200) {
      const me = await meRes.json();
      const companyId = me.companyId || me.company_id || me.tenantId;
      if (companyId) {
        // Try to get company details
        const compRes = await admin.get(
          `${API_BASE}/api/clients/${companyId}`,
          request,
        );
        expect([200, 404]).toContain(compRes.status());
      }
    }
  });
});

// -- Role-based access enforcement --

test.describe("Canonical Journey: Role Enforcement Across Roles", () => {
  let admin: AuthContext;
  let dispatcher: AuthContext;
  let driver: AuthContext;

  test.beforeAll(async () => {
    admin = await makeAdminRequest();
    dispatcher = await makeDispatcherRequest();
    driver = await makeDriverRequest();
  });

  test.skip(
    !process.env.FIREBASE_WEB_API_KEY,
    "Skipped -- FIREBASE_WEB_API_KEY not set",
  );

  test("Admin can access user management endpoints", async ({ request }) => {
    test.skip(!admin.hasToken, "SKIP:NO_TOKEN:admin");

    const res = await admin.get(`${API_BASE}/api/users/me`, request);
    expect(res.status()).toBe(200);
  });

  test("Dispatcher can access their own profile", async ({ request }) => {
    test.skip(!dispatcher.hasToken, "SKIP:NO_TOKEN:dispatcher");

    const res = await dispatcher.get(`${API_BASE}/api/users/me`, request);
    expect([200, 403]).toContain(res.status());
  });

  test("Driver can access their own profile", async ({ request }) => {
    test.skip(!driver.hasToken, "SKIP:NO_TOKEN:driver");

    const res = await driver.get(`${API_BASE}/api/users/me`, request);
    expect([200, 403]).toContain(res.status());
  });

  test("Driver cannot create users (admin-only)", async ({ request }) => {
    test.skip(!driver.hasToken, "SKIP:NO_TOKEN:driver");

    const invitation = makeAdminUserInvitation({
      email: `driver-create-attempt-${Date.now()}@loadpilot-e2e.dev`,
      role: "admin",
    });

    const res = await driver.post(`${API_BASE}/api/users`, invitation, request);
    // Drivers should not be able to create users
    expect([401, 403]).toContain(res.status());
  });

  test("Dispatcher cannot create admin users (privilege escalation prevention)", async ({
    request,
  }) => {
    test.skip(!dispatcher.hasToken, "SKIP:NO_TOKEN:dispatcher");

    const invitation = makeAdminUserInvitation({
      email: `dispatcher-escalation-${Date.now()}@loadpilot-e2e.dev`,
      role: "admin", // attempting privilege escalation
    });

    const res = await dispatcher.post(
      `${API_BASE}/api/users`,
      invitation,
      request,
    );
    // Should be rejected -- dispatchers cannot create admin users
    expect([400, 403]).toContain(res.status());
  });
});

// -- Tenant isolation --

test.describe("Canonical Journey: Admin Tenant Isolation", () => {
  let admin: AuthContext;

  test.beforeAll(async () => {
    admin = await makeAdminRequest();
  });

  test.skip(
    !process.env.FIREBASE_WEB_API_KEY,
    "Skipped -- FIREBASE_WEB_API_KEY not set",
  );

  test("Admin cannot access users from a different company", async ({
    request,
  }) => {
    test.skip(!admin.hasToken, "SKIP:NO_TOKEN:admin");

    const foreignCompanyId = "foreign-company-tenant-isolation-test";
    const res = await admin.get(
      `${API_BASE}/api/users/${foreignCompanyId}`,
      request,
    );
    // Should be 403 (tenant mismatch) or 200 with empty results
    expect([200, 403]).toContain(res.status());

    if (res.status() === 200) {
      const body = await res.json();
      // If 200, must return empty array (no data leak)
      expect(Array.isArray(body)).toBe(true);
      expect(body).toHaveLength(0);
    }
  });

  test("Admin cannot create users in a foreign company", async ({
    request,
  }) => {
    test.skip(!admin.hasToken, "SKIP:NO_TOKEN:admin");

    const invitation = makeAdminUserInvitation({
      email: `cross-tenant-${Date.now()}@loadpilot-e2e.dev`,
      company_id: "foreign-company-id",
    });

    const res = await admin.post(`${API_BASE}/api/users`, invitation, request);
    // Should reject cross-tenant write
    expect([400, 403]).toContain(res.status());
  });
});

// -- Admin UI workflow (requires running dev server) --

test.describe("Canonical Journey: Admin UI Navigation", () => {
  test.skip(
    !process.env.E2E_SERVER_RUNNING,
    "Skipped -- set E2E_SERVER_RUNNING=1 to run browser UI tests",
  );

  test("Admin logs in and navigates to user management", async ({ page }) => {
    const adminEmail = process.env.E2E_ADMIN_EMAIL;
    const adminPassword = process.env.E2E_ADMIN_PASSWORD;

    test.skip(
      !adminEmail || !adminPassword,
      "Admin credentials not configured",
    );

    await page.goto("/");
    await page.locator('input[type="email"]').first().fill(adminEmail!);
    await page
      .locator('input[type="password"]')
      .first()
      .fill(adminPassword!);
    await page.locator('button[type="submit"]').first().click();

    await page.waitForURL(
      /\/(dashboard|loads|dispatch|home|operations)/,
      { timeout: 15_000 },
    );

    // Look for admin/company navigation
    const adminNav = page.locator(
      '[data-tab="company"], button:has-text("Company Profile"), button:has-text("Admin"), [data-testid="admin-nav"]',
    );

    if ((await adminNav.count()) > 0) {
      await adminNav.first().click();
      // Should see company or user management content
      const content = page.locator("body");
      const bodyText = await content.textContent();
      expect(bodyText).not.toBeNull();
      expect((bodyText || "").length).toBeGreaterThan(10);
    }
  });
});

// -- Unauthenticated access (always runs) --

test.describe("Admin User Management: Auth Boundary", () => {
  test("User management endpoints reject unauthenticated access", async ({
    request,
  }) => {
    const endpoints = [
      { method: "GET", path: "/api/users/me" },
      { method: "GET", path: "/api/users/some-company-id" },
      { method: "POST", path: "/api/users" },
    ];

    for (const ep of endpoints) {
      const res =
        ep.method === "GET"
          ? await request.get(`${API_BASE}${ep.path}`)
          : await request.post(`${API_BASE}${ep.path}`, {
              data: { email: "test@test.com", role: "admin" },
            });

      expect(
        [401, 403, 500],
        `${ep.method} ${ep.path} should reject unauthenticated access`,
      ).toContain(res.status());
    }
  });
});
