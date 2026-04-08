/**
 * Tests R-P5-07, R-P5-08, R-P5-09: POST /api/loads/driver-intake
 *
 * Verifies:
 *  - Empty body creates Draft load with driver_id from auth context
 *  - Body fields status/driver_id are ignored (server overrides)
 *  - Unauthenticated request returns 401
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockQuery, mockGetConnection, mockResolveSqlPrincipalByFirebaseUid } =
  vi.hoisted(() => ({
    mockQuery: vi.fn(),
    mockGetConnection: vi.fn(),
    mockResolveSqlPrincipalByFirebaseUid: vi.fn(),
  }));

vi.mock("../../db", () => ({
  default: {
    query: mockQuery,
    execute: mockQuery,
    getConnection: mockGetConnection,
  },
}));

vi.mock("../../lib/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
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

vi.mock("../../lib/loadNumberGenerator", () => ({
  generateNextLoadNumber: vi.fn().mockResolvedValue("DRAFT-abcd1234"),
}));

vi.mock("firebase-admin", () => {
  const mockAuth = {
    verifyIdToken: vi
      .fn()
      .mockResolvedValue({ uid: "firebase-uid-1", email_verified: true }),
  };
  const mockFirestore = {
    collection: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({
            empty: false,
            docs: [
              {
                id: "user-1",
                data: () => ({
                  id: "user-1",
                  company_id: "company-aaa",
                  role: "driver",
                  email: "driver@test.com",
                }),
              },
            ],
          }),
        }),
      }),
    }),
  };
  return {
    default: {
      app: vi.fn(),
      auth: () => mockAuth,
      firestore: () => mockFirestore,
    },
  };
});

vi.mock("../../lib/sql-auth", () => ({
  resolveSqlPrincipalByFirebaseUid: mockResolveSqlPrincipalByFirebaseUid,
}));

import express from "express";
import request from "supertest";
import driverIntakeRouter from "../../routes/loads-driver-intake";
import { errorHandler } from "../../middleware/errorHandler";
import { DEFAULT_SQL_PRINCIPAL } from "../helpers/mock-sql-auth";
import { generateNextLoadNumber } from "../../lib/loadNumberGenerator";

const generateNextLoadNumberMock = generateNextLoadNumber as ReturnType<
  typeof vi.fn
>;

mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(DEFAULT_SQL_PRINCIPAL);

function buildConnectionMock() {
  const capturedSqlCalls: { sql: string; params: unknown[] }[] = [];
  const conn = {
    beginTransaction: vi.fn().mockResolvedValue(undefined),
    query: vi.fn().mockImplementation((sql: string, params: unknown[]) => {
      capturedSqlCalls.push({ sql, params });
      return Promise.resolve([{ affectedRows: 1 }]);
    }),
    commit: vi.fn().mockResolvedValue(undefined),
    rollback: vi.fn().mockResolvedValue(undefined),
    release: vi.fn(),
    _calls: capturedSqlCalls,
  };
  return conn;
}

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(driverIntakeRouter);
  app.use(errorHandler);
  return app;
}

// ── R-P5-07: empty body → 201 with Draft status and driver from auth ─────────

describe("R-P5-07 — POST /api/loads/driver-intake empty body", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
    mockQuery.mockResolvedValue([[]]);
    generateNextLoadNumberMock.mockResolvedValue("DRAFT-abcd1234");
  });

  // Tests R-P5-07
  it("Tests R-P5-07 — returns 201 with Draft status and driver_id from auth", async () => {
    const conn = buildConnectionMock();
    mockGetConnection.mockResolvedValue(conn);

    const app = createApp();
    const res = await request(app)
      .post("/api/loads/driver-intake")
      .set("Authorization", "Bearer valid-token")
      .send({});

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("Draft");
    expect(res.body.intake_source).toBe("driver");
    expect(typeof res.body.load_number).toBe("string");
    expect(res.body.load_number.length).toBeGreaterThan(0);
    // driver_id must equal the authenticated user's id
    expect(res.body.driver_id).toBe(DEFAULT_SQL_PRINCIPAL.id);
  });
});

// ── R-P5-08: status/driver_id in body are ignored ────────────────────────────

describe("R-P5-08 — POST /api/loads/driver-intake ignores body status and driver_id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
    mockQuery.mockResolvedValue([[]]);
    generateNextLoadNumberMock.mockResolvedValue("DRAFT-abcd1234");
  });

  // Tests R-P5-08
  it("Tests R-P5-08 — body status=Planned ignored, persisted record has status=draft", async () => {
    const conn = buildConnectionMock();
    mockGetConnection.mockResolvedValue(conn);

    const app = createApp();
    const res = await request(app)
      .post("/api/loads/driver-intake")
      .set("Authorization", "Bearer valid-token")
      .send({ status: "Planned", driver_id: "other-user" });

    expect(res.status).toBe(201);
    // Response always returns server-derived values
    expect(res.body.status).toBe("Draft");
    expect(res.body.driver_id).toBe(DEFAULT_SQL_PRINCIPAL.id);
    expect(res.body.driver_id).not.toBe("other-user");

    // Verify INSERT parameters contain server-derived driver_id and status
    const insertCall = conn._calls.find((c) =>
      c.sql.includes("INSERT INTO loads"),
    );
    expect(insertCall).toBeDefined();
    // driver_id param should be the auth user's id, not "other-user"
    expect(insertCall!.params).toContain(DEFAULT_SQL_PRINCIPAL.id);
    expect(insertCall!.params).not.toContain("other-user");
    // status param should be "draft", not "Planned"
    expect(insertCall!.params).toContain("draft");
    expect(insertCall!.params).not.toContain("Planned");
  });
});

// ── R-P5-09: unauthenticated → 401 ───────────────────────────────────────────

describe("R-P5-09 — POST /api/loads/driver-intake without auth returns 401", () => {
  // Tests R-P5-09
  it("Tests R-P5-09 — missing Authorization header returns 401", async () => {
    const app = createApp();
    const res = await request(app).post("/api/loads/driver-intake").send({});

    expect(res.status).toBe(401);
  });
});
