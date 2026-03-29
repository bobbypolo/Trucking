import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Settlement Role Permission & Driver Self-Scope Tests
 *
 * Verifies that:
 *   - Drivers can only see their own settlements (self-scope enforcement)
 *   - Drivers cannot see other drivers' settlements
 *   - Drivers cannot create settlements (POST returns 403)
 *   - Drivers cannot batch-finalize settlements (PATCH returns 403)
 *   - Admin/payroll roles CAN create and finalize settlements
 *   - Settlement finalize path updates real DB records (not local-only state)
 */

const TEST_TENANT_ID = "tenant-settle-abc";
const DRIVER_USER_ID = "driver-user-001";
const OTHER_DRIVER_ID = "driver-user-002";

// --- Hoisted mocks ---
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
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
  createRequestLogger: () => ({
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

import accountingRouter from "../../routes/accounting";
import express from "express";
import request from "supertest";
import { DEFAULT_SQL_PRINCIPAL } from "../helpers/mock-sql-auth";

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

/**
 * Helper: configure the mock SQL principal for a given role and userId.
 */
function setUserRole(role: string, userId: string = DRIVER_USER_ID) {
  mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue({
    ...DEFAULT_SQL_PRINCIPAL,
    id: userId,
    tenantId: TEST_TENANT_ID,
    companyId: TEST_TENANT_ID,
    role,
  });
}

const SETTLEMENT_BODY = {
  id: "settle-perm-001",
  tenantId: "EVIL-TENANT",
  driverId: "driver-user-001",
  settlementDate: "2026-03-08",
  periodStart: "2026-03-01",
  periodEnd: "2026-03-07",
  totalEarnings: 3000,
  totalDeductions: 200,
  totalReimbursements: 100,
  netPay: 2900,
  status: "Draft",
  lines: [],
};

const BATCH_BODY = {
  ids: ["settle-001", "settle-002"],
  status: "Approved",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockConnectionRelease.mockReturnValue(undefined);
  mockGetConnection.mockResolvedValue(makeConnection());
  mockPoolQuery.mockResolvedValue([[], []]);
  mockConnectionQuery.mockResolvedValue([[], []]);
  // Default: admin role
  setUserRole("admin");
});

// ============================================================
// Driver Self-Scope: GET /api/accounting/settlements
// ============================================================

describe("Driver self-scope on GET /api/accounting/settlements", () => {
  it("driver sees only their own settlements — SQL includes driver_id = userId", async () => {
    setUserRole("driver", DRIVER_USER_ID);
    const app = buildApp();

    await request(app)
      .get("/api/accounting/settlements")
      .set("Authorization", AUTH_HEADER)
      .send();

    expect(mockPoolQuery).toHaveBeenCalled();
    const [sql, params] = mockPoolQuery.mock.calls[0];
    // SQL must contain driver_id filter
    expect((sql as string).toLowerCase()).toContain("driver_id");
    // Params must include the authenticated driver's own userId
    expect(params as unknown[]).toContain(DRIVER_USER_ID);
    // Params must include the tenant ID
    expect(params as unknown[]).toContain(TEST_TENANT_ID);
  });

  it("driver cannot override self-scope via query param — driverId param is ignored for driver role", async () => {
    setUserRole("driver", DRIVER_USER_ID);
    const app = buildApp();

    await request(app)
      .get(`/api/accounting/settlements?driverId=${OTHER_DRIVER_ID}`)
      .set("Authorization", AUTH_HEADER)
      .send();

    expect(mockPoolQuery).toHaveBeenCalled();
    const [_sql, params] = mockPoolQuery.mock.calls[0];
    // Must use the driver's own ID, NOT the query param
    expect(params as unknown[]).toContain(DRIVER_USER_ID);
    expect(params as unknown[]).not.toContain(OTHER_DRIVER_ID);
  });

  it("DRIVER_PORTAL role is also self-scoped", async () => {
    setUserRole("DRIVER_PORTAL", DRIVER_USER_ID);
    const app = buildApp();

    await request(app)
      .get("/api/accounting/settlements")
      .set("Authorization", AUTH_HEADER)
      .send();

    expect(mockPoolQuery).toHaveBeenCalled();
    const [sql, params] = mockPoolQuery.mock.calls[0];
    expect((sql as string).toLowerCase()).toContain("driver_id");
    expect(params as unknown[]).toContain(DRIVER_USER_ID);
  });

  it("admin can view all settlements (no driver_id filter when no driverId param)", async () => {
    setUserRole("admin");
    const app = buildApp();

    await request(app)
      .get("/api/accounting/settlements")
      .set("Authorization", AUTH_HEADER)
      .send();

    expect(mockPoolQuery).toHaveBeenCalled();
    const [sql, params] = mockPoolQuery.mock.calls[0];
    // SQL should NOT contain driver_id when admin has no driverId param
    expect(sql as string).not.toMatch(/driver_id\s*=/);
    expect(params as unknown[]).toContain(TEST_TENANT_ID);
  });

  it("payroll_manager can filter by driverId query param", async () => {
    setUserRole("payroll_manager");
    const app = buildApp();

    await request(app)
      .get(`/api/accounting/settlements?driverId=${OTHER_DRIVER_ID}`)
      .set("Authorization", AUTH_HEADER)
      .send();

    expect(mockPoolQuery).toHaveBeenCalled();
    const [sql, params] = mockPoolQuery.mock.calls[0];
    expect((sql as string).toLowerCase()).toContain("driver_id");
    expect(params as unknown[]).toContain(OTHER_DRIVER_ID);
  });

  it("unrecognized role gets 403 on settlements GET", async () => {
    setUserRole("random_role");
    const app = buildApp();

    const res = await request(app)
      .get("/api/accounting/settlements")
      .set("Authorization", AUTH_HEADER)
      .send();

    expect(res.status).toBe(403);
    expect(res.body.error).toContain("Insufficient permissions");
  });
});

// ============================================================
// Role Guards: POST /api/accounting/settlements
// ============================================================

describe("Role guard on POST /api/accounting/settlements", () => {
  it("driver role gets 403 when attempting to create a settlement", async () => {
    setUserRole("driver", DRIVER_USER_ID);
    const app = buildApp();

    const res = await request(app)
      .post("/api/accounting/settlements")
      .set("Authorization", AUTH_HEADER)
      .send(SETTLEMENT_BODY);

    expect(res.status).toBe(403);
    expect(res.body.error).toContain("Insufficient permissions to create");
  });

  it("DRIVER_PORTAL role gets 403 when attempting to create a settlement", async () => {
    setUserRole("DRIVER_PORTAL", DRIVER_USER_ID);
    const app = buildApp();

    const res = await request(app)
      .post("/api/accounting/settlements")
      .set("Authorization", AUTH_HEADER)
      .send(SETTLEMENT_BODY);

    expect(res.status).toBe(403);
    expect(res.body.error).toContain("Insufficient permissions to create");
  });

  it("admin role can create a settlement (201)", async () => {
    setUserRole("admin");
    const app = buildApp();

    const res = await request(app)
      .post("/api/accounting/settlements")
      .set("Authorization", AUTH_HEADER)
      .send(SETTLEMENT_BODY);

    expect(res.status).toBe(201);
    expect(res.body.message).toContain("Settlement created");
  });

  it("payroll_manager role can create a settlement (201)", async () => {
    setUserRole("payroll_manager");
    const app = buildApp();

    const res = await request(app)
      .post("/api/accounting/settlements")
      .set("Authorization", AUTH_HEADER)
      .send(SETTLEMENT_BODY);

    expect(res.status).toBe(201);
    expect(res.body.message).toContain("Settlement created");
  });

  it("PAYROLL_SETTLEMENTS role can create a settlement (201)", async () => {
    setUserRole("PAYROLL_SETTLEMENTS");
    const app = buildApp();

    const res = await request(app)
      .post("/api/accounting/settlements")
      .set("Authorization", AUTH_HEADER)
      .send(SETTLEMENT_BODY);

    expect(res.status).toBe(201);
    expect(res.body.message).toContain("Settlement created");
  });

  it("dispatcher role gets 403 when attempting to create a settlement", async () => {
    // dispatcher is in SETTLEMENT_ADMIN_ROLES (can view) but NOT in SETTLEMENT_EDIT_ROLES (cannot create)
    setUserRole("dispatcher");
    const app = buildApp();

    const res = await request(app)
      .post("/api/accounting/settlements")
      .set("Authorization", AUTH_HEADER)
      .send(SETTLEMENT_BODY);

    expect(res.status).toBe(403);
    expect(res.body.error).toContain("Insufficient permissions to create");
  });
});

// ============================================================
// Role Guards: PATCH /api/accounting/settlements/batch
// ============================================================

describe("Role guard on PATCH /api/accounting/settlements/batch", () => {
  it("driver role gets 403 when attempting to batch-finalize", async () => {
    setUserRole("driver", DRIVER_USER_ID);
    const app = buildApp();

    const res = await request(app)
      .patch("/api/accounting/settlements/batch")
      .set("Authorization", AUTH_HEADER)
      .send(BATCH_BODY);

    expect(res.status).toBe(403);
    expect(res.body.error).toContain("Insufficient permissions to update");
  });

  it("admin role can batch-finalize settlements", async () => {
    setUserRole("admin");
    // Mock 1: SELECT current statuses (Calculated → Approved is valid)
    mockPoolQuery.mockResolvedValueOnce([
      [
        { id: "settle-001", status: "Calculated" },
        { id: "settle-002", status: "Calculated" },
      ],
      [],
    ]);
    // Mock 2: UPDATE result
    mockPoolQuery.mockResolvedValueOnce([{ affectedRows: 2 }, []]);
    const app = buildApp();

    const res = await request(app)
      .patch("/api/accounting/settlements/batch")
      .set("Authorization", AUTH_HEADER)
      .send(BATCH_BODY);

    expect(res.status).toBe(200);
    expect(res.body.updated).toBe(2);
  });

  it("payroll_manager role can batch-finalize settlements", async () => {
    setUserRole("payroll_manager");
    // Mock 1: SELECT current statuses
    mockPoolQuery.mockResolvedValueOnce([
      [{ id: "settle-001", status: "Calculated" }],
      [],
    ]);
    // Mock 2: UPDATE result
    mockPoolQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    const app = buildApp();

    const res = await request(app)
      .patch("/api/accounting/settlements/batch")
      .set("Authorization", AUTH_HEADER)
      .send(BATCH_BODY);

    expect(res.status).toBe(200);
    expect(res.body.updated).toBe(1);
  });

  it("DRIVER_PORTAL role gets 403 when attempting to batch-finalize", async () => {
    setUserRole("DRIVER_PORTAL", DRIVER_USER_ID);
    const app = buildApp();

    const res = await request(app)
      .patch("/api/accounting/settlements/batch")
      .set("Authorization", AUTH_HEADER)
      .send(BATCH_BODY);

    expect(res.status).toBe(403);
    expect(res.body.error).toContain("Insufficient permissions to update");
  });
});

// ============================================================
// Settlement Finalize: DB record update verification
// ============================================================

describe("Settlement batch finalize updates real DB records", () => {
  it("PATCH batch calls UPDATE driver_settlements with correct status and tenant scoping", async () => {
    setUserRole("admin");
    // Mock 1: SELECT current statuses (Approved → Paid is valid)
    mockPoolQuery.mockResolvedValueOnce([
      [
        { id: "s-001", status: "Approved" },
        { id: "s-002", status: "Approved" },
      ],
      [],
    ]);
    // Mock 2: UPDATE result
    mockPoolQuery.mockResolvedValueOnce([{ affectedRows: 2 }, []]);
    const app = buildApp();

    const res = await request(app)
      .patch("/api/accounting/settlements/batch")
      .set("Authorization", AUTH_HEADER)
      .send({ ids: ["s-001", "s-002"], status: "Paid" });

    expect(res.status).toBe(200);
    expect(res.body.updated).toBe(2);

    // Verify: call 0 is SELECT, call 1 is UPDATE
    expect(mockPoolQuery).toHaveBeenCalledTimes(2);
    const [updateSql, updateParams] = mockPoolQuery.mock.calls[1];
    expect((updateSql as string).toUpperCase()).toContain(
      "UPDATE DRIVER_SETTLEMENTS",
    );
    expect((updateSql as string).toLowerCase()).toContain("company_id");
    // Params: [status, tenantId, ...ids]
    expect(updateParams).toEqual(["Paid", TEST_TENANT_ID, "s-001", "s-002"]);
  });

  it("POST settlement creates DB records via INSERT (not local-only)", async () => {
    setUserRole("admin");
    const app = buildApp();

    const res = await request(app)
      .post("/api/accounting/settlements")
      .set("Authorization", AUTH_HEADER)
      .send(SETTLEMENT_BODY);

    expect(res.status).toBe(201);
    // Verify connection queries were called (transaction-based INSERTs)
    expect(mockConnectionBeginTransaction).toHaveBeenCalledTimes(1);
    expect(mockConnectionCommit).toHaveBeenCalledTimes(1);
    // At minimum: 1 settlement header INSERT + 1 journal entry INSERT + 1 journal line INSERT
    expect(mockConnectionQuery.mock.calls.length).toBeGreaterThanOrEqual(3);
    // First call should be the settlement INSERT
    const [firstSql] = mockConnectionQuery.mock.calls[0];
    expect((firstSql as string).toUpperCase()).toContain(
      "INSERT INTO DRIVER_SETTLEMENTS",
    );
  });
});
