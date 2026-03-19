import { describe, it, expect, vi, beforeEach } from "vitest";

// Tests R-P3-09, R-P3-11

/**
 * Accounting Route — Unimplemented Feature Tests
 *
 * Verifies that:
 *   - POST /api/accounting/sync-qb returns 501 (R-P3-09)
 *   - No "Sync queued" text appears in the response body (R-P3-11)
 */

const TEST_TENANT_ID = "tenant-test-abc123";

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

mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue({
  ...DEFAULT_SQL_PRINCIPAL,
  tenantId: TEST_TENANT_ID,
  companyId: TEST_TENANT_ID,
});

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
  mockGetConnection.mockResolvedValue({
    query: mockConnectionQuery,
    beginTransaction: mockConnectionBeginTransaction,
    commit: mockConnectionCommit,
    rollback: mockConnectionRollback,
    release: mockConnectionRelease,
  });
  mockPoolQuery.mockResolvedValue([[], []]);
  mockConnectionQuery.mockResolvedValue([[], []]);
  mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue({
    ...DEFAULT_SQL_PRINCIPAL,
    tenantId: TEST_TENANT_ID,
    companyId: TEST_TENANT_ID,
  });
});

// ============================================================
// R-P3-09: POST /api/accounting/sync-qb returns 501
// ============================================================

describe("R-P3-09: POST /api/accounting/sync-qb returns 501", () => {
  it("returns HTTP 501 with unimplemented error message", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/accounting/sync-qb")
      .set("Authorization", AUTH_HEADER)
      .send();

    expect(res.status).toBe(501);
    expect(res.body.error).toBeTruthy();
    expect(res.body.error).toContain("QuickBooks");
  });

  it("does not return 200 or fake success for sync-qb", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/accounting/sync-qb")
      .set("Authorization", AUTH_HEADER)
      .send();

    expect(res.status).not.toBe(200);
    expect(res.status).not.toBe(201);
  });
});

// ============================================================
// R-P3-11: Response body does not contain "Sync queued"
// ============================================================

describe("R-P3-11: sync-qb response does not contain Sync queued text", () => {
  it("response body does not contain 'Sync queued'", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/accounting/sync-qb")
      .set("Authorization", AUTH_HEADER)
      .send();

    const bodyText = JSON.stringify(res.body);
    expect(bodyText).not.toContain("Sync queued");
  });
});
