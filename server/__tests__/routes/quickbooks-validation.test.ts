import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoisted mocks
const { mockResolveSqlPrincipalByFirebaseUid, mockSyncInvoice, mockSyncBill } =
  vi.hoisted(() => ({
    mockResolveSqlPrincipalByFirebaseUid: vi.fn(),
    mockSyncInvoice: vi.fn(),
    mockSyncBill: vi.fn(),
  }));

vi.mock("../../db", () => ({
  default: {
    query: vi.fn(),
    getConnection: vi.fn(),
  },
}));

vi.mock("../../lib/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnThis(),
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
  getAuthorizationUrl: vi.fn(),
  handleCallback: vi.fn(),
  syncInvoiceToQBO: mockSyncInvoice,
  syncBillToQBO: mockSyncBill,
  getConnectionStatus: vi.fn(),
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

// Tests R-SEC-17, R-SEC-18
describe("R-SEC-17, R-SEC-18: quickbooks.ts validateBody wiring", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
    app = buildApp();
  });

  it("POST /api/quickbooks/sync-invoice with empty body returns 400 VALIDATION", async () => {
    const res = await request(app)
      .post("/api/quickbooks/sync-invoice")
      .set("Authorization", "Bearer valid-token")
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error_class).toBe("VALIDATION");
  });

  it("POST /api/quickbooks/sync-invoice with missing loadId returns 400", async () => {
    const res = await request(app)
      .post("/api/quickbooks/sync-invoice")
      .set("Authorization", "Bearer valid-token")
      .send({ totalAmount: 1500 });
    expect(res.status).toBe(400);
    expect(res.body.error_class).toBe("VALIDATION");
  });

  it("POST /api/quickbooks/sync-invoice with negative totalAmount returns 400", async () => {
    const res = await request(app)
      .post("/api/quickbooks/sync-invoice")
      .set("Authorization", "Bearer valid-token")
      .send({ loadId: "load-001", totalAmount: -100 });
    expect(res.status).toBe(400);
    expect(res.body.error_class).toBe("VALIDATION");
  });

  it("POST /api/quickbooks/sync-invoice with valid body proceeds", async () => {
    mockSyncInvoice.mockResolvedValueOnce({
      success: true,
      invoiceId: "qbo-inv-001",
    });
    const res = await request(app)
      .post("/api/quickbooks/sync-invoice")
      .set("Authorization", "Bearer valid-token")
      .send({ loadId: "load-001", totalAmount: 1500 });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.qboInvoiceId).toBe("qbo-inv-001");
  });

  it("POST /api/quickbooks/sync-bill with empty body returns 400 VALIDATION", async () => {
    const res = await request(app)
      .post("/api/quickbooks/sync-bill")
      .set("Authorization", "Bearer valid-token")
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error_class).toBe("VALIDATION");
  });

  it("POST /api/quickbooks/sync-bill with missing vendorId returns 400", async () => {
    const res = await request(app)
      .post("/api/quickbooks/sync-bill")
      .set("Authorization", "Bearer valid-token")
      .send({ totalAmount: 800 });
    expect(res.status).toBe(400);
    expect(res.body.error_class).toBe("VALIDATION");
  });

  it("POST /api/quickbooks/sync-bill with negative totalAmount returns 400", async () => {
    const res = await request(app)
      .post("/api/quickbooks/sync-bill")
      .set("Authorization", "Bearer valid-token")
      .send({ vendorId: "vendor-001", totalAmount: -50 });
    expect(res.status).toBe(400);
    expect(res.body.error_class).toBe("VALIDATION");
  });

  it("POST /api/quickbooks/sync-bill with valid body proceeds", async () => {
    mockSyncBill.mockResolvedValueOnce({
      success: true,
      billId: "qbo-bill-001",
    });
    const res = await request(app)
      .post("/api/quickbooks/sync-bill")
      .set("Authorization", "Bearer valid-token")
      .send({ vendorId: "vendor-001", totalAmount: 800 });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.qboBillId).toBe("qbo-bill-001");
  });
});
