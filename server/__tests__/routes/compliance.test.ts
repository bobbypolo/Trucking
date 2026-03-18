import { describe, it, expect, vi, beforeEach } from "vitest";

// Tests R-FS-05-02, R-FS-05-07

// Hoisted mocks
const { mockQuery, mockResolveSqlPrincipalByFirebaseUid } = vi.hoisted(() => {
  const mockQuery = vi.fn();
  const mockResolveSqlPrincipalByFirebaseUid = vi.fn();
  return { mockQuery, mockResolveSqlPrincipalByFirebaseUid };
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
    child: vi.fn().mockReturnThis(),
  },
  createChildLogger: () => ({
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

import express from "express";
import request from "supertest";
import complianceRouter from "../../routes/compliance";
import { errorHandler } from "../../middleware/errorHandler";
import { DEFAULT_SQL_PRINCIPAL } from "../helpers/mock-sql-auth";

mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(DEFAULT_SQL_PRINCIPAL);

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(complianceRouter);
  app.use(errorHandler);
  return app;
}

const USER_ID = "user-1";
const AUTH_HEADER = "Bearer valid-token";

// ── Auth enforcement ──────────────────────────────────────────────────────────

describe("GET /api/compliance/:userId — auth enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when no Authorization header is sent", async () => {
    const app = buildApp();
    const res = await request(app).get(`/api/compliance/${USER_ID}`);
    expect(res.status).toBe(401);
  });
});

// ── Tenant / RBAC enforcement ─────────────────────────────────────────────────

describe("GET /api/compliance/:userId — RBAC enforcement", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
    app = buildApp();
    vi.clearAllMocks();
  });

  it("returns 403 when driver accesses another user's compliance record", async () => {
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue({
      ...DEFAULT_SQL_PRINCIPAL,
      id: "user-1",
      role: "driver",
    });
    app = buildApp();

    const res = await request(app)
      .get("/api/compliance/different-user-id")
      .set("Authorization", AUTH_HEADER);

    // Route-level RBAC: driver can only see their own record
    expect(res.status).toBe(403);
  });

  it("allows dispatcher to access any user's compliance record", async () => {
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue({
      ...DEFAULT_SQL_PRINCIPAL,
      role: "dispatcher",
    });
    app = buildApp();
    mockQuery.mockResolvedValueOnce([[], []]);

    const res = await request(app)
      .get("/api/compliance/another-user-id")
      .set("Authorization", AUTH_HEADER);

    // Dispatcher is allowed
    expect(res.status).toBe(200);
    expect(res.status).not.toBe(403);
  });
});

// ── Validation errors ─────────────────────────────────────────────────────────

describe("GET /api/compliance/:userId — validation", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue({
      ...DEFAULT_SQL_PRINCIPAL,
      role: "dispatcher",
    });
    app = buildApp();
    vi.clearAllMocks();
  });

  it("returns empty array for user with no compliance records", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);

    const res = await request(app)
      .get(`/api/compliance/${USER_ID}`)
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(0);
  });
});

// ── Success path ──────────────────────────────────────────────────────────────

describe("GET /api/compliance/:userId — success", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue({
      ...DEFAULT_SQL_PRINCIPAL,
      id: "user-1",
      role: "dispatcher",
    });
    app = buildApp();
    vi.clearAllMocks();
  });

  it("returns compliance records with 200", async () => {
    const records = [
      {
        id: "comp-001",
        user_id: USER_ID,
        type: "CDL",
        status: "valid",
        expiry: "2027-01-01",
      },
    ];
    mockQuery.mockResolvedValueOnce([records, []]);

    const res = await request(app)
      .get(`/api/compliance/${USER_ID}`)
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].type).toBe("CDL");
  });

  it("query is tenant-scoped: SQL includes JOIN users and both userId and tenantId params", async () => {
    // Tests R-FS-05-02: tenant scoping via JOIN through users table
    mockQuery.mockResolvedValueOnce([[], []]);

    await request(app)
      .get(`/api/compliance/${USER_ID}`)
      .set("Authorization", AUTH_HEADER);

    expect(mockQuery).toHaveBeenCalledTimes(1);
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain("JOIN users");
    expect(sql).toContain("company_id");
    expect(params).toContain(USER_ID);
    expect(params).toContain("company-aaa");
  });

  it("allows driver to access their own compliance record", async () => {
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue({
      ...DEFAULT_SQL_PRINCIPAL,
      id: USER_ID,
      role: "driver",
    });
    app = buildApp();

    const records = [
      {
        id: "comp-002",
        user_id: USER_ID,
        type: "Medical Card",
        status: "valid",
      },
    ];
    mockQuery.mockResolvedValueOnce([records, []]);

    const res = await request(app)
      .get(`/api/compliance/${USER_ID}`)
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it("returns 500 on database error", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB connection lost"));

    const res = await request(app)
      .get(`/api/compliance/${USER_ID}`)
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(500);
  });
});
