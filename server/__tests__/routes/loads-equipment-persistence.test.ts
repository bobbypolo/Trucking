/**
 * Tests R-P4-03, R-P4-04, R-P4-05: POST /api/loads equipment_id persistence
 *
 * Verifies:
 *  - createLoadSchema accepts equipment_id as an optional string field
 *  - POST /api/loads with equipment_id captures it in the INSERT SQL
 *  - POST /api/loads without equipment_id persists null (not undefined, not '')
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

vi.mock("../../helpers", () => ({
  redactData: (data: unknown) => data,
  getVisibilitySettings: vi.fn().mockResolvedValue({}),
  sendNotification: vi.fn(),
  checkBreakdownLateness: vi
    .fn()
    .mockResolvedValue({ isLate: false, dist: 0, required: 0 }),
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

vi.mock("../../services/geocoding.service", () => ({
  geocodeStopAddress: vi.fn().mockResolvedValue(null),
}));

vi.mock("../../services/detentionPipeline", () => ({
  recordGeofenceEntry: vi.fn(),
  recordBOLScan: vi.fn(),
}));

vi.mock("../../services/discrepancyPipeline", () => ({
  compareWeights: vi.fn(),
  recordLoadCompletion: vi.fn(),
}));

vi.mock("../../services/bigqueryPipeline", () => ({
  exportLoadToBigQuery: vi.fn(),
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
                  role: "dispatcher",
                  email: "dispatcher@test.com",
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
import loadRoutes from "../../routes/loads";
import { errorHandler } from "../../middleware/errorHandler";
import { DEFAULT_SQL_PRINCIPAL } from "../helpers/mock-sql-auth";
import { createLoadSchema } from "../../schemas/loads";

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
  app.use(loadRoutes);
  app.use(errorHandler);
  return app;
}

const minLoad = {
  id: "load-eq-001",
  load_number: "LD-EQ-001",
  status: "Draft",
};

// ── R-P4-03: createLoadSchema accepts equipment_id ───────────────────────────

describe("R-P4-03 — createLoadSchema includes equipment_id as optional string", () => {
  // Tests R-P4-03
  it("Tests R-P4-03 — safeParse succeeds when equipment_id is provided", () => {
    const result = createLoadSchema.safeParse({
      load_number: "L1",
      status: "Draft",
      equipment_id: "EQ-1",
    });
    expect(result.success).toBe(true);
  });

  // Tests R-P4-03
  it("Tests R-P4-03 — safeParse succeeds when equipment_id is omitted", () => {
    const result = createLoadSchema.safeParse({
      load_number: "L1",
      status: "Draft",
    });
    expect(result.success).toBe(true);
  });

  // Tests R-P4-03
  it("Tests R-P4-03 — parsed data includes equipment_id when provided", () => {
    const result = createLoadSchema.safeParse({
      load_number: "L1",
      status: "Draft",
      equipment_id: "EQ-001",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.equipment_id).toBe("EQ-001");
    }
  });
});

// ── R-P4-04: POST /api/loads captures equipment_id in INSERT ─────────────────

describe("R-P4-04 — POST /api/loads with equipment_id captures it in INSERT", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
    // pool.execute used by isTokenRevoked — default: not revoked
    mockQuery.mockResolvedValue([[]]);
  });

  // Tests R-P4-04
  it("Tests R-P4-04 — INSERT SQL includes equipment_id = EQ-001 in parameter array", async () => {
    const conn = buildConnectionMock();
    mockGetConnection.mockResolvedValue(conn);

    const app = createApp();
    const res = await request(app)
      .post("/api/loads")
      .set("Authorization", "Bearer valid-token")
      .send({ ...minLoad, equipment_id: "EQ-001" });

    expect({ status: res.status, body: res.body }).toMatchObject({
      status: 201,
    });

    // Find the REPLACE INTO loads call
    const insertCall = conn._calls.find((c) =>
      c.sql.includes("REPLACE INTO loads"),
    );
    expect(insertCall).toBeDefined();
    expect(insertCall!.sql).toContain("equipment_id");
    // equipment_id value must be in the parameter array
    expect(insertCall!.params).toContain("EQ-001");
  });
});

// ── R-P4-05: POST /api/loads without equipment_id persists null ──────────────

describe("R-P4-05 — POST /api/loads without equipment_id persists null", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
    // pool.execute used by isTokenRevoked — default: not revoked
    mockQuery.mockResolvedValue([[]]);
  });

  // Tests R-P4-05
  it("Tests R-P4-05 — INSERT params contain null (not undefined, not empty string) for missing equipment_id", async () => {
    const conn = buildConnectionMock();
    mockGetConnection.mockResolvedValue(conn);

    const app = createApp();
    const res = await request(app)
      .post("/api/loads")
      .set("Authorization", "Bearer valid-token")
      .send({ ...minLoad });

    expect(res.status).toBe(201);

    const insertCall = conn._calls.find((c) =>
      c.sql.includes("REPLACE INTO loads"),
    );
    expect(insertCall).toBeDefined();
    expect(insertCall!.sql).toContain("equipment_id");

    // Find the position of equipment_id column in the SQL column list
    const colList = insertCall!.sql.match(/\(([^)]+)\)/)?.[1] ?? "";
    const cols = colList.split(",").map((s) => s.trim());
    const eqIdx = cols.indexOf("equipment_id");
    expect(eqIdx).toBeGreaterThanOrEqual(0);

    const params = insertCall!.params as unknown[];
    // The value at eqIdx position must be null (not undefined, not '')
    expect(params[eqIdx]).toBeNull();
    expect(params[eqIdx]).not.toBe(undefined);
    expect(params[eqIdx]).not.toBe("");
  });
});
