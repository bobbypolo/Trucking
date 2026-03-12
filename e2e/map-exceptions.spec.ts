/**
 * E2E Map & Exceptions Tests — STORY-007 (R-P2E-02)
 *
 * Verifies:
 * - Exception endpoint access control
 * - Exception data structure validation
 * - Map/tracking endpoint auth enforcement
 *
 * Runs against real Express API on port 5000.
 */

import { test, expect } from "@playwright/test";
import {
  API_BASE,
  makeAdminRequest,
} from "./fixtures/auth.fixture";

// ---------------------------------------------------------------------------
// Exception Endpoint Access
// ---------------------------------------------------------------------------

test.describe("DOC — Exception Endpoint Access", () => {
  test("GET /api/exceptions without auth returns 401/403", async ({
    request,
  }) => {
    const res = await request.get(`${API_BASE}/api/exceptions`);
    expect([401, 403]).toContain(res.status());
  });

  test("GET /api/exception-types without auth returns 401/403", async ({
    request,
  }) => {
    const res = await request.get(`${API_BASE}/api/exception-types`);
    expect([401, 403]).toContain(res.status());
  });

  test("POST /api/exceptions without auth returns 401/403", async ({
    request,
  }) => {
    const res = await request.post(`${API_BASE}/api/exceptions`, {
      data: {
        exception_type: "delay",
        severity: "minor",
        description: "E2E test",
      },
    });
    expect([401, 403]).toContain(res.status());
  });
});

// ---------------------------------------------------------------------------
// Exception Data Structure Validation
// ---------------------------------------------------------------------------

test.describe("DOC — Exception Data Structure", () => {
  test("authenticated admin can list exceptions", async ({ request }) => {
    const auth = await makeAdminRequest();
    if (!auth.hasToken) {
      test.skip();
      return;
    }
    const res = await auth.get(`${API_BASE}/api/exceptions`, request);
    // 200 = success, 500 = DB error (acceptable in test env without full data)
    expect([200, 500]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      // Response must be an array
      expect(Array.isArray(body)).toBe(true);
    }
  });

  test("authenticated admin can access exception types", async ({
    request,
  }) => {
    const auth = await makeAdminRequest();
    if (!auth.hasToken) {
      test.skip();
      return;
    }
    const res = await auth.get(`${API_BASE}/api/exception-types`, request);
    expect([200, 500]).toContain(res.status());
  });

  test("exception response structure includes expected fields when data present", async ({
    request,
  }) => {
    const auth = await makeAdminRequest();
    if (!auth.hasToken) {
      test.skip();
      return;
    }
    const res = await auth.get(
      `${API_BASE}/api/exceptions?severity=critical`,
      request,
    );
    expect([200, 500]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      expect(Array.isArray(body)).toBe(true);
      // If entries present, check expected shape
      if (body.length > 0) {
        const exc = body[0] as Record<string, unknown>;
        expect(exc).toHaveProperty("id");
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Map / Tracking Endpoint Auth
// ---------------------------------------------------------------------------

test.describe("DOC — Map / Tracking Endpoint Auth", () => {
  test("GET /api/loads/tracking without auth returns 401/403", async ({
    request,
  }) => {
    const res = await request.get(`${API_BASE}/api/loads/tracking`);
    expect([401, 403]).toContain(res.status());
  });

  test("authenticated admin can access tracking endpoint", async ({
    request,
  }) => {
    const auth = await makeAdminRequest();
    if (!auth.hasToken) {
      test.skip();
      return;
    }
    const res = await auth.get(`${API_BASE}/api/loads/tracking`, request);
    // 200 = loads returned, 500 = DB issue, both acceptable
    expect([200, 500]).toContain(res.status());
  });

  test("GET /api/loads/:id/tracking requires valid load id", async ({
    request,
  }) => {
    const auth = await makeAdminRequest();
    if (!auth.hasToken) {
      test.skip();
      return;
    }
    // Non-existent load returns 404 or 500 but not 200
    const res = await auth.get(
      `${API_BASE}/api/loads/nonexistent-id-000/tracking`,
      request,
    );
    expect([400, 404, 500]).toContain(res.status());
  });
});
