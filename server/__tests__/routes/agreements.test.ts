/**
 * Tests R-P9-02..05, R-P9-07, R-P9-08: /api/agreements routes
 *
 * Covers:
 *  - POST /api/agreements creates DRAFT → 201 (R-P9-02)
 *  - POST rejects missing load_id → 400 (R-P9-07)
 *  - GET /api/agreements/:id → 200 with record or 404 (R-P9-03)
 *  - PATCH /api/agreements/:id/sign → 200 with SIGNED status (R-P9-04)
 *  - PATCH sign → 409 when already SIGNED (R-P9-05)
 *  - PATCH sign rejects missing signature_data → 400 (R-P9-08)
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
import agreementsRouter from "../../routes/agreements";
import { errorHandler } from "../../middleware/errorHandler";
import { DEFAULT_SQL_PRINCIPAL } from "../helpers/mock-sql-auth";

mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(DEFAULT_SQL_PRINCIPAL);

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(agreementsRouter);
  app.use(errorHandler);
  return app;
}

const AGREEMENT_ROW = {
  id: "agr-1",
  company_id: "company-aaa",
  load_id: "load-1",
  rate_con_data: { carrierRate: 3000, broker: "ACME" },
  status: "DRAFT",
  signature_data: null,
  signed_at: null,
  created_at: "2026-04-11T00:00:00.000Z",
  updated_at: "2026-04-11T00:00:00.000Z",
};

const SIGNED_AGREEMENT_ROW = {
  ...AGREEMENT_ROW,
  status: "SIGNED",
  signature_data: { dataUrl: "data:image/png;base64,AAA", signedBy: "Alice" },
  signed_at: "2026-04-11T01:00:00.000Z",
};

describe("POST /api/agreements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
  });

  // Tests R-P9-02
  it("creates DRAFT agreement and returns 201 with { id, status: 'DRAFT' }", async () => {
    // First call: INSERT. Second call: SELECT after insert (findById).
    mockQuery.mockResolvedValueOnce([{ insertId: 0 }, []]);
    mockQuery.mockResolvedValueOnce([[AGREEMENT_ROW], []]);

    const app = buildApp();
    const res = await request(app)
      .post("/api/agreements")
      .set("Authorization", "Bearer valid-token")
      .send({
        load_id: "load-1",
        rate_con_data: { carrierRate: 3000, broker: "ACME" },
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("id");
    expect(res.body).toHaveProperty("status", "DRAFT");
    expect(res.body.id).toBe("agr-1");
  });

  // Tests R-P9-02 — INSERT targets digital_agreements with DRAFT status
  it("INSERT query targets digital_agreements with DRAFT status", async () => {
    mockQuery.mockResolvedValueOnce([{ insertId: 0 }, []]);
    mockQuery.mockResolvedValueOnce([[AGREEMENT_ROW], []]);

    const app = buildApp();
    await request(app)
      .post("/api/agreements")
      .set("Authorization", "Bearer valid-token")
      .send({ load_id: "load-1" });

    // First call should be the INSERT
    const [insertSql] = mockQuery.mock.calls[0];
    expect(String(insertSql).toLowerCase()).toContain(
      "insert into digital_agreements",
    );
    expect(String(insertSql)).toContain("'DRAFT'");
  });

  // Tests R-P9-07
  it("rejects with 400 when load_id is missing", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/agreements")
      .set("Authorization", "Bearer valid-token")
      .send({ rate_con_data: { carrierRate: 3000 } });

    expect(res.status).toBe(400);
    // DB should not have been touched
    expect(mockQuery).not.toHaveBeenCalled();
  });

  // Tests R-P9-07 — empty load_id also rejected
  it("rejects with 400 when load_id is empty string", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/agreements")
      .set("Authorization", "Bearer valid-token")
      .send({ load_id: "", rate_con_data: {} });

    expect(res.status).toBe(400);
    expect(mockQuery).not.toHaveBeenCalled();
  });
});

describe("GET /api/agreements/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
  });

  // Tests R-P9-03
  it("returns 200 with full agreement record when found", async () => {
    mockQuery.mockResolvedValueOnce([[AGREEMENT_ROW], []]);

    const app = buildApp();
    const res = await request(app)
      .get("/api/agreements/agr-1")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: "agr-1",
      company_id: "company-aaa",
      load_id: "load-1",
      status: "DRAFT",
    });
  });

  // Tests R-P9-03
  it("returns 404 when agreement does not exist", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);

    const app = buildApp();
    const res = await request(app)
      .get("/api/agreements/missing")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(404);
  });

  // Tests R-P9-03 — cross-tenant isolation
  it("returns 404 when agreement belongs to another tenant", async () => {
    mockQuery.mockResolvedValueOnce([
      [{ ...AGREEMENT_ROW, company_id: "company-zzz" }],
      [],
    ]);

    const app = buildApp();
    const res = await request(app)
      .get("/api/agreements/agr-1")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/agreements/:id/sign", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
  });

  // Tests R-P9-04
  it("updates status to SIGNED and stores signature_data, returning 200", async () => {
    // findById (pre-check): DRAFT agreement
    mockQuery.mockResolvedValueOnce([[AGREEMENT_ROW], []]);
    // UPDATE
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    // findById (after update): SIGNED agreement
    mockQuery.mockResolvedValueOnce([[SIGNED_AGREEMENT_ROW], []]);

    const app = buildApp();
    const res = await request(app)
      .patch("/api/agreements/agr-1/sign")
      .set("Authorization", "Bearer valid-token")
      .send({
        signature_data: {
          dataUrl: "data:image/png;base64,AAA",
          signedBy: "Alice",
        },
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("status", "SIGNED");
    expect(res.body.signature_data).toMatchObject({ signedBy: "Alice" });

    // Verify UPDATE query stored signature_data and set status to SIGNED
    const [updateSql, updateParams] = mockQuery.mock.calls[1];
    const updateSqlUpper = String(updateSql).toUpperCase();
    expect(updateSqlUpper).toContain("UPDATE DIGITAL_AGREEMENTS");
    expect(updateSqlUpper).toContain("'SIGNED'");
    expect(updateSqlUpper).toContain("SIGNATURE_DATA");
    // First UPDATE param should be the serialized signature JSON
    expect(typeof updateParams[0]).toBe("string");
    expect(JSON.parse(updateParams[0])).toMatchObject({ signedBy: "Alice" });
  });

  // Tests R-P9-05
  it("returns 409 when agreement is already SIGNED", async () => {
    // findById (pre-check): already SIGNED
    mockQuery.mockResolvedValueOnce([[SIGNED_AGREEMENT_ROW], []]);

    const app = buildApp();
    const res = await request(app)
      .patch("/api/agreements/agr-1/sign")
      .set("Authorization", "Bearer valid-token")
      .send({
        signature_data: {
          dataUrl: "data:image/png;base64,BBB",
          signedBy: "Bob",
        },
      });

    expect(res.status).toBe(409);
    // Only the pre-check SELECT should have run; no UPDATE
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  // Tests R-P9-08
  it("rejects with 400 when signature_data is missing", async () => {
    const app = buildApp();
    const res = await request(app)
      .patch("/api/agreements/agr-1/sign")
      .set("Authorization", "Bearer valid-token")
      .send({});

    expect(res.status).toBe(400);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  // Tests R-P9-04 — 404 when agreement does not exist
  it("returns 404 when agreement does not exist", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);

    const app = buildApp();
    const res = await request(app)
      .patch("/api/agreements/missing/sign")
      .set("Authorization", "Bearer valid-token")
      .send({ signature_data: { dataUrl: "x", signedBy: "x" } });

    expect(res.status).toBe(404);
  });

  // Tests R-P9-05 — race: concurrent sign where another request flipped
  // the row to SIGNED between our pre-check findById and our atomic
  // UPDATE. The repository's sign() returns null because affectedRows
  // was 0 under the status guard, and the route must map that to 409.
  it("returns 409 when concurrent sign races (sign() returns null)", async () => {
    // findById (pre-check): DRAFT row — passes the fast-path check
    mockQuery.mockResolvedValueOnce([[AGREEMENT_ROW], []]);
    // UPDATE: status guard refuses the transition → affectedRows = 0
    mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }, []]);
    // No second findById should be issued when sign() returns null.

    const app = buildApp();
    const res = await request(app)
      .patch("/api/agreements/agr-1/sign")
      .set("Authorization", "Bearer valid-token")
      .send({
        signature_data: {
          dataUrl: "data:image/png;base64,CCC",
          signedBy: "Carol",
        },
      });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: "Agreement already signed" });
    // Exactly two queries: the pre-check SELECT and the refused UPDATE.
    // No post-update SELECT because sign() short-circuits on affectedRows=0.
    expect(mockQuery).toHaveBeenCalledTimes(2);
  });

  // Tests R-P9-04 — repository SQL contract: the UPDATE must enforce
  // tenant isolation AND a DRAFT/SENT status guard atomically. This
  // documents the contract so future refactors cannot silently drop
  // the guards and reintroduce the TOCTOU race.
  it("sign() UPDATE includes company_id and status IN ('DRAFT', 'SENT') guards", async () => {
    // findById (pre-check): DRAFT row
    mockQuery.mockResolvedValueOnce([[AGREEMENT_ROW], []]);
    // UPDATE: accepted
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    // findById (post-update): SIGNED row
    mockQuery.mockResolvedValueOnce([[SIGNED_AGREEMENT_ROW], []]);

    const app = buildApp();
    await request(app)
      .patch("/api/agreements/agr-1/sign")
      .set("Authorization", "Bearer valid-token")
      .send({
        signature_data: {
          dataUrl: "data:image/png;base64,AAA",
          signedBy: "Alice",
        },
      });

    // mockQuery.mock.calls[1] is the UPDATE (calls[0] is the pre-check SELECT)
    const [updateSql, updateParams] = mockQuery.mock.calls[1];
    const updateSqlStr = String(updateSql);
    // Tenant boundary enforced at the SQL layer (defense in depth)
    expect(updateSqlStr).toContain("company_id = ?");
    // Status guard atomically prevents double-signing under concurrency
    expect(updateSqlStr).toContain("status IN ('DRAFT', 'SENT')");
    // Params: [signatureJson, id, companyId]
    expect(updateParams).toHaveLength(3);
    expect(updateParams[1]).toBe("agr-1");
    // companyId is the DEFAULT_SQL_PRINCIPAL's tenantId passed through
    // requireTenant → req.user.tenantId → route → repository
    expect(typeof updateParams[2]).toBe("string");
    expect((updateParams[2] as string).length).toBeGreaterThan(0);
  });
});
