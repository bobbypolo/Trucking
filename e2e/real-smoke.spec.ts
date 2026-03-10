import { test, expect } from "@playwright/test";

/**
 * Real E2E Smoke Tests — R-P3-01
 *
 * Tests hit the REAL Express server backed by Docker MySQL.
 * No mocks. All assertions are against live infrastructure.
 *
 * Requires: Docker MySQL running, Express server started by playwright webServer config.
 */

const API_BASE = process.env.E2E_API_URL || "http://localhost:5000";

test.describe("Real Server — Health Endpoint", () => {
  test("GET /api/health returns 200 with ok status", async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/health`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("status", "ok");
    expect(body).toHaveProperty("message");
    expect(typeof body.message).toBe("string");
  });

  test("health endpoint responds within 2 seconds", async ({ request }) => {
    const start = Date.now();
    const res = await request.get(`${API_BASE}/api/health`);
    const elapsed = Date.now() - start;
    expect(res.status()).toBe(200);
    expect(elapsed).toBeLessThan(2000);
  });
});

test.describe("Real Server — Unauthenticated Request Rejection", () => {
  test("GET /api/loads without auth returns 401 or 500", async ({
    request,
  }) => {
    const res = await request.get(`${API_BASE}/api/loads`);
    expect([401, 403, 500]).toContain(res.status());
    // Must NOT return 200 (would mean auth bypass)
    expect(res.status()).not.toBe(200);
  });

  test("GET /api/users/me without auth is rejected", async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/users/me`);
    // 401 = no auth, 403 = forbidden, 500 = service account missing, 404 = not found (route exists but no match)
    expect([401, 403, 404, 500]).toContain(res.status());
    expect(res.status()).not.toBe(200);
  });

  test("GET /api/equipment without auth is rejected", async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/equipment`);
    // 401 = no auth, 403 = forbidden, 500 = service account missing, 404 = route not found
    expect([401, 403, 404, 500]).toContain(res.status());
    expect(res.status()).not.toBe(200);
  });

  test("POST /api/loads without auth is rejected", async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/loads`, {
      data: { origin: "Chicago, IL", destination: "Detroit, MI" },
    });
    expect([401, 403, 500]).toContain(res.status());
    expect(res.status()).not.toBe(200);
    expect(res.status()).not.toBe(201);
  });

  test("GET /api/accounting/settlements without auth is rejected", async ({
    request,
  }) => {
    const res = await request.get(`${API_BASE}/api/accounting/settlements`);
    expect([401, 403, 500]).toContain(res.status());
    expect(res.status()).not.toBe(200);
  });
});

test.describe("Real Server — Invalid Token Rejection", () => {
  test("Bearer with invalid token string is rejected", async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/loads`, {
      headers: { Authorization: "Bearer invalid-token-value-xyz" },
    });
    expect([401, 403, 500]).toContain(res.status());
    expect(res.status()).not.toBe(200);
  });

  test("Bearer with expired/malformed JWT is rejected", async ({ request }) => {
    // A plausible-looking but invalid JWT
    const fakeJwt =
      "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0IiwidGVuYW50SWQiOiJ0ZXN0LXRlbmFudCJ9.invalidsignature";
    const res = await request.get(`${API_BASE}/api/loads`, {
      headers: { Authorization: `Bearer ${fakeJwt}` },
    });
    expect([401, 403, 500]).toContain(res.status());
    expect(res.status()).not.toBe(200);
  });

  test("Authorization header with wrong scheme is rejected", async ({
    request,
  }) => {
    const res = await request.get(`${API_BASE}/api/loads`, {
      headers: { Authorization: "Basic dXNlcjpwYXNz" },
    });
    expect([401, 403, 500]).toContain(res.status());
    expect(res.status()).not.toBe(200);
  });

  test("Empty Authorization header is rejected", async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/loads`, {
      headers: { Authorization: "" },
    });
    expect([401, 403, 500]).toContain(res.status());
    expect(res.status()).not.toBe(200);
  });
});
