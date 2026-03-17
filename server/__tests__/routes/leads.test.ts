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
import leadsRouter from "../../routes/leads";
import { errorHandler } from "../../middleware/errorHandler";
import { DEFAULT_SQL_PRINCIPAL } from "../helpers/mock-sql-auth";

mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(DEFAULT_SQL_PRINCIPAL);

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(leadsRouter);
  app.use(errorHandler);
  return app;
}

// ── GET /api/leads — auth enforcement ───────────────────────────────────────

describe("GET /api/leads — auth enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(DEFAULT_SQL_PRINCIPAL);
  });

  it("returns 401 when no auth token is provided", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/leads");
    expect(res.status).toBe(401);
  });

  it("returns 401 when user has no linked SQL account", async () => {
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(null);
    const app = buildApp();
    const res = await request(app)
      .get("/api/leads")
      .set("Authorization", "Bearer valid-token");
    expect(res.status).toBe(401);
  });
});

// ── GET /api/leads — success path ───────────────────────────────────────────

describe("GET /api/leads — success", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(DEFAULT_SQL_PRINCIPAL);
    app = buildApp();
  });

  it("returns leads list with 200", async () => {
    const leads = [
      { id: "ld-001", company_id: "company-aaa", status: "New", contact_name: "Alice", source: "Website" },
      { id: "ld-002", company_id: "company-aaa", status: "Contacted", contact_name: "Bob", source: "Referral" },
    ];
    mockQuery.mockResolvedValueOnce([leads, []]);

    const res = await request(app).get("/api/leads").set("Authorization", "Bearer valid-token");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
  });

  it("returns empty array when no leads exist", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);
    const res = await request(app).get("/api/leads").set("Authorization", "Bearer valid-token");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("supports pagination via page and limit query params", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);
    const res = await request(app).get("/api/leads?page=2&limit=20").set("Authorization", "Bearer valid-token");
    expect(res.status).toBe(200);
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("LIMIT"), ["company-aaa", 20, 20]);
  });

  it("defaults to page=1, limit=50 when not provided", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);
    await request(app).get("/api/leads").set("Authorization", "Bearer valid-token");
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("LIMIT"), ["company-aaa", 50, 0]);
  });

  it("returns 500 on database error", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB connection error"));
    const res = await request(app).get("/api/leads").set("Authorization", "Bearer valid-token");
    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Database error");
  });
});

// ── GET /api/leads/:id — single lead ────────────────────────────────────────

describe("GET /api/leads/:id — single lead", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(DEFAULT_SQL_PRINCIPAL);
    app = buildApp();
  });

  it("returns 200 for same-tenant lead", async () => {
    const lead = { id: "ld-001", company_id: "company-aaa", status: "New", contact_name: "Alice" };
    mockQuery.mockResolvedValueOnce([[lead], []]);
    const res = await request(app).get("/api/leads/ld-001").set("Authorization", "Bearer valid-token");
    expect(res.status).toBe(200);
    expect(res.body.id).toBe("ld-001");
    expect(res.body.company_id).toBe("company-aaa");
  });

  it("returns 404 for cross-tenant lead (conceals existence)", async () => {
    mockQuery.mockResolvedValueOnce([[{ id: "ld-001", company_id: "company-zzz", status: "New" }], []]);
    const res = await request(app).get("/api/leads/ld-001").set("Authorization", "Bearer valid-token");
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Lead not found");
  });

  it("returns 404 when lead does not exist", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);
    const res = await request(app).get("/api/leads/nonexistent").set("Authorization", "Bearer valid-token");
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Lead not found");
  });

  it("returns 500 on database error", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB error"));
    const res = await request(app).get("/api/leads/ld-001").set("Authorization", "Bearer valid-token");
    expect(res.status).toBe(500);
  });
});

// ── POST /api/leads — creation ──────────────────────────────────────────────

describe("POST /api/leads — creation", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(DEFAULT_SQL_PRINCIPAL);
    app = buildApp();
  });

  it("returns 201 with valid data", async () => {
    const createdLead = { id: "ld-new", company_id: "company-aaa", status: "New", contact_name: "New Lead", source: "Website" };
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    mockQuery.mockResolvedValueOnce([[createdLead], []]);
    const res = await request(app).post("/api/leads").set("Authorization", "Bearer valid-token").send({ contact_name: "New Lead", source: "Website" });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe("ld-new");
    expect(res.body.status).toBe("New");
  });

  it("returns 201 with minimal data (defaults status to New)", async () => {
    const createdLead = { id: "ld-min", company_id: "company-aaa", status: "New" };
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    mockQuery.mockResolvedValueOnce([[createdLead], []]);
    const res = await request(app).post("/api/leads").set("Authorization", "Bearer valid-token").send({});
    expect(res.status).toBe(201);
    expect(res.body.status).toBe("New");
  });

  it("returns 201 with all optional fields", async () => {
    const createdLead = {
      id: "ld-full", company_id: "company-aaa", status: "Qualified", source: "Trade Show",
      contact_name: "Full Lead", contact_email: "lead@example.com", contact_phone: "555-0500",
      company_name: "Big Corp", notes: "Very promising", estimated_value: 50000, lane: "CHI-DAL", equipment_needed: "Flatbed",
    };
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    mockQuery.mockResolvedValueOnce([[createdLead], []]);
    const res = await request(app).post("/api/leads").set("Authorization", "Bearer valid-token").send({
      status: "Qualified", source: "Trade Show", contact_name: "Full Lead", contact_email: "lead@example.com",
      contact_phone: "555-0500", company_name: "Big Corp", notes: "Very promising",
      estimated_value: 50000, lane: "CHI-DAL", equipment_needed: "Flatbed",
    });
    expect(res.status).toBe(201);
    expect(res.body.estimated_value).toBe(50000);
    expect(res.body.lane).toBe("CHI-DAL");
  });

  it("returns 400 with invalid status enum value", async () => {
    const res = await request(app).post("/api/leads").set("Authorization", "Bearer valid-token").send({ status: "InvalidStatus" });
    expect(res.status).toBe(400);
  });

  it("returns 400 with invalid contact_email", async () => {
    const res = await request(app).post("/api/leads").set("Authorization", "Bearer valid-token").send({ contact_email: "not-an-email" });
    expect(res.status).toBe(400);
  });

  it("accepts empty string contact_email", async () => {
    const createdLead = { id: "ld-empty-email", company_id: "company-aaa", status: "New", contact_email: "" };
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    mockQuery.mockResolvedValueOnce([[createdLead], []]);
    const res = await request(app).post("/api/leads").set("Authorization", "Bearer valid-token").send({ contact_email: "" });
    expect(res.status).toBe(201);
  });

  it("returns 500 on database error during creation", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB insert failed"));
    const res = await request(app).post("/api/leads").set("Authorization", "Bearer valid-token").send({ status: "New" });
    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Database error");
  });

  it("returns 401 when not authenticated", async () => {
    const app2 = buildApp();
    const res = await request(app2).post("/api/leads").send({ status: "New" });
    expect(res.status).toBe(401);
  });
});

// ── PATCH /api/leads/:id — update ───────────────────────────────────────────

describe("PATCH /api/leads/:id — update", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(DEFAULT_SQL_PRINCIPAL);
    app = buildApp();
  });

  it("returns 200 for same-tenant update", async () => {
    const existingLead = { id: "ld-001", company_id: "company-aaa", status: "New" };
    const updatedLead = { id: "ld-001", company_id: "company-aaa", status: "Contacted" };
    mockQuery.mockResolvedValueOnce([[existingLead], []]);
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    mockQuery.mockResolvedValueOnce([[updatedLead], []]);
    const res = await request(app).patch("/api/leads/ld-001").set("Authorization", "Bearer valid-token").send({ status: "Contacted" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("Contacted");
  });

  it("returns 404 for cross-tenant update attempt (conceals existence)", async () => {
    mockQuery.mockResolvedValueOnce([[{ id: "ld-001", company_id: "company-zzz", status: "New" }], []]);
    const res = await request(app).patch("/api/leads/ld-001").set("Authorization", "Bearer valid-token").send({ status: "Contacted" });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Lead not found");
  });

  it("returns 404 when lead does not exist", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);
    const res = await request(app).patch("/api/leads/nonexistent").set("Authorization", "Bearer valid-token").send({ status: "Contacted" });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Lead not found");
  });

  it("returns 200 when updating estimated_value", async () => {
    const existingLead = { id: "ld-001", company_id: "company-aaa", status: "New", estimated_value: 10000 };
    const updatedLead = { id: "ld-001", company_id: "company-aaa", status: "New", estimated_value: 75000 };
    mockQuery.mockResolvedValueOnce([[existingLead], []]);
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    mockQuery.mockResolvedValueOnce([[updatedLead], []]);
    const res = await request(app).patch("/api/leads/ld-001").set("Authorization", "Bearer valid-token").send({ estimated_value: 75000 });
    expect(res.status).toBe(200);
    expect(res.body.estimated_value).toBe(75000);
  });

  it("returns 500 on database error during update", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB error"));
    const res = await request(app).patch("/api/leads/ld-001").set("Authorization", "Bearer valid-token").send({ status: "Contacted" });
    expect(res.status).toBe(500);
  });
});

// ── DELETE /api/leads/:id — admin-only hard delete ──────────────────────────

describe("DELETE /api/leads/:id — admin-only hard delete", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(DEFAULT_SQL_PRINCIPAL);
    app = buildApp();
  });

  it("returns 200 when admin deletes own-tenant lead", async () => {
    const existingLead = { id: "ld-001", company_id: "company-aaa", status: "Lost" };
    mockQuery.mockResolvedValueOnce([[existingLead], []]);
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    const res = await request(app).delete("/api/leads/ld-001").set("Authorization", "Bearer valid-token");
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Lead deleted");
  });

  it("returns 403 when non-admin tries to delete (dispatcher)", async () => {
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue({ ...DEFAULT_SQL_PRINCIPAL, role: "dispatcher" });
    app = buildApp();
    const res = await request(app).delete("/api/leads/ld-001").set("Authorization", "Bearer valid-token");
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("Forbidden: admin access required");
  });

  it("returns 403 when driver tries to delete", async () => {
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue({ ...DEFAULT_SQL_PRINCIPAL, role: "driver" });
    app = buildApp();
    const res = await request(app).delete("/api/leads/ld-001").set("Authorization", "Bearer valid-token");
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("Forbidden: admin access required");
  });

  it("returns 403 when customer tries to delete", async () => {
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue({ ...DEFAULT_SQL_PRINCIPAL, role: "customer" });
    app = buildApp();
    const res = await request(app).delete("/api/leads/ld-001").set("Authorization", "Bearer valid-token");
    expect(res.status).toBe(403);
  });

  it("returns 404 for cross-tenant delete attempt (conceals existence)", async () => {
    mockQuery.mockResolvedValueOnce([[{ id: "ld-001", company_id: "company-zzz", status: "New" }], []]);
    const res = await request(app).delete("/api/leads/ld-001").set("Authorization", "Bearer valid-token");
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Lead not found");
  });

  it("returns 404 when lead does not exist", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);
    const res = await request(app).delete("/api/leads/nonexistent").set("Authorization", "Bearer valid-token");
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Lead not found");
  });

  it("returns 500 on database error during delete", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB error"));
    const res = await request(app).delete("/api/leads/ld-001").set("Authorization", "Bearer valid-token");
    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Database error");
  });
});

// ── Tenant isolation — cross-tenant operations ──────────────────────────────

describe("Leads — tenant isolation across operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("tenant B cannot list tenant A leads", async () => {
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue({ ...DEFAULT_SQL_PRINCIPAL, tenantId: "company-bbb", companyId: "company-bbb" });
    const app = buildApp();
    mockQuery.mockResolvedValueOnce([[], []]);
    const res = await request(app).get("/api/leads").set("Authorization", "Bearer valid-token");
    expect(res.status).toBe(200);
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("company_id"), expect.arrayContaining(["company-bbb"]));
  });

  it("tenant B cannot read tenant A lead by ID", async () => {
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue({ ...DEFAULT_SQL_PRINCIPAL, tenantId: "company-bbb", companyId: "company-bbb" });
    const app = buildApp();
    mockQuery.mockResolvedValueOnce([[{ id: "ld-001", company_id: "company-aaa", status: "New" }], []]);
    const res = await request(app).get("/api/leads/ld-001").set("Authorization", "Bearer valid-token");
    expect(res.status).toBe(404);
  });

  it("tenant B admin cannot delete tenant A lead", async () => {
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue({ ...DEFAULT_SQL_PRINCIPAL, tenantId: "company-bbb", companyId: "company-bbb" });
    const app = buildApp();
    mockQuery.mockResolvedValueOnce([[{ id: "ld-001", company_id: "company-aaa", status: "New" }], []]);
    const res = await request(app).delete("/api/leads/ld-001").set("Authorization", "Bearer valid-token");
    expect(res.status).toBe(404);
  });
});
