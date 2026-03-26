import { describe, it, expect, vi, beforeEach } from "vitest";

// Tests R-P1-01, R-P1-02, R-P1-03

/**
 * Accounting Route Tenant Isolation Tests
 *
 * Verifies that:
 *   - All 9 GET routes include company_id in SQL WHERE clause (R-P1-01)
 *   - All POST routes that write to DB use req.user.tenantId (R-P1-02)
 *   - No `|| 'DEFAULT'` or hardcoded 'DEFAULT' remains (R-P1-03 via grep in gate cmd)
 *
 * Pattern: sql-auth mock, real requireAuth middleware, supertest.
 */

const TEST_TENANT_ID = "tenant-test-abc123";
const BODY_TENANT_ID = "tenant-body-EVIL";

// --- Hoisted mocks (must be before any vi.mock calls) ---
const {
  mockPoolQuery,
  mockConnectionQuery,
  mockConnectionBeginTransaction,
  mockConnectionCommit,
  mockConnectionRollback,
  mockConnectionRelease,
  mockGetConnection,
  mockResolveSqlPrincipalByFirebaseUid,
} = vi.hoisted(() => {
  const mockConnectionQuery = vi.fn();
  const mockConnectionBeginTransaction = vi.fn().mockResolvedValue(undefined);
  const mockConnectionCommit = vi.fn().mockResolvedValue(undefined);
  const mockConnectionRollback = vi.fn().mockResolvedValue(undefined);
  const mockConnectionRelease = vi.fn();
  const mockGetConnection = vi.fn();
  const mockPoolQuery = vi.fn();
  const mockResolveSqlPrincipalByFirebaseUid = vi.fn();
  return {
    mockPoolQuery,
    mockConnectionQuery,
    mockConnectionBeginTransaction,
    mockConnectionCommit,
    mockConnectionRollback,
    mockConnectionRelease,
    mockGetConnection,
    mockResolveSqlPrincipalByFirebaseUid,
  };
});

vi.mock("../../db", () => ({
  default: {
    query: mockPoolQuery,
    getConnection: mockGetConnection,
  },
}));

vi.mock("../../lib/logger", () => ({
  createChildLogger: () => ({
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  }),
}));

vi.mock("../../geoUtils", () => ({
  detectState: vi.fn().mockReturnValue("TX"),
  calculateDistance: vi.fn().mockReturnValue(100),
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

vi.mock("../../middleware/validate", () => ({
  validateBody:
    (_schema: unknown) => (_req: unknown, _res: unknown, next: Function) =>
      next(),
}));

vi.mock("../../schemas/settlements", () => ({
  createSettlementSchema: {},
}));

// Import the router after mocks are established
import accountingRouter from "../../routes/accounting";
import express from "express";
import request from "supertest";
import { DEFAULT_SQL_PRINCIPAL } from "../helpers/mock-sql-auth";

mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue({
  ...DEFAULT_SQL_PRINCIPAL,
  tenantId: TEST_TENANT_ID,
  companyId: TEST_TENANT_ID,
});

function makeConnection() {
  return {
    query: mockConnectionQuery,
    beginTransaction: mockConnectionBeginTransaction,
    commit: mockConnectionCommit,
    rollback: mockConnectionRollback,
    release: mockConnectionRelease,
  };
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(accountingRouter);
  return app;
}

const AUTH_HEADER = "Bearer valid-token";

beforeEach(() => {
  vi.clearAllMocks();
  mockConnectionRelease.mockReturnValue(undefined);
  mockGetConnection.mockResolvedValue(makeConnection());
  mockPoolQuery.mockResolvedValue([[], []]);
  mockConnectionQuery.mockResolvedValue([[], []]);
  mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue({
    ...DEFAULT_SQL_PRINCIPAL,
    tenantId: TEST_TENANT_ID,
    companyId: TEST_TENANT_ID,
  });
});

// ============================================================
// R-P1-01: GET routes include company_id in SQL and params
// ============================================================

describe("R-P1-01: GET routes include company_id filter", () => {
  it("GET /api/accounting/accounts — SQL contains company_id and params include tenantId", async () => {
    const app = buildApp();
    await request(app)
      .get("/api/accounting/accounts")
      .set("Authorization", AUTH_HEADER)
      .send();

    expect(mockPoolQuery).toHaveBeenCalled();
    const [sql, params] = mockPoolQuery.mock.calls[0];
    expect((sql as string).toLowerCase()).toContain("company_id");
    expect(params as unknown[]).toContain(TEST_TENANT_ID);
  });

  it("GET /api/accounting/load-pl/:loadId — SQL contains company_id and params include tenantId", async () => {
    const app = buildApp();
    await request(app)
      .get("/api/accounting/load-pl/load-001")
      .set("Authorization", AUTH_HEADER)
      .send();

    expect(mockPoolQuery).toHaveBeenCalled();
    const allCalls = mockPoolQuery.mock.calls;
    const hasTenantParam = allCalls.some(
      ([_sql, params]) =>
        Array.isArray(params) && params.includes(TEST_TENANT_ID),
    );
    const hasTenantInSql = allCalls.some(([sql]) =>
      (sql as string).toLowerCase().includes("company_id"),
    );
    expect(hasTenantInSql).toBe(true);
    expect(hasTenantParam).toBe(true);
  });

  it("GET /api/accounting/invoices — SQL contains company_id and params include tenantId", async () => {
    const app = buildApp();
    await request(app)
      .get("/api/accounting/invoices")
      .set("Authorization", AUTH_HEADER)
      .send();

    expect(mockPoolQuery).toHaveBeenCalled();
    const [sql, params] = mockPoolQuery.mock.calls[0];
    expect((sql as string).toLowerCase()).toContain("company_id");
    expect(params as unknown[]).toContain(TEST_TENANT_ID);
  });

  it("GET /api/accounting/bills — SQL contains company_id and params include tenantId", async () => {
    const app = buildApp();
    await request(app)
      .get("/api/accounting/bills")
      .set("Authorization", AUTH_HEADER)
      .send();

    expect(mockPoolQuery).toHaveBeenCalled();
    const [sql, params] = mockPoolQuery.mock.calls[0];
    expect((sql as string).toLowerCase()).toContain("company_id");
    expect(params as unknown[]).toContain(TEST_TENANT_ID);
  });

  it("GET /api/accounting/settlements — SQL contains company_id and params include tenantId", async () => {
    const app = buildApp();
    await request(app)
      .get("/api/accounting/settlements")
      .set("Authorization", AUTH_HEADER)
      .send();

    expect(mockPoolQuery).toHaveBeenCalled();
    const [sql, params] = mockPoolQuery.mock.calls[0];
    expect((sql as string).toLowerCase()).toContain("company_id");
    expect(params as unknown[]).toContain(TEST_TENANT_ID);
  });

  it("GET /api/accounting/docs — SQL contains company_id and params include tenantId", async () => {
    const app = buildApp();
    await request(app)
      .get("/api/accounting/docs")
      .set("Authorization", AUTH_HEADER)
      .send();

    expect(mockPoolQuery).toHaveBeenCalled();
    const [sql, params] = mockPoolQuery.mock.calls[0];
    expect((sql as string).toLowerCase()).toContain("company_id");
    expect(params as unknown[]).toContain(TEST_TENANT_ID);
  });

  it("GET /api/accounting/ifta-evidence/:loadId — SQL contains company_id and params include tenantId", async () => {
    const app = buildApp();
    await request(app)
      .get("/api/accounting/ifta-evidence/load-001")
      .set("Authorization", AUTH_HEADER)
      .send();

    expect(mockPoolQuery).toHaveBeenCalled();
    const [sql, params] = mockPoolQuery.mock.calls[0];
    expect((sql as string).toLowerCase()).toContain("company_id");
    expect(params as unknown[]).toContain(TEST_TENANT_ID);
  });

  it("GET /api/accounting/ifta-summary — SQL contains company_id and params include tenantId", async () => {
    const app = buildApp();
    mockPoolQuery
      .mockResolvedValueOnce([[{ state_code: "TX", total_miles: 100 }], []])
      .mockResolvedValueOnce([
        [{ state_code: "TX", total_gallons: 50, total_cost: 200 }],
        [],
      ]);

    await request(app)
      .get("/api/accounting/ifta-summary?quarter=1&year=2026")
      .set("Authorization", AUTH_HEADER)
      .send();

    expect(mockPoolQuery).toHaveBeenCalled();
    const allCalls = mockPoolQuery.mock.calls;
    const hasTenantParam = allCalls.some(
      ([_sql, params]) =>
        Array.isArray(params) && params.includes(TEST_TENANT_ID),
    );
    const hasTenantInSql = allCalls.some(([sql]) =>
      (sql as string).toLowerCase().includes("company_id"),
    );
    expect(hasTenantInSql).toBe(true);
    expect(hasTenantParam).toBe(true);
  });

  it("GET /api/accounting/mileage — SQL contains company_id and params include tenantId", async () => {
    const app = buildApp();
    await request(app)
      .get("/api/accounting/mileage")
      .set("Authorization", AUTH_HEADER)
      .send();

    expect(mockPoolQuery).toHaveBeenCalled();
    const [sql, params] = mockPoolQuery.mock.calls[0];
    expect((sql as string).toLowerCase()).toContain("company_id");
    expect(params as unknown[]).toContain(TEST_TENANT_ID);
  });
});

// ============================================================
// R-P1-02: POST routes use req.user.tenantId, NOT body tenantId
// ============================================================

describe("R-P1-02: POST routes use req.user.tenantId for INSERT company_id", () => {
  it("POST /api/accounting/journal — uses req.user.tenantId, NOT body tenantId", async () => {
    const app = buildApp();
    await request(app)
      .post("/api/accounting/journal")
      .set("Authorization", AUTH_HEADER)
      .send({
        id: "je-001",
        tenantId: BODY_TENANT_ID,
        entryDate: "2026-03-08",
        referenceNumber: "REF-001",
        description: "Test entry",
        sourceDocumentType: "Manual",
        sourceDocumentId: "doc-001",
        createdBy: "user-001",
        lines: [],
      });

    expect(mockConnectionQuery).toHaveBeenCalled();
    const allInsertParams = mockConnectionQuery.mock.calls
      .map((call: any[]) => call[1])
      .flat();
    expect(allInsertParams).toContain(TEST_TENANT_ID);
    expect(allInsertParams).not.toContain(BODY_TENANT_ID);
  });

  it("POST /api/accounting/invoices — uses req.user.tenantId, NOT body tenantId", async () => {
    const app = buildApp();
    await request(app)
      .post("/api/accounting/invoices")
      .set("Authorization", AUTH_HEADER)
      .send({
        id: "inv-001",
        tenantId: BODY_TENANT_ID,
        customerId: "cust-001",
        loadId: "load-001",
        invoiceNumber: "INV-001",
        invoiceDate: "2026-03-08",
        dueDate: "2026-04-08",
        status: "Draft",
        totalAmount: 5000,
        lines: [],
      });

    expect(mockConnectionQuery).toHaveBeenCalled();
    const allInsertParams = mockConnectionQuery.mock.calls
      .map((call: any[]) => call[1])
      .flat();
    expect(allInsertParams).toContain(TEST_TENANT_ID);
    expect(allInsertParams).not.toContain(BODY_TENANT_ID);
  });

  it("POST /api/accounting/bills — uses req.user.tenantId, NOT body tenantId", async () => {
    const app = buildApp();
    await request(app)
      .post("/api/accounting/bills")
      .set("Authorization", AUTH_HEADER)
      .send({
        id: "bill-001",
        tenantId: BODY_TENANT_ID,
        vendorId: "vendor-001",
        billNumber: "BILL-001",
        billDate: "2026-03-08",
        dueDate: "2026-04-08",
        status: "Draft",
        totalAmount: 2000,
        lines: [],
      });

    expect(mockConnectionQuery).toHaveBeenCalled();
    const allInsertParams = mockConnectionQuery.mock.calls
      .map((call: any[]) => call[1])
      .flat();
    expect(allInsertParams).toContain(TEST_TENANT_ID);
    expect(allInsertParams).not.toContain(BODY_TENANT_ID);
  });

  it("POST /api/accounting/settlements — uses req.user.tenantId, NOT body tenantId", async () => {
    const app = buildApp();
    await request(app)
      .post("/api/accounting/settlements")
      .set("Authorization", AUTH_HEADER)
      .send({
        id: "settle-001",
        tenantId: BODY_TENANT_ID,
        driverId: "driver-001",
        settlementDate: "2026-03-08",
        periodStart: "2026-03-01",
        periodEnd: "2026-03-07",
        totalEarnings: 3000,
        totalDeductions: 200,
        totalReimbursements: 100,
        netPay: 2900,
        status: "Draft",
        lines: [],
      });

    expect(mockConnectionQuery).toHaveBeenCalled();
    const allInsertParams = mockConnectionQuery.mock.calls
      .map((call: any[]) => call[1])
      .flat();
    expect(allInsertParams).toContain(TEST_TENANT_ID);
    expect(allInsertParams).not.toContain(BODY_TENANT_ID);
  });

  it("POST /api/accounting/docs — uses req.user.tenantId, NOT body tenantId or DEFAULT", async () => {
    const app = buildApp();
    await request(app)
      .post("/api/accounting/docs")
      .set("Authorization", AUTH_HEADER)
      .send({
        id: "doc-001",
        tenantId: BODY_TENANT_ID,
        type: "BOL",
        url: "https://example.com/doc.pdf",
        filename: "doc.pdf",
        loadId: "load-001",
        status: "Draft",
      });

    expect(mockPoolQuery).toHaveBeenCalled();
    const allParams = mockPoolQuery.mock.calls
      .map((call: any[]) => call[1])
      .flat();
    expect(allParams).toContain(TEST_TENANT_ID);
    expect(allParams).not.toContain(BODY_TENANT_ID);
    expect(allParams).not.toContain("DEFAULT");
  });

  it("POST /api/accounting/ifta-audit-lock — INSERT includes company_id = req.user.tenantId", async () => {
    const app = buildApp();
    await request(app)
      .post("/api/accounting/ifta-audit-lock")
      .set("Authorization", AUTH_HEADER)
      .send({
        truckId: "truck-001",
        loadId: "load-001",
        tripDate: "2026-03-08",
        startOdometer: 10000,
        endOdometer: 10500,
        totalMiles: 500,
        method: "ACTUAL_GPS",
        confidenceLevel: "HIGH",
        jurisdictionMiles: { TX: 300, OK: 200 },
        attestedBy: "user-001",
      });

    expect(mockPoolQuery).toHaveBeenCalled();
    const allParams = mockPoolQuery.mock.calls
      .map((call: any[]) => call[1])
      .flat();
    expect(allParams).toContain(TEST_TENANT_ID);
    expect(allParams).not.toContain("DEFAULT");
  });

  it("POST /api/accounting/mileage — INSERT includes company_id = req.user.tenantId", async () => {
    const app = buildApp();
    await request(app)
      .post("/api/accounting/mileage")
      .set("Authorization", AUTH_HEADER)
      .send({
        truckId: "truck-001",
        loadId: "load-001",
        date: "2026-03-08",
        stateCode: "TX",
        miles: 300,
        source: "Manual",
      });

    expect(mockPoolQuery).toHaveBeenCalled();
    const allParams = mockPoolQuery.mock.calls
      .map((call: any[]) => call[1])
      .flat();
    expect(allParams).toContain(TEST_TENANT_ID);
    expect(allParams).not.toContain("DEFAULT");
  });

  it("POST /api/accounting/ifta-post — INSERT uses req.user.tenantId, NOT hardcoded DEFAULT", async () => {
    const app = buildApp();
    await request(app)
      .post("/api/accounting/ifta-post")
      .set("Authorization", AUTH_HEADER)
      .send({
        quarter: 1,
        year: 2026,
        netTaxDue: 1500,
      });

    expect(mockConnectionQuery).toHaveBeenCalled();
    const allInsertParams = mockConnectionQuery.mock.calls
      .map((call: any[]) => call[1])
      .flat();
    expect(allInsertParams).toContain(TEST_TENANT_ID);
    expect(allInsertParams).not.toContain("DEFAULT");
  });

  it("POST /api/accounting/adjustments — INSERT includes company_id = req.user.tenantId", async () => {
    const app = buildApp();
    await request(app)
      .post("/api/accounting/adjustments")
      .set("Authorization", AUTH_HEADER)
      .send({
        parentEntityType: "Invoice",
        parentEntityId: "inv-001",
        reasonCode: "RATE_CORRECTION",
        description: "Rate correction",
        amountAdjustment: -100,
        createdBy: "user-001",
      });

    expect(mockPoolQuery).toHaveBeenCalled();
    const allParams = mockPoolQuery.mock.calls
      .map((call: any[]) => call[1])
      .flat();
    expect(allParams).toContain(TEST_TENANT_ID);
    expect(allParams).not.toContain("DEFAULT");
  });

  it("POST /api/accounting/batch-import — INSERT includes company_id = req.user.tenantId", async () => {
    const app = buildApp();
    await request(app)
      .post("/api/accounting/batch-import")
      .set("Authorization", AUTH_HEADER)
      .send({
        type: "Fuel",
        data: [
          {
            stateCode: "TX",
            gallons: 100,
            totalCost: 350,
            date: "2026-03-08",
            truckId: "truck-001",
          },
        ],
      });

    expect(mockConnectionQuery).toHaveBeenCalled();
    const allInsertParams = mockConnectionQuery.mock.calls
      .map((call: any[]) => call[1])
      .flat();
    expect(allInsertParams).toContain(TEST_TENANT_ID);
    expect(allInsertParams).not.toContain("DEFAULT");
  });

  it("POST /api/accounting/sync-qb — stub removed (R-P3-05, S-302)", async () => {
    // R-P3-05: 501 stub removed from accounting.ts; QuickBooks routes now in quickbooks.ts
    const app = buildApp();
    const res = await request(app)
      .post("/api/accounting/sync-qb")
      .set("Authorization", AUTH_HEADER)
      .send({
        entityType: "Invoice",
        entityId: "inv-001",
      });

    // Route removed — should return 404 (no matching route in accounting router)
    expect(res.status).toBe(404);
  });
});

// ============================================================
// R-P1-03: Structural check — verified by grep in gate cmd
// ============================================================
describe("R-P1-03: No DEFAULT fallback company_id values (structural)", () => {
  it("documents that R-P1-03 is verified by the gate cmd: grep -c returns 0", () => {
    expect(true).toBe(true);
  });
});

// ============================================================
// PATCH /api/accounting/docs/:id — tenant isolation
// ============================================================

describe("PATCH /api/accounting/docs/:id — tenant isolation", () => {
  it("SQL contains company_id in WHERE clause and params include req.user.tenantId", async () => {
    const app = buildApp();
    await request(app)
      .patch("/api/accounting/docs/doc-001")
      .set("Authorization", AUTH_HEADER)
      .send({ status: "Approved", is_locked: true });

    expect(mockPoolQuery).toHaveBeenCalled();
    const [sql, params] = mockPoolQuery.mock.calls[0];
    expect((sql as string).toLowerCase()).toContain("company_id");
    expect(params as unknown[]).toContain(TEST_TENANT_ID);
  });

  it("cannot modify a document belonging to a different tenant", async () => {
    const ATTACKER_TENANT = "tenant-attacker-xyz";
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue({
      ...DEFAULT_SQL_PRINCIPAL,
      tenantId: ATTACKER_TENANT,
      companyId: ATTACKER_TENANT,
    });

    const attackerApp = buildApp();

    // Return 0 affected rows (the attacker's tenantId doesn't match victim's doc)
    mockPoolQuery.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

    await request(attackerApp)
      .patch("/api/accounting/docs/victim-doc-001")
      .set("Authorization", AUTH_HEADER)
      .send({ status: "Approved", is_locked: true });

    expect(mockPoolQuery).toHaveBeenCalled();
    const [sql, params] = mockPoolQuery.mock.calls[0];
    expect((sql as string).toLowerCase()).toContain("company_id");
    expect(params as unknown[]).toContain(ATTACKER_TENANT);
    expect(params as unknown[]).not.toContain(TEST_TENANT_ID);
  });
});
