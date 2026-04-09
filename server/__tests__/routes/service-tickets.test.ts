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
import serviceTicketsRouter from "../../routes/service-tickets";
import { errorHandler } from "../../middleware/errorHandler";
import { DEFAULT_SQL_PRINCIPAL } from "../helpers/mock-sql-auth";

mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(DEFAULT_SQL_PRINCIPAL);

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(serviceTicketsRouter);
  app.use(errorHandler);
  return app;
}

const makeTicket = (overrides: Record<string, unknown> = {}) => ({
  id: "st-001",
  company_id: "company-aaa",
  type: "Oil Change",
  status: "Open",
  vendor: "Acme Fleet Services",
  cost: 150.0,
  equipment_id: "truck-001",
  description: "Routine oil change",
  created_by: "user-1",
  updated_by: "user-1",
  archived_at: null,
  locked_at: null,
  ...overrides,
});

// ── Auth enforcement ────────────────────────────────────────────────

describe("Service tickets routes — auth enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
  });

  it("GET /api/service-tickets returns 401 without auth", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/service-tickets");
    expect(res.status).toBe(401);
  });

  it("POST /api/service-tickets returns 401 without auth", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/service-tickets")
      .send({ type: "Oil Change" });
    expect(res.status).toBe(401);
  });

  it("PATCH /api/service-tickets/:id returns 401 without auth", async () => {
    const app = buildApp();
    const res = await request(app)
      .patch("/api/service-tickets/st-001")
      .send({ status: "Closed" });
    expect(res.status).toBe(401);
  });
});

// ── GET /api/service-tickets — success ──────────────────────────────

describe("GET /api/service-tickets — success", () => {
  let app: ReturnType<typeof buildApp>;
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
    app = buildApp();
  });

  it("returns tickets list with 200", async () => {
    const tickets = [
      makeTicket(),
      makeTicket({ id: "st-002", type: "Brake Inspection" }),
    ];
    mockQuery.mockResolvedValueOnce([tickets, []]);
    const res = await request(app)
      .get("/api/service-tickets")
      .set("Authorization", "Bearer valid-token");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
  });

  it("returns empty array when no tickets exist", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);
    const res = await request(app)
      .get("/api/service-tickets")
      .set("Authorization", "Bearer valid-token");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  it("supports pagination via page and limit query params", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);
    await request(app)
      .get("/api/service-tickets?page=2&limit=20")
      .set("Authorization", "Bearer valid-token");
    const queryCall = mockQuery.mock.calls[0];
    expect(queryCall[1]).toContain(20);
    expect(queryCall[1]).toContain(20);
  });

  it("returns 500 on database error", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB connection error"));
    const res = await request(app)
      .get("/api/service-tickets")
      .set("Authorization", "Bearer valid-token");
    expect(res.status).toBe(500);
    expect(res.body.message).toBeDefined();
  });
});

// ── POST /api/service-tickets — creation ────────────────────────────

describe("POST /api/service-tickets — creation", () => {
  let app: ReturnType<typeof buildApp>;
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
    app = buildApp();
  });

  it("creates ticket and returns 201", async () => {
    const created = makeTicket();
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    mockQuery.mockResolvedValueOnce([[created], []]);
    const res = await request(app)
      .post("/api/service-tickets")
      .set("Authorization", "Bearer valid-token")
      .send({
        type: "Oil Change",
        status: "Open",
        vendor: "Acme Fleet Services",
        cost: 150.0,
        equipment_id: "truck-001",
        description: "Routine oil change",
      });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe("st-001");
  });

  it("creates ticket with minimal data", async () => {
    const created = makeTicket({ type: undefined, status: undefined });
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    mockQuery.mockResolvedValueOnce([[created], []]);
    const res = await request(app)
      .post("/api/service-tickets")
      .set("Authorization", "Bearer valid-token")
      .send({});
    expect(res.status).toBe(201);
  });

  it("returns 400 when cost is not a number (schema validation)", async () => {
    const res = await request(app)
      .post("/api/service-tickets")
      .set("Authorization", "Bearer valid-token")
      .send({ cost: "not-a-number" });

    expect(res.status).toBe(400);
  });

  it("returns 500 on database error during creation", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB insert failed"));
    const res = await request(app)
      .post("/api/service-tickets")
      .set("Authorization", "Bearer valid-token")
      .send({ type: "Tire Rotation" });
    expect(res.status).toBe(500);
    expect(res.body.message).toBeDefined();
  });
});

// ── PATCH /api/service-tickets/:id — update ─────────────────────────

describe("PATCH /api/service-tickets/:id — update", () => {
  let app: ReturnType<typeof buildApp>;
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
    app = buildApp();
  });

  it("updates ticket and returns 200", async () => {
    const existing = makeTicket();
    const updated = makeTicket({ status: "In Progress" });
    mockQuery.mockResolvedValueOnce([[existing], []]);
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    mockQuery.mockResolvedValueOnce([[updated], []]);
    const res = await request(app)
      .patch("/api/service-tickets/st-001")
      .set("Authorization", "Bearer valid-token")
      .send({ status: "In Progress" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("In Progress");
  });

  it("returns 404 when ticket does not exist", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);
    const res = await request(app)
      .patch("/api/service-tickets/nonexistent")
      .set("Authorization", "Bearer valid-token")
      .send({ status: "Closed" });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Service ticket not found");
  });

  it("returns 404 for cross-tenant ticket update (conceals existence)", async () => {
    mockQuery.mockResolvedValueOnce([
      [makeTicket({ company_id: "company-zzz" })],
      [],
    ]);
    const res = await request(app)
      .patch("/api/service-tickets/st-001")
      .set("Authorization", "Bearer valid-token")
      .send({ status: "Closed" });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Service ticket not found");
  });

  it("returns 403 when editing a locked closed ticket", async () => {
    mockQuery.mockResolvedValueOnce([
      [makeTicket({ status: "Closed", locked_at: "2026-03-15T12:00:00Z" })],
      [],
    ]);
    const res = await request(app)
      .patch("/api/service-tickets/st-001")
      .set("Authorization", "Bearer valid-token")
      .send({ description: "Trying to edit locked ticket" });
    expect(res.status).toBe(403);
    expect(res.body.error).toContain("locked");
  });

  it("allows editing a closed ticket that is NOT locked", async () => {
    const existing = makeTicket({ status: "Closed", locked_at: null });
    const updated = makeTicket({
      status: "Closed",
      description: "Updated description",
    });
    mockQuery.mockResolvedValueOnce([[existing], []]);
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    mockQuery.mockResolvedValueOnce([[updated], []]);
    const res = await request(app)
      .patch("/api/service-tickets/st-001")
      .set("Authorization", "Bearer valid-token")
      .send({ description: "Updated description" });
    expect(res.status).toBe(200);
  });

  it("allows editing a locked ticket that is NOT closed", async () => {
    const existing = makeTicket({
      status: "Open",
      locked_at: "2026-03-15T12:00:00Z",
    });
    const updated = makeTicket({ status: "In Progress" });
    mockQuery.mockResolvedValueOnce([[existing], []]);
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    mockQuery.mockResolvedValueOnce([[updated], []]);
    const res = await request(app)
      .patch("/api/service-tickets/st-001")
      .set("Authorization", "Bearer valid-token")
      .send({ status: "In Progress" });
    expect(res.status).toBe(200);
  });

  it("returns 500 on database error during update", async () => {
    const existing = makeTicket();
    mockQuery.mockResolvedValueOnce([[existing], []]);
    mockQuery.mockRejectedValueOnce(new Error("DB update failed"));
    const res = await request(app)
      .patch("/api/service-tickets/st-001")
      .set("Authorization", "Bearer valid-token")
      .send({ vendor: "New Vendor" });
    expect(res.status).toBe(500);
  });
});
