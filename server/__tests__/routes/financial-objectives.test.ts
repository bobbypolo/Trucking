/**
 * Tests R-P10-02, R-P10-03, R-P10-07: /api/financial-objectives routes
 *
 * Covers:
 *  - GET /api/financial-objectives?quarter=2026-Q2 → 200 with filtered array (R-P10-02)
 *  - POST /api/financial-objectives → 201 with created row (R-P10-03)
 *  - GET /api/financial-objectives?quarter=invalid → 400 (R-P10-07)
 *  - POST rejects missing/invalid quarter → 400 (guards R-P10-03)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoisted mocks for pool.query and sql-auth
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

import express from "express";
import request from "supertest";
import financialObjectivesRouter from "../../routes/financial-objectives";
import { errorHandler } from "../../middleware/errorHandler";
import { DEFAULT_SQL_PRINCIPAL } from "../helpers/mock-sql-auth";

mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(DEFAULT_SQL_PRINCIPAL);

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(financialObjectivesRouter);
  app.use(errorHandler);
  return app;
}

const OBJECTIVE_Q2_ROW = {
  id: "obj-q2-1",
  company_id: "company-aaa",
  quarter: "2026-Q2",
  revenue_target: 500000,
  expense_budget: 300000,
  profit_target: 200000,
  notes: null,
  created_at: "2026-04-11T00:00:00.000Z",
  updated_at: "2026-04-11T00:00:00.000Z",
};

const OBJECTIVE_Q1_ROW = {
  ...OBJECTIVE_Q2_ROW,
  id: "obj-q1-1",
  quarter: "2026-Q1",
  revenue_target: 450000,
};

describe("GET /api/financial-objectives", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
  });

  // Tests R-P10-02
  it("returns 200 with array filtered by quarter=2026-Q2", async () => {
    mockQuery.mockResolvedValueOnce([[OBJECTIVE_Q2_ROW], []]);

    const app = buildApp();
    const res = await request(app)
      .get("/api/financial-objectives?quarter=2026-Q2")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({
      id: "obj-q2-1",
      quarter: "2026-Q2",
      revenue_target: 500000,
    });
  });

  // Tests R-P10-02 — list query filters by tenant and quarter
  it("SELECT query filters by company_id and quarter parameter", async () => {
    mockQuery.mockResolvedValueOnce([[OBJECTIVE_Q2_ROW], []]);

    const app = buildApp();
    await request(app)
      .get("/api/financial-objectives?quarter=2026-Q2")
      .set("Authorization", "Bearer valid-token");

    const [selectSql, selectParams] = mockQuery.mock.calls[0];
    const selectLower = String(selectSql).toLowerCase();
    expect(selectLower).toContain("select");
    expect(selectLower).toContain("from financial_objectives");
    expect(selectLower).toContain("company_id");
    expect(selectLower).toContain("quarter");
    expect(selectParams).toContain("2026-Q2");
  });

  // Tests R-P10-02 — empty array when no matches
  it("returns 200 with empty array when no rows match", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);

    const app = buildApp();
    const res = await request(app)
      .get("/api/financial-objectives?quarter=2026-Q3")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  // Tests R-P10-02 — no quarter param returns all for tenant
  it("returns 200 with all objectives when quarter omitted", async () => {
    mockQuery.mockResolvedValueOnce([[OBJECTIVE_Q2_ROW, OBJECTIVE_Q1_ROW], []]);

    const app = buildApp();
    const res = await request(app)
      .get("/api/financial-objectives")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  // Tests R-P10-07
  it("rejects with 400 when quarter=invalid", async () => {
    const app = buildApp();
    const res = await request(app)
      .get("/api/financial-objectives?quarter=invalid")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
    // DB must not be touched when validation fails
    expect(mockQuery).not.toHaveBeenCalled();
  });

  // Tests R-P10-07 — year-only value still rejected
  it("rejects with 400 when quarter=2026", async () => {
    const app = buildApp();
    const res = await request(app)
      .get("/api/financial-objectives?quarter=2026")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(400);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  // Tests R-P10-07 — Q5 out of range
  it("rejects with 400 when quarter=2026-Q5", async () => {
    const app = buildApp();
    const res = await request(app)
      .get("/api/financial-objectives?quarter=2026-Q5")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(400);
    expect(mockQuery).not.toHaveBeenCalled();
  });
});

describe("POST /api/financial-objectives", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
  });

  // Tests R-P10-03
  it("creates objective and returns 201 with created row", async () => {
    // First call: INSERT. Second call: SELECT after insert (findById).
    mockQuery.mockResolvedValueOnce([{ insertId: 0 }, []]);
    mockQuery.mockResolvedValueOnce([[OBJECTIVE_Q2_ROW], []]);

    const app = buildApp();
    const res = await request(app)
      .post("/api/financial-objectives")
      .set("Authorization", "Bearer valid-token")
      .send({
        quarter: "2026-Q2",
        revenue_target: 500000,
        expense_budget: 300000,
        profit_target: 200000,
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("id", "obj-q2-1");
    expect(res.body).toHaveProperty("quarter", "2026-Q2");
    expect(res.body).toHaveProperty("revenue_target", 500000);
  });

  // Tests R-P10-03 — INSERT targets financial_objectives
  it("INSERT query targets financial_objectives with quarter param", async () => {
    mockQuery.mockResolvedValueOnce([{ insertId: 0 }, []]);
    mockQuery.mockResolvedValueOnce([[OBJECTIVE_Q2_ROW], []]);

    const app = buildApp();
    await request(app)
      .post("/api/financial-objectives")
      .set("Authorization", "Bearer valid-token")
      .send({
        quarter: "2026-Q2",
        revenue_target: 500000,
        expense_budget: 300000,
        profit_target: 200000,
      });

    const [insertSql, insertParams] = mockQuery.mock.calls[0];
    const insertLower = String(insertSql).toLowerCase();
    expect(insertLower).toContain("insert into financial_objectives");
    expect(insertParams).toContain("2026-Q2");
    expect(insertParams).toContain(500000);
  });

  // Tests R-P10-03 — defaults applied when targets omitted
  it("creates objective with default targets when omitted", async () => {
    mockQuery.mockResolvedValueOnce([{ insertId: 0 }, []]);
    mockQuery.mockResolvedValueOnce([
      [
        {
          ...OBJECTIVE_Q2_ROW,
          revenue_target: 0,
          expense_budget: 0,
          profit_target: 0,
        },
      ],
      [],
    ]);

    const app = buildApp();
    const res = await request(app)
      .post("/api/financial-objectives")
      .set("Authorization", "Bearer valid-token")
      .send({ quarter: "2026-Q2" });

    expect(res.status).toBe(201);
    const [, insertParams] = mockQuery.mock.calls[0];
    // Params should contain zeros for default numeric fields
    expect(insertParams).toContain(0);
  });

  // Tests R-P10-03 — invalid quarter rejected
  it("rejects with 400 when quarter body field is invalid", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/financial-objectives")
      .set("Authorization", "Bearer valid-token")
      .send({
        quarter: "not-a-quarter",
        revenue_target: 500000,
      });

    expect(res.status).toBe(400);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  // Tests R-P10-03 — missing quarter rejected
  it("rejects with 400 when quarter is missing", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/financial-objectives")
      .set("Authorization", "Bearer valid-token")
      .send({ revenue_target: 500000 });

    expect(res.status).toBe(400);
    expect(mockQuery).not.toHaveBeenCalled();
  });
});
