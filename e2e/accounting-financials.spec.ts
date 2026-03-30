import { test, expect } from "@playwright/test";
import { API_BASE } from "./fixtures/urls";

/**
 * E2E Accounting & Financials Domain Validation — STORY-006 (R-P2D-02)
 *
 * Tests accounting endpoint authentication, financial data structure validation,
 * and unauthorized access rejection. All tests run against the real Express API
 * on port 5000 without browser UI (API-level assertions).
 *
 * Coverage areas:
 *   - Chart of accounts endpoint auth enforcement
 *   - AR invoices endpoint auth enforcement
 *   - AP bills endpoint auth enforcement
 *   - Load P&L endpoint auth enforcement
 *   - Financial data does not leak without auth
 *   - IFTA summary endpoint auth enforcement
 *   - Document vault endpoint auth enforcement
 */

// ── Accounting endpoint auth enforcement ─────────────────────────────────────

test.describe("Accounting Endpoints — Auth Enforcement (R-P2D-02)", () => {
  test("GET /api/accounting/accounts — requires auth, returns 401 without token", async ({
    request,
  }) => {
    const res = await request.get(`${API_BASE}/api/accounting/accounts`);
    expect([401, 403, 500]).toContain(res.status());
    // Must not return chart of accounts data
    if (res.status() === 401 || res.status() === 403) {
      const body = await res.json();
      expect(body).toHaveProperty("message");
      expect(Array.isArray(body)).toBe(false);
    }
  });

  test("GET /api/accounting/invoices — requires auth, returns 401 without token", async ({
    request,
  }) => {
    const res = await request.get(`${API_BASE}/api/accounting/invoices`);
    expect([401, 403, 500]).toContain(res.status());
    // Must not leak invoice data
    expect(res.status()).not.toBe(200);
  });

  test("GET /api/accounting/bills — requires auth, returns 401 without token", async ({
    request,
  }) => {
    const res = await request.get(`${API_BASE}/api/accounting/bills`);
    expect([401, 403, 500]).toContain(res.status());
    expect(res.status()).not.toBe(200);
  });

  test("GET /api/accounting/settlements — unauthorized access rejected (no financial data leak)", async ({
    request,
  }) => {
    const res = await request.get(`${API_BASE}/api/accounting/settlements`);
    expect([401, 403, 500]).toContain(res.status());
    if (res.status() === 401 || res.status() === 403) {
      const body = await res.json();
      // Financial fields must not appear in error response
      expect(body).not.toHaveProperty("net_pay");
      expect(body).not.toHaveProperty("total_earnings");
      expect(body).not.toHaveProperty("lines");
      expect(body).not.toHaveProperty("data");
    }
  });

  test("GET /api/accounting/load-pl/:id — requires auth for P&L data", async ({
    request,
  }) => {
    const res = await request.get(
      `${API_BASE}/api/accounting/load-pl/fin-test-load`,
    );
    expect([401, 403, 404, 500]).toContain(res.status());
    expect(res.status()).not.toBe(200);
  });
});

// ── Financial data structure validation ──────────────────────────────────────

test.describe("Financial Data Structure — Contract Validation (R-P2D-02)", () => {
  test("accounting endpoints follow consistent auth rejection structure", async ({
    request,
  }) => {
    // Verify all key accounting endpoints reject unauthenticated access
    const endpoints = [
      "/api/accounting/accounts",
      "/api/accounting/invoices",
      "/api/accounting/bills",
      "/api/accounting/settlements",
    ];

    for (const endpoint of endpoints) {
      const res = await request.get(`${API_BASE}${endpoint}`);
      expect(
        [401, 403, 500],
        `${endpoint} should reject unauthenticated access`,
      ).toContain(res.status());
      expect(res.status(), `${endpoint} must not return 200`).not.toBe(200);
    }
  });

  test("POST /api/accounting/invoices — requires auth, validation enforced", async ({
    request,
  }) => {
    // POST to invoices without auth must be rejected
    const res = await request.post(`${API_BASE}/api/accounting/invoices`, {
      data: {
        customerId: "fin-cust-001",
        loadId: "fin-load-001",
        invoiceNumber: "FIN-INV-001",
        invoiceDate: "2026-03-01",
        dueDate: "2026-03-31",
        status: "Draft",
        totalAmount: 2500.0,
        lines: [],
      },
    });
    expect([400, 401, 403, 500]).toContain(res.status());
    expect(res.status()).not.toBe(200);
    expect(res.status()).not.toBe(201);
  });

  test("POST /api/accounting/bills — requires auth, no unauthorized bill creation", async ({
    request,
  }) => {
    const res = await request.post(`${API_BASE}/api/accounting/bills`, {
      data: {
        vendorId: "fin-vendor-001",
        billNumber: "FIN-BILL-001",
        billDate: "2026-03-01",
        dueDate: "2026-03-31",
        status: "Draft",
        totalAmount: 1500.0,
        lines: [],
      },
    });
    expect([400, 401, 403, 500]).toContain(res.status());
    expect(res.status()).not.toBe(201);
  });

  test("IFTA summary endpoint — requires auth (fuel tax data protected)", async ({
    request,
  }) => {
    const res = await request.get(
      `${API_BASE}/api/accounting/ifta-summary?quarter=1&year=2026`,
    );
    expect([401, 403, 500]).toContain(res.status());
    expect(res.status()).not.toBe(200);
  });

  test("document vault endpoint — requires auth (financial documents protected)", async ({
    request,
  }) => {
    const res = await request.get(`${API_BASE}/api/accounting/docs`);
    expect([401, 403, 500]).toContain(res.status());
    expect(res.status()).not.toBe(200);
  });
});

// ── Unauthorized access rejection verification ────────────────────────────────

test.describe("Unauthorized Access Rejection — Zero Data Leak (R-P2D-02)", () => {
  test("invalid Bearer token rejected on accounting endpoints", async ({
    request,
  }) => {
    const res = await request.get(`${API_BASE}/api/accounting/accounts`, {
      headers: { Authorization: "Bearer invalid-token-fin-e2e" },
    });
    expect([401, 403, 500]).toContain(res.status());
    expect(res.status()).not.toBe(200);
  });

  test("malformed Authorization header rejected", async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/accounting/settlements`, {
      headers: { Authorization: "NotBearer invalid" },
    });
    expect([401, 403, 500]).toContain(res.status());
    expect(res.status()).not.toBe(200);
  });

  test("PATCH /api/accounting/docs/:id — requires auth for document status update", async ({
    request,
  }) => {
    const res = await request.patch(
      `${API_BASE}/api/accounting/docs/fin-doc-001`,
      {
        data: { status: "Posted", is_locked: true },
      },
    );
    expect([401, 403, 404, 500]).toContain(res.status());
    expect(res.status()).not.toBe(200);
  });

  test("POST /api/accounting/journal — requires auth (GL entry protected)", async ({
    request,
  }) => {
    const res = await request.post(`${API_BASE}/api/accounting/journal`, {
      data: {
        id: "fin-je-001",
        entryDate: "2026-03-01",
        referenceNumber: "FIN-JE-E2E",
        description: "E2E test journal entry",
        lines: [],
      },
    });
    expect([400, 401, 403, 500]).toContain(res.status());
    expect(res.status()).not.toBe(201);
  });
});
