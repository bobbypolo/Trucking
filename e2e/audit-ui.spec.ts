/**
 * E2E Audit UI Tests — STORY-002 (R-P1-06)
 *
 * Verifies:
 *   - GET /api/audit returns 401 without auth (R-P1-06 case 1)
 *   - GET /api/audit returns structured response with valid auth (R-P1-06 case 2)
 *   - Response contains expected fields: id, event_type, created_at (R-P1-06 case 3)
 *
 * API-level tests that work without a live Vite frontend server.
 * Browser-level component tests are skipped if server is not running.
 */

import { test, expect } from "@playwright/test";
import { API_BASE, makeAdminRequest } from "./fixtures/auth.fixture";

// ── API auth enforcement (always runs) ────────────────────────────────────────

test.describe("Audit Endpoint — Auth Enforcement", () => {
  test("GET /api/audit without auth returns 401 or 403", async ({
    request,
  }) => {
    const res = await request.get(`${API_BASE}/api/audit`);
    expect([401, 403]).toContain(res.status());
    expect(res.status()).not.toBe(200);
  });

  test("GET /api/audit with invalid token returns 401 or 403", async ({
    request,
  }) => {
    const res = await request.get(`${API_BASE}/api/audit`, {
      headers: { Authorization: "Bearer invalid-token-xyz" },
    });
    expect([401, 403]).toContain(res.status());
    expect(res.status()).not.toBe(200);
  });
});

// ── Authenticated API tests (skipped when creds unavailable) ──────────────────

test.describe("Audit Endpoint — Authenticated Access", () => {
  test("returns structured response with valid auth", async ({ request }) => {
    const auth = await makeAdminRequest();
    if (!auth.hasToken) {
      test.skip(true, "SKIP:NO_TOKEN:admin");
      return;
    }

    const res = await auth.get(`${API_BASE}/api/audit`, request);
    expect(res.status()).toBe(200);

    const body = (await res.json()) as unknown;
    expect(body).toHaveProperty("entries");
    expect(body).toHaveProperty("total");
    expect(Array.isArray((body as { entries: unknown[] }).entries)).toBe(true);
    expect(typeof (body as { total: number }).total).toBe("number");
  });

  test("response entries contain expected fields when non-empty", async ({
    request,
  }) => {
    const auth = await makeAdminRequest();
    if (!auth.hasToken) {
      test.skip(true, "SKIP:NO_TOKEN:admin");
      return;
    }

    const res = await auth.get(`${API_BASE}/api/audit`, request);
    expect(res.status()).toBe(200);

    const body = (await res.json()) as { entries: unknown[]; total: number };
    if (body.entries.length === 0) {
      // No data to check — pass trivially (empty tenant is valid)
      return;
    }

    const entry = body.entries[0] as Record<string, unknown>;
    // Required fields from the audit route contract
    expect(entry).toHaveProperty("id");
    expect(entry).toHaveProperty("event_type");
    expect(entry).toHaveProperty("created_at");
  });

  test("supports limit/offset pagination query params", async ({ request }) => {
    const auth = await makeAdminRequest();
    if (!auth.hasToken) {
      test.skip(true, "SKIP:NO_TOKEN:admin");
      return;
    }

    const res = await auth.get(
      `${API_BASE}/api/audit?limit=10&offset=0`,
      request,
    );
    expect(res.status()).toBe(200);

    const body = (await res.json()) as { entries: unknown[]; total: number };
    expect(Array.isArray(body.entries)).toBe(true);
    // Limit is respected — entries should not exceed 10
    expect(body.entries.length).toBeLessThanOrEqual(10);
  });
});

// ── Scope label — document that this is load/dispatch audit only ──────────────

test.describe("Audit Endpoint — Scope Documentation", () => {
  test("endpoint is specifically /api/audit (not /api/audit-logs or other)", async ({
    request,
  }) => {
    // The correct endpoint path is /api/audit
    const res = await request.get(`${API_BASE}/api/audit`);
    // Unauthenticated — but the endpoint MUST exist (not 404)
    expect(res.status()).not.toBe(404);
    // Must require auth (401/403)
    expect([401, 403]).toContain(res.status());
  });
});
