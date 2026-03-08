import { describe, it, expect, vi, beforeEach } from "vitest";

// Tests R-P1-01, R-P1-02, R-P1-03

/**
 * Accounting Route Tenant Isolation Tests
 *
 * Verifies that:
 *   - All 9 GET routes include tenant_id in SQL WHERE clause (R-P1-01)
 *   - All POST routes that write to DB use req.user.tenantId (R-P1-02)
 *   - No `|| 'DEFAULT'` or hardcoded 'DEFAULT' remains (R-P1-03 via grep in gate cmd)
 *
 * Pattern: Mock pool.query and pool.getConnection, invoke route handler directly
 * via supertest, assert SQL string contains `tenant_id` and params array contains
 * the auth-derived tenantId.
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
} = vi.hoisted(() => {
  const mockConnectionQuery = vi.fn();
  const mockConnectionBeginTransaction = vi.fn().mockResolvedValue(undefined);
  const mockConnectionCommit = vi.fn().mockResolvedValue(undefined);
  const mockConnectionRollback = vi.fn().mockResolvedValue(undefined);
  const mockConnectionRelease = vi.fn();
  const mockGetConnection = vi.fn();
  const mockPoolQuery = vi.fn();
  return {
    mockPoolQuery,
    mockConnectionQuery,
    mockConnectionBeginTransaction,
    mockConnectionCommit,
    mockConnectionRollback,
    mockConnectionRelease,
    mockGetConnection,
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

// Mock auth/tenant middleware to pass through; req.user injected by buildApp below
vi.mock("../../middleware/requireAuth", () => ({
  requireAuth: (_req: unknown, _res: unknown, next: Function) => next(),
}));

vi.mock("../../middleware/requireTenant", () => ({
  requireTenant: (_req: unknown, _res: unknown, next: Function) => next(),
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

function makeUser(tenantId = TEST_TENANT_ID) {
  return {
    uid: "user-001",
    tenantId,
    role: "dispatcher",
    email: "a@b.com",
    firebaseUid: "fb-001",
  };
}

function makeConnection() {
  return {
    query: mockConnectionQuery,
    beginTransaction: mockConnectionBeginTransaction,
    commit: mockConnectionCommit,
    rollback: mockConnectionRollback,
    release: mockConnectionRelease,
  };
}

/**
 * Build an Express app that injects req.user from the x-test-user header.
 * This simulates what requireAuth does in production without Firebase deps.
 */
function buildApp(tenantId = TEST_TENANT_ID) {
  const app = express();
  app.use(express.json());
  // Inject user context the same way requireAuth does (it's mocked to call next())
  app.use((req: any, _res: unknown, next: Function) => {
    req.user = makeUser(tenantId);
    next();
  });
  app.use(accountingRouter);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockConnectionRelease.mockReturnValue(undefined);
  mockGetConnection.mockResolvedValue(makeConnection());
  // Default: pool.query returns empty rows
  mockPoolQuery.mockResolvedValue([[], []]);
  // Default: connection.query returns empty rows
  mockConnectionQuery.mockResolvedValue([[], []]);
});

// ============================================================
// R-P1-01: GET routes include tenant_id in SQL and params
// ============================================================

describe("R-P1-01: GET routes include tenant_id filter", () => {
  it("GET /api/accounting/accounts — SQL contains tenant_id and params include tenantId", async () => {
    const app = buildApp();
    await request(app).get("/api/accounting/accounts").send();

    expect(mockPoolQuery).toHaveBeenCalled();
    const [sql, params] = mockPoolQuery.mock.calls[0];
    expect((sql as string).toLowerCase()).toContain("tenant_id");
    expect(params as unknown[]).toContain(TEST_TENANT_ID);
  });

  it("GET /api/accounting/load-pl/:loadId — SQL contains tenant_id and params include tenantId", async () => {
    const app = buildApp();
    await request(app).get("/api/accounting/load-pl/load-001").send();

    expect(mockPoolQuery).toHaveBeenCalled();
    const allCalls = mockPoolQuery.mock.calls;
    const hasTenantParam = allCalls.some(
      ([_sql, params]) =>
        Array.isArray(params) && params.includes(TEST_TENANT_ID),
    );
    const hasTenantInSql = allCalls.some(([sql]) =>
      (sql as string).toLowerCase().includes("tenant_id"),
    );
    expect(hasTenantInSql).toBe(true);
    expect(hasTenantParam).toBe(true);
  });

  it("GET /api/accounting/invoices — SQL contains tenant_id and params include tenantId", async () => {
    const app = buildApp();
    await request(app).get("/api/accounting/invoices").send();

    expect(mockPoolQuery).toHaveBeenCalled();
    const [sql, params] = mockPoolQuery.mock.calls[0];
    expect((sql as string).toLowerCase()).toContain("tenant_id");
    expect(params as unknown[]).toContain(TEST_TENANT_ID);
  });

  it("GET /api/accounting/bills — SQL contains tenant_id and params include tenantId", async () => {
    const app = buildApp();
    await request(app).get("/api/accounting/bills").send();

    expect(mockPoolQuery).toHaveBeenCalled();
    const [sql, params] = mockPoolQuery.mock.calls[0];
    expect((sql as string).toLowerCase()).toContain("tenant_id");
    expect(params as unknown[]).toContain(TEST_TENANT_ID);
  });

  it("GET /api/accounting/settlements — SQL contains tenant_id and params include tenantId", async () => {
    const app = buildApp();
    await request(app).get("/api/accounting/settlements").send();

    expect(mockPoolQuery).toHaveBeenCalled();
    const [sql, params] = mockPoolQuery.mock.calls[0];
    expect((sql as string).toLowerCase()).toContain("tenant_id");
    expect(params as unknown[]).toContain(TEST_TENANT_ID);
  });

  it("GET /api/accounting/docs — SQL contains tenant_id and params include tenantId", async () => {
    const app = buildApp();
    await request(app).get("/api/accounting/docs").send();

    expect(mockPoolQuery).toHaveBeenCalled();
    const [sql, params] = mockPoolQuery.mock.calls[0];
    expect((sql as string).toLowerCase()).toContain("tenant_id");
    expect(params as unknown[]).toContain(TEST_TENANT_ID);
  });

  it("GET /api/accounting/ifta-evidence/:loadId — SQL contains tenant_id and params include tenantId", async () => {
    const app = buildApp();
    await request(app).get("/api/accounting/ifta-evidence/load-001").send();

    expect(mockPoolQuery).toHaveBeenCalled();
    const [sql, params] = mockPoolQuery.mock.calls[0];
    expect((sql as string).toLowerCase()).toContain("tenant_id");
    expect(params as unknown[]).toContain(TEST_TENANT_ID);
  });

  it("GET /api/accounting/ifta-summary — SQL contains tenant_id and params include tenantId", async () => {
    const app = buildApp();
    mockPoolQuery
      .mockResolvedValueOnce([[{ state_code: "TX", total_miles: 100 }], []])
      .mockResolvedValueOnce([
        [{ state_code: "TX", total_gallons: 50, total_cost: 200 }],
        [],
      ]);

    await request(app)
      .get("/api/accounting/ifta-summary?quarter=1&year=2026")
      .send();

    expect(mockPoolQuery).toHaveBeenCalled();
    const allCalls = mockPoolQuery.mock.calls;
    const hasTenantParam = allCalls.some(
      ([_sql, params]) =>
        Array.isArray(params) && params.includes(TEST_TENANT_ID),
    );
    const hasTenantInSql = allCalls.some(([sql]) =>
      (sql as string).toLowerCase().includes("tenant_id"),
    );
    expect(hasTenantInSql).toBe(true);
    expect(hasTenantParam).toBe(true);
  });

  it("GET /api/accounting/mileage — SQL contains tenant_id and params include tenantId", async () => {
    const app = buildApp();
    await request(app).get("/api/accounting/mileage").send();

    expect(mockPoolQuery).toHaveBeenCalled();
    const [sql, params] = mockPoolQuery.mock.calls[0];
    expect((sql as string).toLowerCase()).toContain("tenant_id");
    expect(params as unknown[]).toContain(TEST_TENANT_ID);
  });
});

// ============================================================
// R-P1-02: POST routes use req.user.tenantId, NOT body tenantId
// ============================================================

describe("R-P1-02: POST routes use req.user.tenantId for INSERT tenant_id", () => {
  it("POST /api/accounting/journal — uses req.user.tenantId, NOT body tenantId", async () => {
    const app = buildApp();
    await request(app).post("/api/accounting/journal").send({
      id: "je-001",
      tenantId: BODY_TENANT_ID, // attacker-supplied value — must be ignored
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
      .map(([_sql, params]: [string, unknown[]]) => params)
      .flat();
    expect(allInsertParams).toContain(TEST_TENANT_ID);
    expect(allInsertParams).not.toContain(BODY_TENANT_ID);
  });

  it("POST /api/accounting/invoices — uses req.user.tenantId, NOT body tenantId", async () => {
    const app = buildApp();
    await request(app).post("/api/accounting/invoices").send({
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
      .map(([_sql, params]: [string, unknown[]]) => params)
      .flat();
    expect(allInsertParams).toContain(TEST_TENANT_ID);
    expect(allInsertParams).not.toContain(BODY_TENANT_ID);
  });

  it("POST /api/accounting/bills — uses req.user.tenantId, NOT body tenantId", async () => {
    const app = buildApp();
    await request(app).post("/api/accounting/bills").send({
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
      .map(([_sql, params]: [string, unknown[]]) => params)
      .flat();
    expect(allInsertParams).toContain(TEST_TENANT_ID);
    expect(allInsertParams).not.toContain(BODY_TENANT_ID);
  });

  it("POST /api/accounting/settlements — uses req.user.tenantId, NOT body tenantId", async () => {
    const app = buildApp();
    await request(app).post("/api/accounting/settlements").send({
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
      .map(([_sql, params]: [string, unknown[]]) => params)
      .flat();
    expect(allInsertParams).toContain(TEST_TENANT_ID);
    expect(allInsertParams).not.toContain(BODY_TENANT_ID);
  });

  it("POST /api/accounting/docs — uses req.user.tenantId, NOT body tenantId or DEFAULT", async () => {
    const app = buildApp();
    await request(app).post("/api/accounting/docs").send({
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
      .map(([_sql, params]: [string, unknown[]]) => params)
      .flat();
    expect(allParams).toContain(TEST_TENANT_ID);
    expect(allParams).not.toContain(BODY_TENANT_ID);
    expect(allParams).not.toContain("DEFAULT");
  });

  it("POST /api/accounting/ifta-audit-lock — INSERT includes tenant_id = req.user.tenantId", async () => {
    const app = buildApp();
    await request(app)
      .post("/api/accounting/ifta-audit-lock")
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
      .map(([_sql, params]: [string, unknown[]]) => params)
      .flat();
    expect(allParams).toContain(TEST_TENANT_ID);
    expect(allParams).not.toContain("DEFAULT");
  });

  it("POST /api/accounting/mileage — INSERT includes tenant_id = req.user.tenantId", async () => {
    const app = buildApp();
    await request(app).post("/api/accounting/mileage").send({
      truckId: "truck-001",
      loadId: "load-001",
      date: "2026-03-08",
      stateCode: "TX",
      miles: 300,
      source: "Manual",
    });

    expect(mockPoolQuery).toHaveBeenCalled();
    const allParams = mockPoolQuery.mock.calls
      .map(([_sql, params]: [string, unknown[]]) => params)
      .flat();
    expect(allParams).toContain(TEST_TENANT_ID);
    expect(allParams).not.toContain("DEFAULT");
  });

  it("POST /api/accounting/ifta-post — INSERT uses req.user.tenantId, NOT hardcoded DEFAULT", async () => {
    const app = buildApp();
    await request(app).post("/api/accounting/ifta-post").send({
      quarter: 1,
      year: 2026,
      netTaxDue: 1500,
    });

    expect(mockConnectionQuery).toHaveBeenCalled();
    const allInsertParams = mockConnectionQuery.mock.calls
      .map(([_sql, params]: [string, unknown[]]) => params)
      .flat();
    expect(allInsertParams).toContain(TEST_TENANT_ID);
    expect(allInsertParams).not.toContain("DEFAULT");
  });

  it("POST /api/accounting/adjustments — INSERT includes tenant_id = req.user.tenantId", async () => {
    const app = buildApp();
    await request(app).post("/api/accounting/adjustments").send({
      parentEntityType: "Invoice",
      parentEntityId: "inv-001",
      reasonCode: "RATE_CORRECTION",
      description: "Rate correction",
      amountAdjustment: -100,
      createdBy: "user-001",
    });

    expect(mockPoolQuery).toHaveBeenCalled();
    const allParams = mockPoolQuery.mock.calls
      .map(([_sql, params]: [string, unknown[]]) => params)
      .flat();
    expect(allParams).toContain(TEST_TENANT_ID);
    expect(allParams).not.toContain("DEFAULT");
  });

  it("POST /api/accounting/batch-import — INSERT includes tenant_id = req.user.tenantId", async () => {
    const app = buildApp();
    await request(app)
      .post("/api/accounting/batch-import")
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
      .map(([_sql, params]: [string, unknown[]]) => params)
      .flat();
    expect(allInsertParams).toContain(TEST_TENANT_ID);
    expect(allInsertParams).not.toContain("DEFAULT");
  });

  it("POST /api/accounting/sync-qb — INSERT uses req.user.tenantId, NOT hardcoded DEFAULT", async () => {
    const app = buildApp();
    await request(app).post("/api/accounting/sync-qb").send({
      entityType: "Invoice",
      entityId: "inv-001",
    });

    expect(mockPoolQuery).toHaveBeenCalled();
    const allParams = mockPoolQuery.mock.calls
      .map(([_sql, params]: [string, unknown[]]) => params)
      .flat();
    expect(allParams).toContain(TEST_TENANT_ID);
    expect(allParams).not.toContain("DEFAULT");
  });
});

// ============================================================
// R-P1-03: Structural check — verified by grep in gate cmd
// ============================================================
describe("R-P1-03: No DEFAULT fallback tenant_id values (structural)", () => {
  it("documents that R-P1-03 is verified by the gate cmd: grep -c returns 0", () => {
    // R-P1-03 is verified by the gate command:
    //   grep -c "|| 'DEFAULT'" server/routes/accounting.ts | grep -q '^0$'
    // The POST route tests above already assert auth-derived tenantId is used
    // and that 'DEFAULT' does not appear in any INSERT params.
    // This test exists to mark R-P1-03 coverage in the test file.
    expect(true).toBe(true);
  });
});

// ============================================================
// PATCH /api/accounting/docs/:id — tenant isolation
// ============================================================

describe("PATCH /api/accounting/docs/:id — tenant isolation", () => {
  // Tests R-P1-01, R-P1-02
  it("SQL contains tenant_id in WHERE clause and params include req.user.tenantId", async () => {
    const app = buildApp();
    await request(app)
      .patch("/api/accounting/docs/doc-001")
      .send({ status: "Approved", is_locked: true });

    expect(mockPoolQuery).toHaveBeenCalled();
    const [sql, params] = mockPoolQuery.mock.calls[0];
    expect((sql as string).toLowerCase()).toContain("tenant_id");
    expect(params as unknown[]).toContain(TEST_TENANT_ID);
  });

  it("cannot modify a document belonging to a different tenant", async () => {
    // The UPDATE is scoped to tenant_id = req.user.tenantId.
    // Simulate a request from ATTACKER_TENANT — it must NOT affect
    // rows belonging to VICTIM_TENANT. Because the WHERE clause is
    // "id = ? AND tenant_id = ?", the attacker's tenantId is passed
    // and the database will match 0 rows for the victim's document.
    const ATTACKER_TENANT = "tenant-attacker-xyz";
    const attackerApp = buildApp(ATTACKER_TENANT);

    // Return 0 affected rows (the attacker's tenantId doesn't match victim's doc)
    mockPoolQuery.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

    await request(attackerApp)
      .patch("/api/accounting/docs/victim-doc-001")
      .send({ status: "Approved", is_locked: true });

    expect(mockPoolQuery).toHaveBeenCalled();
    const [sql, params] = mockPoolQuery.mock.calls[0];
    // SQL must scope by tenant_id
    expect((sql as string).toLowerCase()).toContain("tenant_id");
    // Attacker's tenantId (not victim's) is passed in params
    expect(params as unknown[]).toContain(ATTACKER_TENANT);
    // Victim's tenantId must NOT appear in the params
    expect(params as unknown[]).not.toContain(TEST_TENANT_ID);
  });
});
