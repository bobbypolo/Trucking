import { describe, it, expect, vi, beforeEach } from "vitest";

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
  const mockAuth = { verifyIdToken: vi.fn().mockResolvedValue({ uid: "firebase-uid-1" }) };
  return { default: { app: vi.fn(), auth: () => mockAuth } };
});

vi.mock("../../lib/sql-auth", () => ({
  resolveSqlPrincipalByFirebaseUid: mockResolveSqlPrincipalByFirebaseUid,
}));

import express from "express";
import request from "supertest";
import crisisActionsRouter from "../../routes/crisis-actions";
import { errorHandler } from "../../middleware/errorHandler";
import { DEFAULT_SQL_PRINCIPAL } from "../helpers/mock-sql-auth";

mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(DEFAULT_SQL_PRINCIPAL);

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(crisisActionsRouter);
  app.use(errorHandler);
  return app;
}

// ── GET /api/crisis-actions — auth enforcement ──────────────────────────────

describe("GET /api/crisis-actions — auth enforcement", () => {
  beforeEach(() => { vi.clearAllMocks(); mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(DEFAULT_SQL_PRINCIPAL); });

  it("returns 401 when no auth token is provided", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/crisis-actions");
    expect(res.status).toBe(401);
  });

  it("returns 401 when user has no linked SQL account", async () => {
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(null);
    const app = buildApp();
    const res = await request(app).get("/api/crisis-actions").set("Authorization", "Bearer valid-token");
    expect(res.status).toBe(401);
  });
});

// ── GET /api/crisis-actions — success path ──────────────────────────────────

describe("GET /api/crisis-actions — success", () => {
  let app: ReturnType<typeof buildApp>;
  beforeEach(() => { vi.clearAllMocks(); mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(DEFAULT_SQL_PRINCIPAL); app = buildApp(); });

  it("returns crisis actions list with 200", async () => {
    const actions = [
      { id: "ca-001", company_id: "company-aaa", type: "Weather Reroute", status: "Active", incident_id: "inc-001", description: "Tornado warning on I-35" },
      { id: "ca-002", company_id: "company-aaa", type: "Breakdown Response", status: "Resolved", incident_id: "inc-002", description: "Flat tire on US-75" },
    ];
    mockQuery.mockResolvedValueOnce([actions, []]);
    const res = await request(app).get("/api/crisis-actions").set("Authorization", "Bearer valid-token");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
  });

  it("returns 500 on database error", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB connection error"));
    const res = await request(app).get("/api/crisis-actions").set("Authorization", "Bearer valid-token");
    expect(res.status).toBe(500);
  });
});

// ── POST /api/crisis-actions — creation ─────────────────────────────────────

describe("POST /api/crisis-actions — creation", () => {
  let app: ReturnType<typeof buildApp>;
  beforeEach(() => { vi.clearAllMocks(); mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(DEFAULT_SQL_PRINCIPAL); app = buildApp(); });

  it("returns 201 with valid data", async () => {
    const createdAction = { id: "ca-new", company_id: "company-aaa", type: "Weather Reroute", status: "Active", incident_id: "inc-001", description: "Tornado warning on I-35" };
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    mockQuery.mockResolvedValueOnce([[createdAction], []]);
    const res = await request(app).post("/api/crisis-actions").set("Authorization", "Bearer valid-token").send({ type: "Weather Reroute", status: "Active", incident_id: "inc-001", description: "Tornado warning on I-35" });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe("ca-new");
    expect(res.body.type).toBe("Weather Reroute");
  });

  it("returns 400 when required field 'type' is missing", async () => {
    const res = await request(app).post("/api/crisis-actions").set("Authorization", "Bearer valid-token").send({ status: "Active", description: "No type provided" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when 'type' is empty string", async () => {
    const res = await request(app).post("/api/crisis-actions").set("Authorization", "Bearer valid-token").send({ type: "" });
    expect(res.status).toBe(400);
  });

  it("returns 500 on database error during creation", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB insert failed"));
    const res = await request(app).post("/api/crisis-actions").set("Authorization", "Bearer valid-token").send({ type: "Weather Reroute" });
    expect(res.status).toBe(500);
  });
});

// ── PATCH /api/crisis-actions/:id — role enforcement ────────────────────────

describe("PATCH /api/crisis-actions/:id — role enforcement", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns 403 when driver tries to modify crisis action", async () => {
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue({ ...DEFAULT_SQL_PRINCIPAL, role: "driver" });
    const app = buildApp();
    const res = await request(app).patch("/api/crisis-actions/ca-001").set("Authorization", "Bearer valid-token").send({ status: "Resolved" });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("Insufficient role for crisis action modification");
  });

  it("returns 403 when customer role tries to modify crisis action", async () => {
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue({ ...DEFAULT_SQL_PRINCIPAL, role: "customer" });
    const app = buildApp();
    const res = await request(app).patch("/api/crisis-actions/ca-001").set("Authorization", "Bearer valid-token").send({ status: "Resolved" });
    expect(res.status).toBe(403);
  });

  it("returns 200 when admin modifies crisis action", async () => {
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(DEFAULT_SQL_PRINCIPAL);
    const app = buildApp();
    const existing = { id: "ca-001", company_id: "company-aaa", type: "Weather Reroute", status: "Active", timeline: null };
    const updated = { id: "ca-001", company_id: "company-aaa", type: "Weather Reroute", status: "Resolved" };
    mockQuery.mockResolvedValueOnce([[existing], []]);
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    mockQuery.mockResolvedValueOnce([[updated], []]);
    const res = await request(app).patch("/api/crisis-actions/ca-001").set("Authorization", "Bearer valid-token").send({ status: "Resolved" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("Resolved");
  });

  it("returns 200 when dispatcher modifies crisis action", async () => {
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue({ ...DEFAULT_SQL_PRINCIPAL, role: "dispatcher" });
    const app = buildApp();
    const existing = { id: "ca-001", company_id: "company-aaa", type: "Weather Reroute", status: "Active", timeline: null };
    const updated = { id: "ca-001", company_id: "company-aaa", type: "Weather Reroute", status: "Resolved" };
    mockQuery.mockResolvedValueOnce([[existing], []]);
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    mockQuery.mockResolvedValueOnce([[updated], []]);
    const res = await request(app).patch("/api/crisis-actions/ca-001").set("Authorization", "Bearer valid-token").send({ status: "Resolved" });
    expect(res.status).toBe(200);
  });

  it("returns 200 when safety_manager modifies crisis action", async () => {
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue({ ...DEFAULT_SQL_PRINCIPAL, role: "safety_manager" });
    const app = buildApp();
    const existing = { id: "ca-001", company_id: "company-aaa", type: "Weather Reroute", status: "Active", timeline: null };
    const updated = { id: "ca-001", company_id: "company-aaa", type: "Weather Reroute", status: "Escalated" };
    mockQuery.mockResolvedValueOnce([[existing], []]);
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    mockQuery.mockResolvedValueOnce([[updated], []]);
    const res = await request(app).patch("/api/crisis-actions/ca-001").set("Authorization", "Bearer valid-token").send({ status: "Escalated" });
    expect(res.status).toBe(200);
  });
});

// ── PATCH /api/crisis-actions/:id — tenant isolation ────────────────────────

describe("PATCH /api/crisis-actions/:id — tenant isolation", () => {
  let app: ReturnType<typeof buildApp>;
  beforeEach(() => { vi.clearAllMocks(); mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(DEFAULT_SQL_PRINCIPAL); app = buildApp(); });

  it("returns 404 for cross-tenant update attempt (conceals existence)", async () => {
    mockQuery.mockResolvedValueOnce([[{ id: "ca-001", company_id: "company-zzz", type: "Weather Reroute", timeline: null }], []]);
    const res = await request(app).patch("/api/crisis-actions/ca-001").set("Authorization", "Bearer valid-token").send({ status: "Resolved" });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Crisis action not found");
  });

  it("returns 404 when crisis action does not exist", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);
    const res = await request(app).patch("/api/crisis-actions/nonexistent").set("Authorization", "Bearer valid-token").send({ status: "Resolved" });
    expect(res.status).toBe(404);
  });
});

// ── DELETE /api/crisis-actions — no endpoint ────────────────────────────────

describe("DELETE /api/crisis-actions/:id — no endpoint exists", () => {
  let app: ReturnType<typeof buildApp>;
  beforeEach(() => { vi.clearAllMocks(); mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(DEFAULT_SQL_PRINCIPAL); app = buildApp(); });

  it("returns 404 — DELETE endpoint does not exist (retention policy)", async () => {
    const res = await request(app).delete("/api/crisis-actions/ca-001").set("Authorization", "Bearer valid-token");
    expect(res.status).toBe(404);
  });
});

