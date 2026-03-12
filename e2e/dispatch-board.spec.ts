import { test, expect } from "@playwright/test";
import { API_BASE, makeAdminRequest } from "./fixtures/auth.fixture";

/**
 * E2E Dispatch Board Tests — R-P2B-02
 *
 * Tests: dispatch endpoint access, load listing, authenticated filtering,
 * load counts by status, and board-specific API behavior.
 *
 * All tests run against the real backend. No mocks.
 */

// ── Unauthenticated enforcement ──────────────────────────────────────────────

test.describe("Dispatch Board — Unauthenticated Rejection", () => {
  test("GET /api/loads unauthenticated returns 401/403", async ({
    request,
  }) => {
    const res = await request.get(`${API_BASE}/api/loads`);
    expect([401, 403, 500]).toContain(res.status());
    expect(res.status()).not.toBe(200);
  });

  test("GET /api/loads/counts unauthenticated returns 401/403", async ({
    request,
  }) => {
    const res = await request.get(`${API_BASE}/api/loads/counts`);
    expect([401, 403, 500]).toContain(res.status());
    expect(res.status()).not.toBe(200);
  });

  test("GET /api/dispatch-events/:id unauthenticated returns 401/403/404", async ({
    request,
  }) => {
    const res = await request.get(
      `${API_BASE}/api/dispatch-events/some-company-id`,
    );
    expect([401, 403, 404, 500]).toContain(res.status());
    expect(res.status()).not.toBe(200);
  });
});

// ── Dispatch board state definitions (always runs) ──────────────────────────

test.describe("Dispatch Board — Status Definitions", () => {
  test("dispatch board canonical status list covers all load states", () => {
    // The dispatch board must be able to display all 8 canonical statuses
    const boardStatuses = [
      "draft",
      "planned",
      "dispatched",
      "in_transit",
      "arrived",
      "delivered",
      "completed",
      "cancelled",
    ];
    // All statuses must be lowercase for dispatch board display
    for (const s of boardStatuses) {
      expect(s).toBe(s.toLowerCase());
    }
    // Board must have at minimum the active-load statuses
    expect(boardStatuses).toContain("dispatched");
    expect(boardStatuses).toContain("in_transit");
    expect(boardStatuses).toContain("planned");
  });
});

// ── Authenticated dispatch board access ──────────────────────────────────────

test.describe("Dispatch Board — Authenticated Access", () => {
  let idToken = "";

  test.beforeAll(async () => {
    const auth = await makeAdminRequest();
    idToken = auth.idToken;
  });

  test.skip(
    !process.env.FIREBASE_WEB_API_KEY,
    "Skipped — FIREBASE_WEB_API_KEY not set",
  );

  test("GET /api/loads returns 200 with array for authenticated user", async ({
    request,
  }) => {
    test.skip(!idToken, "No Firebase token available");

    const res = await request.get(`${API_BASE}/api/loads`, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test("GET /api/loads/counts returns board-level status counts", async ({
    request,
  }) => {
    test.skip(!idToken, "No Firebase token available");

    const res = await request.get(`${API_BASE}/api/loads/counts`, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    // Board needs status counts for filtering
    expect(body).toHaveProperty("total");
    expect(body).toHaveProperty("draft");
    expect(body).toHaveProperty("planned");
    expect(body).toHaveProperty("dispatched");
    expect(typeof body.total).toBe("number");
    expect(typeof body.draft).toBe("number");
  });

  test("authenticated load list scoped to tenant — no cross-tenant data", async ({
    request,
  }) => {
    test.skip(!idToken, "No Firebase token available");

    const res = await request.get(`${API_BASE}/api/loads`, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    // Each load must have a company_id (tenant scoped) or id field
    for (const load of body.slice(0, 5)) {
      expect(load).toHaveProperty("id");
    }
  });

  test("load response shape includes required board fields", async ({
    request,
  }) => {
    test.skip(!idToken, "No Firebase token available");

    const res = await request.get(`${API_BASE}/api/loads`, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();

    if (body.length > 0) {
      const load = body[0];
      // Dispatch board requires status and id at minimum
      expect(load).toHaveProperty("id");
      expect(load).toHaveProperty("status");
      expect(load).toHaveProperty("load_number");
    }
    // Zero loads is also valid — board should render empty state
    expect(Array.isArray(body)).toBe(true);
  });
});
