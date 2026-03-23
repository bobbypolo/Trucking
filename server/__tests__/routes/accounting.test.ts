import { describe, it, expect, vi, beforeEach } from "vitest";

// Tests R-P3-05

/**
 * Accounting Route - QuickBooks Stub Removal Verification
 *
 * Verifies that:
 *   - POST /api/accounting/sync-qb no longer exists (R-P3-05: stub removed by S-302)
 *   - QuickBooks functionality has moved to /api/quickbooks/* routes
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
// R-P3-05: 501 stub removed from accounting.ts (S-302)
// ============================================================

describe("R-P3-05: POST /api/accounting/sync-qb stub removed", () => {
  it("POST /api/accounting/sync-qb no longer exists (returns 404)", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/accounting/sync-qb")
      .set("Authorization", AUTH_HEADER)
      .send();

    // Route was removed - should be 404 (no matching route in accounting router)
    expect(res.status).toBe(404);
  });

  it("accounting.ts source does not contain 501 stub", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const accountingPath = path.resolve(__dirname, "../../routes/accounting.ts");
    const content = fs.readFileSync(accountingPath, "utf8");
    expect(content).not.toContain("501");
    expect(content).not.toContain("QuickBooks integration is not yet available");
    expect(content).not.toContain("sync-qb");
  });
});
