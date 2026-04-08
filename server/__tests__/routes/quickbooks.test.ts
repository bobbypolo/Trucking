import { describe, it, expect, vi, beforeEach } from "vitest";

// Tests R-P3-05, R-P3-06, R-P3-07, R-P3-08

// Hoisted mocks — must be declared before any imports
const {
  mockQuery,
  mockResolveSqlPrincipalByFirebaseUid,
  mockIsQbConfigured,
  mockGetAuthorizationUrl,
  mockHandleCallback,
  mockSyncInvoiceToQBO,
  mockSyncBillToQBO,
  mockGetConnectionStatus,
} = vi.hoisted(() => {
  const mockQuery = vi.fn();
  const mockResolveSqlPrincipalByFirebaseUid = vi.fn();
  const mockIsQbConfigured = vi.fn();
  const mockGetAuthorizationUrl = vi.fn();
  const mockHandleCallback = vi.fn();
  const mockSyncInvoiceToQBO = vi.fn();
  const mockSyncBillToQBO = vi.fn();
  const mockGetConnectionStatus = vi.fn();
  return {
    mockQuery,
    mockResolveSqlPrincipalByFirebaseUid,
    mockIsQbConfigured,
    mockGetAuthorizationUrl,
    mockHandleCallback,
    mockSyncInvoiceToQBO,
    mockSyncBillToQBO,
    mockGetConnectionStatus,
  };
});

vi.mock("../../db", () => ({
  default: {
    query: mockQuery,
  },
}));

vi.mock("../../lib/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    child() {
      return this;
    },
  },
  createChildLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
  createRequestLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock("firebase-admin", () => {
  const mockAuth = {
    verifyIdToken: vi.fn().mockResolvedValue({ uid: "firebase-uid-1" }),
  };
  return {
    default: {
      app: vi.fn(),
      auth: () => mockAuth,
    },
  };
});

vi.mock("../../lib/sql-auth", () => ({
  resolveSqlPrincipalByFirebaseUid: mockResolveSqlPrincipalByFirebaseUid,
}));
vi.mock("../../lib/token-revocation", () => ({
  isTokenRevoked: vi.fn().mockResolvedValue(false),
}));

vi.mock("../../services/quickbooks.service", () => ({
  isQbConfigured: mockIsQbConfigured,
  getAuthorizationUrl: mockGetAuthorizationUrl,
  handleCallback: mockHandleCallback,
  syncInvoiceToQBO: mockSyncInvoiceToQBO,
  syncBillToQBO: mockSyncBillToQBO,
  getConnectionStatus: mockGetConnectionStatus,
}));

import express from "express";
import request from "supertest";
import quickbooksRouter from "../../routes/quickbooks";
import { errorHandler } from "../../middleware/errorHandler";
import { DEFAULT_SQL_PRINCIPAL } from "../helpers/mock-sql-auth";

mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(DEFAULT_SQL_PRINCIPAL);

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(quickbooksRouter);
  app.use(errorHandler);
  return app;
}

// ── R-P3-08: All routes enforce requireAuth + requireTenant ───────────────────

describe("QuickBooks routes — auth enforcement (R-P3-08)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
  });

  it("GET /api/quickbooks/auth-url returns 401 without auth", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/quickbooks/auth-url");
    expect(res.status).toBe(401);
  });

  it("GET /api/quickbooks/callback returns 401 without auth", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/quickbooks/callback");
    expect(res.status).toBe(401);
  });

  it("POST /api/quickbooks/sync-invoice returns 401 without auth", async () => {
    const app = buildApp();
    const res = await request(app).post("/api/quickbooks/sync-invoice");
    expect(res.status).toBe(401);
  });

  it("POST /api/quickbooks/sync-bill returns 401 without auth", async () => {
    const app = buildApp();
    const res = await request(app).post("/api/quickbooks/sync-bill");
    expect(res.status).toBe(401);
  });

  it("GET /api/quickbooks/status returns 401 without auth", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/quickbooks/status");
    expect(res.status).toBe(401);
  });
});

// ── R-P3-06: GET /api/quickbooks/auth-url ─────────────────────────────────────

describe("GET /api/quickbooks/auth-url (R-P3-06)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
  });

  it("returns OAuth URL when configured", async () => {
    mockIsQbConfigured.mockReturnValue(true);
    mockGetAuthorizationUrl.mockResolvedValue({
      url: "https://appcenter.intuit.com/connect/oauth2?client_id=test",
    });

    const app = buildApp();
    const res = await request(app)
      .get("/api/quickbooks/auth-url")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("url");
    expect(res.body.url).toContain("intuit.com");
    expect(mockGetAuthorizationUrl).toHaveBeenCalledWith("company-aaa");
  });

  it("returns 503 when not configured", async () => {
    mockIsQbConfigured.mockReturnValue(false);
    mockGetAuthorizationUrl.mockResolvedValue({
      available: false,
      reason: "no_api_key",
    });

    const app = buildApp();
    const res = await request(app)
      .get("/api/quickbooks/auth-url")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(503);
    expect(res.body).toHaveProperty("error");
  });
});

// ── GET /api/quickbooks/callback ──────────────────────────────────────────────

describe("GET /api/quickbooks/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
  });

  it("exchanges code for tokens and redirects on success", async () => {
    mockHandleCallback.mockResolvedValue({
      success: true,
      realmId: "realm-123",
    });

    const app = buildApp();
    const res = await request(app)
      .get("/api/quickbooks/callback?code=auth-code-1&realmId=realm-123")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain("/settings");
    expect(mockHandleCallback).toHaveBeenCalledWith(
      "company-aaa",
      "auth-code-1",
      "realm-123",
    );
  });

  it("returns 400 when code is missing", async () => {
    const app = buildApp();
    const res = await request(app)
      .get("/api/quickbooks/callback?realmId=realm-123")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("code");
  });

  it("returns 502 when callback fails", async () => {
    mockHandleCallback.mockResolvedValue({
      success: false,
      error: "Token exchange failed",
    });

    const app = buildApp();
    const res = await request(app)
      .get("/api/quickbooks/callback?code=bad-code&realmId=realm-123")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(502);
    expect(res.body.error).toBeTruthy();
  });
});

// ── R-P3-07: POST /api/quickbooks/sync-invoice ───────────────────────────────

describe("POST /api/quickbooks/sync-invoice (R-P3-07)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
  });

  it("syncs invoice and returns QBO reference ID", async () => {
    mockSyncInvoiceToQBO.mockResolvedValue({
      success: true,
      invoiceId: "qbo-inv-001",
    });

    const invoiceData = {
      loadId: "load-001",
      totalAmount: 5000,
      invoiceNumber: "INV-001",
      customerName: "ACME Corp",
      lineItems: [{ description: "Freight", amount: 5000, quantity: 1 }],
    };

    const app = buildApp();
    const res = await request(app)
      .post("/api/quickbooks/sync-invoice")
      .set("Authorization", "Bearer valid-token")
      .send(invoiceData);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("qboInvoiceId", "qbo-inv-001");
    expect(mockSyncInvoiceToQBO).toHaveBeenCalledWith(
      "company-aaa",
      expect.objectContaining({ loadId: "load-001", totalAmount: 5000 }),
    );
  });

  it("returns 503 when QuickBooks not configured", async () => {
    mockSyncInvoiceToQBO.mockResolvedValue({
      success: false,
      error: "QuickBooks not configured",
      available: false,
      reason: "no_api_key",
    });

    const app = buildApp();
    const res = await request(app)
      .post("/api/quickbooks/sync-invoice")
      .set("Authorization", "Bearer valid-token")
      .send({ loadId: "load-002", totalAmount: 100, invoiceNumber: "INV-002" });

    expect(res.status).toBe(503);
  });

  it("returns 502 when sync fails", async () => {
    mockSyncInvoiceToQBO.mockResolvedValue({
      success: false,
      error: "API error",
    });

    const app = buildApp();
    const res = await request(app)
      .post("/api/quickbooks/sync-invoice")
      .set("Authorization", "Bearer valid-token")
      .send({ loadId: "load-003", totalAmount: 200, invoiceNumber: "INV-003" });

    expect(res.status).toBe(502);
    expect(res.body.error).toBeTruthy();
  });
});

// ── POST /api/quickbooks/sync-bill ───────────────────────────────────────────

describe("POST /api/quickbooks/sync-bill", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
  });

  it("syncs bill and returns QBO reference ID", async () => {
    mockSyncBillToQBO.mockResolvedValue({
      success: true,
      billId: "qbo-bill-001",
    });

    const billData = {
      vendorId: "vendor-001",
      totalAmount: 1200,
      billNumber: "BILL-001",
      vendorName: "Fuel Supplier",
      lineItems: [{ description: "Diesel", amount: 1200, quantity: 1 }],
    };

    const app = buildApp();
    const res = await request(app)
      .post("/api/quickbooks/sync-bill")
      .set("Authorization", "Bearer valid-token")
      .send(billData);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("qboBillId", "qbo-bill-001");
    expect(mockSyncBillToQBO).toHaveBeenCalledWith(
      "company-aaa",
      expect.objectContaining({ vendorId: "vendor-001", totalAmount: 1200 }),
    );
  });

  it("returns 503 when QuickBooks not configured", async () => {
    mockSyncBillToQBO.mockResolvedValue({
      success: false,
      error: "QuickBooks not configured",
      available: false,
      reason: "no_api_key",
    });

    const app = buildApp();
    const res = await request(app)
      .post("/api/quickbooks/sync-bill")
      .set("Authorization", "Bearer valid-token")
      .send({
        vendorId: "vendor-002",
        totalAmount: 800,
        billNumber: "BILL-002",
      });

    expect(res.status).toBe(503);
  });
});

// ── GET /api/quickbooks/status ───────────────────────────────────────────────

describe("GET /api/quickbooks/status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
  });

  it("returns connection state when connected", async () => {
    mockGetConnectionStatus.mockResolvedValue({
      connected: true,
      realmId: "realm-123",
      expiresAt: "2026-04-01T00:00:00.000Z",
    });

    const app = buildApp();
    const res = await request(app)
      .get("/api/quickbooks/status")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("connected", true);
    expect(res.body).toHaveProperty("realmId", "realm-123");
  });

  it("returns not-connected state", async () => {
    mockGetConnectionStatus.mockResolvedValue({
      connected: false,
      reason: "no_tokens",
    });

    const app = buildApp();
    const res = await request(app)
      .get("/api/quickbooks/status")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("connected", false);
  });

  it("returns 503 when not configured", async () => {
    mockGetConnectionStatus.mockResolvedValue({
      available: false,
      reason: "no_api_key",
    });

    const app = buildApp();
    const res = await request(app)
      .get("/api/quickbooks/status")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(503);
  });
});

// ── R-P3-05: 501 stub removed from accounting.ts ─────────────────────────────

describe("501 stub removed from accounting.ts (R-P3-05)", () => {
  it("accounting.ts should not contain a 501 QuickBooks stub", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const accountingPath = path.resolve(
      __dirname,
      "../../routes/accounting.ts",
    );
    const content = fs.readFileSync(accountingPath, "utf8");
    expect(content).not.toContain("501");
    expect(content).not.toContain(
      "QuickBooks integration is not yet available",
    );
    expect(content).not.toContain("sync-qb");
  });
});

