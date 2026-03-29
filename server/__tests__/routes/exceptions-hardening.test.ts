import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Exceptions Route Hardening Tests
 *
 * Covers previously uncovered lines and branches in exceptions.ts:
 * - GET /api/exceptions: all filter query params (type, severity, entityType, entityId, ownerId)
 * - POST /api/exceptions: validation failures, DB errors
 * - PATCH /api/exceptions/:id: RESOLVED status triggers, CLOSED status triggers, multiple field updates
 * - GET /api/exceptions/:id/events: success, DB error, tenant isolation
 * - GET /api/exception-types: success, DB error
 */

const { mockQuery, mockResolveSqlPrincipalByFirebaseUid } = vi.hoisted(() => {
  const mockQuery = vi.fn();
  const mockResolveSqlPrincipalByFirebaseUid = vi.fn();
  return { mockQuery, mockResolveSqlPrincipalByFirebaseUid };
});

vi.mock("../../db", () => ({ default: { query: mockQuery } }));

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
  return { default: { app: vi.fn(), auth: () => mockAuth } };
});

vi.mock("../../lib/sql-auth", () => ({
  resolveSqlPrincipalByFirebaseUid: mockResolveSqlPrincipalByFirebaseUid,
}));

import express from "express";
import request from "supertest";
import exceptionsRouter from "../../routes/exceptions";
import { errorHandler } from "../../middleware/errorHandler";
import { DEFAULT_SQL_PRINCIPAL } from "../helpers/mock-sql-auth";

mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(DEFAULT_SQL_PRINCIPAL);

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(exceptionsRouter);
  app.use(errorHandler);
  return app;
}

const makeException = (overrides: Record<string, unknown> = {}) => ({
  id: "ex-001",
  company_id: "company-aaa",
  type: "DELAY",
  status: "OPEN",
  severity: 2,
  entity_type: "LOAD",
  entity_id: "load-001",
  owner_user_id: "user-1",
  team: "dispatch",
  sla_due_at: null,
  workflow_step: "triage",
  financial_impact_est: 0,
  description: "Driver delayed",
  links: "{}",
  ...overrides,
});

// ── GET /api/exceptions — all filter paths ──────────────────────────

describe("GET /api/exceptions — filter query params", () => {
  let app: ReturnType<typeof buildApp>;
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
    app = buildApp();
  });

  it("filters by type query param", async () => {
    mockQuery.mockResolvedValueOnce([[makeException()], []]);
    const res = await request(app)
      .get("/api/exceptions?type=DELAY")
      .set("Authorization", "Bearer valid-token");
    expect(res.status).toBe(200);
    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toContain("type = ?");
    const params = mockQuery.mock.calls[0][1] as unknown[];
    expect(params).toContain("DELAY");
  });

  it("filters by severity query param", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);
    await request(app)
      .get("/api/exceptions?severity=1")
      .set("Authorization", "Bearer valid-token");
    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toContain("severity = ?");
    const params = mockQuery.mock.calls[0][1] as unknown[];
    expect(params).toContain("1");
  });

  it("filters by entityType query param", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);
    await request(app)
      .get("/api/exceptions?entityType=LOAD")
      .set("Authorization", "Bearer valid-token");
    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toContain("entity_type = ?");
  });

  it("filters by entityId query param", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);
    await request(app)
      .get("/api/exceptions?entityId=load-001")
      .set("Authorization", "Bearer valid-token");
    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toContain("entity_id = ?");
    const params = mockQuery.mock.calls[0][1] as unknown[];
    expect(params).toContain("load-001");
  });

  it("filters by ownerId query param", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);
    await request(app)
      .get("/api/exceptions?ownerId=user-1")
      .set("Authorization", "Bearer valid-token");
    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toContain("owner_user_id = ?");
    const params = mockQuery.mock.calls[0][1] as unknown[];
    expect(params).toContain("user-1");
  });

  it("applies multiple filters simultaneously", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);
    await request(app)
      .get(
        "/api/exceptions?status=OPEN&type=DELAY&severity=2&entityType=LOAD&entityId=load-001&ownerId=user-1",
      )
      .set("Authorization", "Bearer valid-token");
    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toContain("status = ?");
    expect(sql).toContain("type = ?");
    expect(sql).toContain("severity = ?");
    expect(sql).toContain("entity_type = ?");
    expect(sql).toContain("entity_id = ?");
    expect(sql).toContain("owner_user_id = ?");
    const params = mockQuery.mock.calls[0][1] as unknown[];
    expect(params).toHaveLength(7);
  });

  it("query orders by severity DESC, sla_due_at ASC", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);
    await request(app)
      .get("/api/exceptions")
      .set("Authorization", "Bearer valid-token");
    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toContain("ORDER BY severity DESC, sla_due_at ASC");
  });
});

// ── POST /api/exceptions — validation and DB paths ──────────────────

describe("POST /api/exceptions — validation and edge cases", () => {
  let app: ReturnType<typeof buildApp>;
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
    app = buildApp();
  });

  it("returns 400 when type is missing (schema validation)", async () => {
    const res = await request(app)
      .post("/api/exceptions")
      .set("Authorization", "Bearer valid-token")
      .send({ entityType: "LOAD", entityId: "load-001" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when entityType is missing", async () => {
    const res = await request(app)
      .post("/api/exceptions")
      .set("Authorization", "Bearer valid-token")
      .send({ type: "DELAY", entityId: "load-001" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when entityId is missing", async () => {
    const res = await request(app)
      .post("/api/exceptions")
      .set("Authorization", "Bearer valid-token")
      .send({ type: "DELAY", entityType: "LOAD" });
    expect(res.status).toBe(400);
  });

  it("creates exception with all optional fields", async () => {
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    const res = await request(app)
      .post("/api/exceptions")
      .set("Authorization", "Bearer valid-token")
      .send({
        type: "DELAY",
        status: "OPEN",
        severity: 1,
        entityType: "LOAD",
        entityId: "load-001",
        ownerUserId: "user-1",
        team: "dispatch",
        slaDueAt: "2026-03-20T12:00:00Z",
        workflowStep: "investigation",
        financialImpactEst: 5000,
        description: "Late delivery due to weather",
        links: { url: "https://example.com" },
        createdBy: "dispatcher-1",
      });
    expect(res.status).toBe(201);
    expect(res.body.message).toBe("Exception recorded");
    expect(res.body.id).toMatch(/^[a-f0-9-]{36}$/);
  });

  it("uses default values for optional fields", async () => {
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    const res = await request(app)
      .post("/api/exceptions")
      .set("Authorization", "Bearer valid-token")
      .send({ type: "POD_MISSING", entityType: "LOAD", entityId: "load-002" });
    expect(res.status).toBe(201);
    const insertParams = mockQuery.mock.calls[0][1] as unknown[];
    expect(insertParams[3]).toBe("OPEN");
    expect(insertParams[4]).toBe(2);
    expect(insertParams[10]).toBe("triage");
    expect(insertParams[11]).toBe(0);
  });

  it("returns 500 on DB error during INSERT", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB error"));
    const res = await request(app)
      .post("/api/exceptions")
      .set("Authorization", "Bearer valid-token")
      .send({ type: "DELAY", entityType: "LOAD", entityId: "load-001" });
    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Database error");
  });
});

// ── PATCH /api/exceptions/:id — RESOLVED/CLOSED paths ───────────────

describe("PATCH /api/exceptions/:id — resolution and closure paths", () => {
  let app: ReturnType<typeof buildApp>;
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
    app = buildApp();
  });

  it("RESOLVED status triggers resolved_at timestamp and resolution hooks", async () => {
    const existing = makeException();
    mockQuery.mockResolvedValueOnce([[existing], []]);
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    mockQuery.mockResolvedValueOnce([
      [makeException({ status: "RESOLVED" })],
      [],
    ]);
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    const res = await request(app)
      .patch("/api/exceptions/ex-001")
      .set("Authorization", "Bearer valid-token")
      .send({
        status: "RESOLVED",
        notes: "Issue resolved",
        actorName: "manager-1",
      });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Exception updated");
    const updateSql = mockQuery.mock.calls[1][0] as string;
    expect(updateSql).toContain("resolved_at = CURRENT_TIMESTAMP");
  });

  it("CLOSED status triggers resolved_at timestamp", async () => {
    const existing = makeException();
    mockQuery.mockResolvedValueOnce([[existing], []]);
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    const res = await request(app)
      .patch("/api/exceptions/ex-001")
      .set("Authorization", "Bearer valid-token")
      .send({
        status: "CLOSED",
        notes: "No longer relevant",
        actorName: "admin-1",
      });
    expect(res.status).toBe(200);
    const updateSql = mockQuery.mock.calls[1][0] as string;
    expect(updateSql).toContain("resolved_at = CURRENT_TIMESTAMP");
  });

  it("updates ownerUserId field", async () => {
    const existing = makeException();
    mockQuery.mockResolvedValueOnce([[existing], []]);
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    const res = await request(app)
      .patch("/api/exceptions/ex-001")
      .set("Authorization", "Bearer valid-token")
      .send({ ownerUserId: "user-new-owner", actorName: "admin" });
    expect(res.status).toBe(200);
    const updateSql = mockQuery.mock.calls[1][0] as string;
    expect(updateSql).toContain("owner_user_id = ?");
  });

  it("updates workflowStep field", async () => {
    const existing = makeException();
    mockQuery.mockResolvedValueOnce([[existing], []]);
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    const res = await request(app)
      .patch("/api/exceptions/ex-001")
      .set("Authorization", "Bearer valid-token")
      .send({ workflowStep: "investigation", actorName: "dispatcher" });
    expect(res.status).toBe(200);
    const updateSql = mockQuery.mock.calls[1][0] as string;
    expect(updateSql).toContain("workflow_step = ?");
  });

  it("updates severity field", async () => {
    const existing = makeException();
    mockQuery.mockResolvedValueOnce([[existing], []]);
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    const res = await request(app)
      .patch("/api/exceptions/ex-001")
      .set("Authorization", "Bearer valid-token")
      .send({ severity: "1", actorName: "admin" });
    expect(res.status).toBe(200);
    const updateSql = mockQuery.mock.calls[1][0] as string;
    expect(updateSql).toContain("severity = ?");
  });

  it("updates multiple fields at once", async () => {
    const existing = makeException();
    mockQuery.mockResolvedValueOnce([[existing], []]);
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    const res = await request(app)
      .patch("/api/exceptions/ex-001")
      .set("Authorization", "Bearer valid-token")
      .send({
        status: "IN_PROGRESS",
        ownerUserId: "user-2",
        workflowStep: "investigation",
        severity: "1",
        notes: "Escalated",
        actorName: "manager",
      });
    expect(res.status).toBe(200);
    const updateSql = mockQuery.mock.calls[1][0] as string;
    expect(updateSql).toContain("status = ?");
    expect(updateSql).toContain("owner_user_id = ?");
    expect(updateSql).toContain("workflow_step = ?");
    expect(updateSql).toContain("severity = ?");
  });

  it("returns 404 for cross-tenant exception update", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);
    const res = await request(app)
      .patch("/api/exceptions/ex-cross-tenant")
      .set("Authorization", "Bearer valid-token")
      .send({ status: "RESOLVED" });
    expect(res.status).toBe(404);
  });

  it("returns 400 when no fields are provided (schema refine)", async () => {
    const res = await request(app)
      .patch("/api/exceptions/ex-001")
      .set("Authorization", "Bearer valid-token")
      .send({});
    expect(res.status).toBe(400);
  });

  it("logs event with before_state and after_state", async () => {
    const existing = makeException();
    mockQuery.mockResolvedValueOnce([[existing], []]);
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    await request(app)
      .patch("/api/exceptions/ex-001")
      .set("Authorization", "Bearer valid-token")
      .send({
        status: "IN_PROGRESS",
        notes: "Working on it",
        actorName: "dispatcher-1",
      });
    const eventInsertCall = mockQuery.mock.calls[2];
    const eventSql = eventInsertCall[0] as string;
    expect(eventSql).toContain("before_state");
    expect(eventSql).toContain("after_state");
    const eventParams = eventInsertCall[1] as unknown[];
    expect(eventParams[5]).toContain("ex-001");
    expect(eventParams[6]).toContain("IN_PROGRESS");
  });
});

// ── GET /api/exceptions/:id/events — coverage ───────────────────────

describe("GET /api/exceptions/:id/events — hardening", () => {
  let app: ReturnType<typeof buildApp>;
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
    app = buildApp();
  });

  it("returns empty array when no events exist", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);
    const res = await request(app)
      .get("/api/exceptions/ex-001/events")
      .set("Authorization", "Bearer valid-token");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  it("returns multiple events with correct structure", async () => {
    const events = [
      {
        id: "evt-001",
        exception_id: "ex-001",
        action: "Exception Created",
        notes: "Initial",
        actor_name: "System",
        timestamp: "2026-03-15T10:00:00Z",
      },
      {
        id: "evt-002",
        exception_id: "ex-001",
        action: "Status/Owner Updated",
        notes: "Assigned to team",
        actor_name: "Manager",
        timestamp: "2026-03-15T11:00:00Z",
      },
    ];
    mockQuery.mockResolvedValueOnce([events, []]);
    const res = await request(app)
      .get("/api/exceptions/ex-001/events")
      .set("Authorization", "Bearer valid-token");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].action).toBe("Exception Created");
  });

  it("returns 500 on DB error", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB error"));
    const res = await request(app)
      .get("/api/exceptions/ex-001/events")
      .set("Authorization", "Bearer valid-token");
    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Database error");
  });

  it("tenant-scopes the events query via INNER JOIN", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);
    await request(app)
      .get("/api/exceptions/ex-001/events")
      .set("Authorization", "Bearer valid-token");
    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toContain("INNER JOIN exceptions");
    expect(sql).toContain("tenant_id = ?");
    const params = mockQuery.mock.calls[0][1] as unknown[];
    expect(params).toContain("company-aaa");
  });
});

// ── GET /api/exception-types — coverage ─────────────────────────────

describe("GET /api/exception-types — success and error", () => {
  let app: ReturnType<typeof buildApp>;
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
    app = buildApp();
  });

  it("returns exception types list with 200", async () => {
    const types = [
      { id: 1, display_name: "Delay", slug: "DELAY" },
      { id: 2, display_name: "POD Missing", slug: "POD_MISSING" },
    ];
    mockQuery.mockResolvedValueOnce([types, []]);
    const res = await request(app)
      .get("/api/exception-types")
      .set("Authorization", "Bearer valid-token");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].display_name).toBe("Delay");
  });

  it("returns empty array when no exception types exist", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);
    const res = await request(app)
      .get("/api/exception-types")
      .set("Authorization", "Bearer valid-token");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  it("returns 500 on DB error", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB error"));
    const res = await request(app)
      .get("/api/exception-types")
      .set("Authorization", "Bearer valid-token");
    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Database error");
  });
});
