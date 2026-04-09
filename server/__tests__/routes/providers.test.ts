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
import providersRouter from "../../routes/providers";
import { errorHandler } from "../../middleware/errorHandler";
import { DEFAULT_SQL_PRINCIPAL } from "../helpers/mock-sql-auth";

mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(DEFAULT_SQL_PRINCIPAL);

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(providersRouter);
  app.use(errorHandler);
  return app;
}

// ── GET /api/providers — auth enforcement ───────────────────────────────────

describe("GET /api/providers — auth enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
  });

  it("returns 401 when no auth token is provided", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/providers");
    expect(res.status).toBe(401);
  });

  it("returns 401 when user has no linked SQL account", async () => {
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(null);
    const app = buildApp();
    const res = await request(app)
      .get("/api/providers")
      .set("Authorization", "Bearer valid-token");
    expect(res.status).toBe(401);
  });
});

// ── GET /api/providers — success path ───────────────────────────────────────

describe("GET /api/providers — success", () => {
  let app: ReturnType<typeof buildApp>;
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
    app = buildApp();
  });

  it("returns providers list with 200", async () => {
    const providers = [
      {
        id: "pv-001",
        company_id: "company-aaa",
        name: "Roadside Rescue",
        type: "Towing",
        status: "Active",
      },
      {
        id: "pv-002",
        company_id: "company-aaa",
        name: "Tire Express",
        type: "Tire",
        status: "Active",
      },
    ];
    mockQuery.mockResolvedValueOnce([providers, []]);
    const res = await request(app)
      .get("/api/providers")
      .set("Authorization", "Bearer valid-token");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);

    // Verify SQL query includes tenant isolation
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("company_id"),
      expect.arrayContaining(["company-aaa"]),
    );
  });

  it("returns empty array when no providers exist", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);
    const res = await request(app)
      .get("/api/providers")
      .set("Authorization", "Bearer valid-token");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("supports pagination via page and limit query params", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);
    const res = await request(app)
      .get("/api/providers?page=3&limit=10")
      .set("Authorization", "Bearer valid-token");
    expect(res.status).toBe(200);
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("LIMIT"), [
      "company-aaa",
      10,
      20,
    ]);
  });

  it("defaults to page=1, limit=50 when not provided", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);
    await request(app)
      .get("/api/providers")
      .set("Authorization", "Bearer valid-token");
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("LIMIT"), [
      "company-aaa",
      50,
      0,
    ]);
  });

  it("returns 500 on database error", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB connection error"));
    const res = await request(app)
      .get("/api/providers")
      .set("Authorization", "Bearer valid-token");
    expect(res.status).toBe(500);
    expect(res.body.message).toBeDefined();
  });
});

// ── POST /api/providers — creation ──────────────────────────────────────────

describe("POST /api/providers — creation", () => {
  let app: ReturnType<typeof buildApp>;
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
    app = buildApp();
  });

  it("returns 201 with valid data", async () => {
    const createdProvider = {
      id: "pv-new",
      company_id: "company-aaa",
      name: "New Provider",
      type: "Mechanic",
      status: "Active",
    };
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    mockQuery.mockResolvedValueOnce([[createdProvider], []]);
    const res = await request(app)
      .post("/api/providers")
      .set("Authorization", "Bearer valid-token")
      .send({ name: "New Provider", type: "Mechanic", status: "Active" });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe("pv-new");
    expect(res.body.name).toBe("New Provider");

    // Verify INSERT received tenant ID and field values
    const insertCall = mockQuery.mock.calls[0];
    expect(insertCall[0]).toMatch(/INSERT/i);
    expect(insertCall[1]).toEqual(
      expect.arrayContaining(["company-aaa", "New Provider"]),
    );
  });

  it("returns 201 with all optional fields including JSON data", async () => {
    const createdProvider = {
      id: "pv-full",
      company_id: "company-aaa",
      name: "Full Provider",
      type: "Towing",
      status: "Active",
      phone: "555-0600",
      email: "provider@example.com",
      coverage: '["TX","OK","AR"]',
      capabilities: '["heavy-duty","flatbed"]',
      contacts: '[{"name":"Jim","phone":"555-0601"}]',
      after_hours_contacts: '[{"name":"Bob","phone":"555-0602"}]',
      is_247: true,
      notes: "Great provider",
    };
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    mockQuery.mockResolvedValueOnce([[createdProvider], []]);
    const res = await request(app)
      .post("/api/providers")
      .set("Authorization", "Bearer valid-token")
      .send({
        name: "Full Provider",
        type: "Towing",
        status: "Active",
        phone: "555-0600",
        email: "provider@example.com",
        coverage: ["TX", "OK", "AR"],
        capabilities: ["heavy-duty", "flatbed"],
        contacts: [{ name: "Jim", phone: "555-0601" }],
        after_hours_contacts: [{ name: "Bob", phone: "555-0602" }],
        is_247: true,
        notes: "Great provider",
      });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Full Provider");
    expect(res.body.is_247).toBe(true);
  });

  it("returns 400 when required field 'name' is missing", async () => {
    const res = await request(app)
      .post("/api/providers")
      .set("Authorization", "Bearer valid-token")
      .send({ type: "Mechanic" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when name is empty string", async () => {
    const res = await request(app)
      .post("/api/providers")
      .set("Authorization", "Bearer valid-token")
      .send({ name: "" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when email is invalid", async () => {
    const res = await request(app)
      .post("/api/providers")
      .set("Authorization", "Bearer valid-token")
      .send({ name: "Test Provider", email: "not-an-email" });
    expect(res.status).toBe(400);
  });

  it("accepts empty string email", async () => {
    const createdProvider = {
      id: "pv-empty-email",
      company_id: "company-aaa",
      name: "No Email Provider",
      email: "",
    };
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    mockQuery.mockResolvedValueOnce([[createdProvider], []]);
    const res = await request(app)
      .post("/api/providers")
      .set("Authorization", "Bearer valid-token")
      .send({ name: "No Email Provider", email: "" });
    expect(res.status).toBe(201);
  });

  it("returns 500 on database error during creation", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB insert failed"));
    const res = await request(app)
      .post("/api/providers")
      .set("Authorization", "Bearer valid-token")
      .send({ name: "Test Provider" });
    expect(res.status).toBe(500);
    expect(res.body.message).toBeDefined();
  });

  it("returns 401 when not authenticated", async () => {
    const app2 = buildApp();
    const res = await request(app2)
      .post("/api/providers")
      .send({ name: "Test Provider" });
    expect(res.status).toBe(401);
  });
});

// ── PATCH /api/providers/:id — update ───────────────────────────────────────

describe("PATCH /api/providers/:id — update", () => {
  let app: ReturnType<typeof buildApp>;
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
    app = buildApp();
  });

  it("returns 200 for same-tenant update", async () => {
    const existingProvider = {
      id: "pv-001",
      company_id: "company-aaa",
      name: "Old Name",
      status: "Active",
    };
    const updatedProvider = {
      id: "pv-001",
      company_id: "company-aaa",
      name: "New Name",
      status: "Active",
    };
    mockQuery.mockResolvedValueOnce([[existingProvider], []]);
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    mockQuery.mockResolvedValueOnce([[updatedProvider], []]);
    const res = await request(app)
      .patch("/api/providers/pv-001")
      .set("Authorization", "Bearer valid-token")
      .send({ name: "New Name" });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("New Name");
  });

  it("returns 404 for cross-tenant update attempt (conceals existence)", async () => {
    mockQuery.mockResolvedValueOnce([
      [{ id: "pv-001", company_id: "company-zzz", name: "Other" }],
      [],
    ]);
    const res = await request(app)
      .patch("/api/providers/pv-001")
      .set("Authorization", "Bearer valid-token")
      .send({ name: "Attempt" });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Provider not found");
  });

  it("returns 404 when provider does not exist", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);
    const res = await request(app)
      .patch("/api/providers/nonexistent")
      .set("Authorization", "Bearer valid-token")
      .send({ name: "No Provider" });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Provider not found");
  });

  it("returns 200 when updating is_247 boolean field", async () => {
    const existingProvider = {
      id: "pv-001",
      company_id: "company-aaa",
      name: "Provider",
      is_247: false,
    };
    const updatedProvider = {
      id: "pv-001",
      company_id: "company-aaa",
      name: "Provider",
      is_247: true,
    };
    mockQuery.mockResolvedValueOnce([[existingProvider], []]);
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    mockQuery.mockResolvedValueOnce([[updatedProvider], []]);
    const res = await request(app)
      .patch("/api/providers/pv-001")
      .set("Authorization", "Bearer valid-token")
      .send({ is_247: true });
    expect(res.status).toBe(200);
    expect(res.body.is_247).toBe(true);
  });

  it("returns 200 when updating JSON fields (coverage, capabilities)", async () => {
    const existingProvider = {
      id: "pv-001",
      company_id: "company-aaa",
      name: "Provider",
      coverage: "[]",
    };
    const updatedProvider = {
      id: "pv-001",
      company_id: "company-aaa",
      name: "Provider",
      coverage: '["TX","OK"]',
      capabilities: '["heavy-duty"]',
    };
    mockQuery.mockResolvedValueOnce([[existingProvider], []]);
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    mockQuery.mockResolvedValueOnce([[updatedProvider], []]);
    const res = await request(app)
      .patch("/api/providers/pv-001")
      .set("Authorization", "Bearer valid-token")
      .send({ coverage: ["TX", "OK"], capabilities: ["heavy-duty"] });
    expect(res.status).toBe(200);
    // Verify response body contains updated JSON fields
    expect(res.body.coverage).toBe('["TX","OK"]');
    expect(res.body.capabilities).toBe('["heavy-duty"]');

    // Verify UPDATE query was issued
    const updateCall = mockQuery.mock.calls[1];
    expect(updateCall[0]).toMatch(/UPDATE/i);
  });

  it("returns 500 on database error during update", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB error"));
    const res = await request(app)
      .patch("/api/providers/pv-001")
      .set("Authorization", "Bearer valid-token")
      .send({ name: "Updated" });
    expect(res.status).toBe(500);
  });
});

// ── PATCH /api/providers/:id/archive — soft-delete ──────────────────────────

describe("PATCH /api/providers/:id/archive — soft-delete", () => {
  let app: ReturnType<typeof buildApp>;
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
    app = buildApp();
  });

  it("returns 200 for same-tenant archive", async () => {
    const existingProvider = {
      id: "pv-001",
      company_id: "company-aaa",
      name: "Roadside Rescue",
    };
    mockQuery.mockResolvedValueOnce([[existingProvider], []]);
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    const res = await request(app)
      .patch("/api/providers/pv-001/archive")
      .set("Authorization", "Bearer valid-token");
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Provider archived");
  });

  it("returns 404 for cross-tenant archive attempt (conceals existence)", async () => {
    mockQuery.mockResolvedValueOnce([
      [{ id: "pv-001", company_id: "company-zzz", name: "Other" }],
      [],
    ]);
    const res = await request(app)
      .patch("/api/providers/pv-001/archive")
      .set("Authorization", "Bearer valid-token");
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Provider not found");
  });

  it("returns 404 when provider does not exist", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);
    const res = await request(app)
      .patch("/api/providers/nonexistent/archive")
      .set("Authorization", "Bearer valid-token");
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Provider not found");
  });

  it("returns 500 on database error during archive", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB error"));
    const res = await request(app)
      .patch("/api/providers/pv-001/archive")
      .set("Authorization", "Bearer valid-token");
    expect(res.status).toBe(500);
    expect(res.body.message).toBeDefined();
  });
});

// ── DELETE /api/providers — no endpoint ─────────────────────────────────────

describe("DELETE /api/providers/:id — no endpoint exists", () => {
  let app: ReturnType<typeof buildApp>;
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
    app = buildApp();
  });

  it("returns 404 — DELETE endpoint does not exist", async () => {
    const res = await request(app)
      .delete("/api/providers/pv-001")
      .set("Authorization", "Bearer valid-token");
    expect(res.status).toBe(404);
  });
});

// ── Tenant isolation — cross-tenant operations ──────────────────────────────

describe("Providers — tenant isolation across operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("tenant B cannot list tenant A providers", async () => {
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue({
      ...DEFAULT_SQL_PRINCIPAL,
      tenantId: "company-bbb",
      companyId: "company-bbb",
    });
    const app = buildApp();
    mockQuery.mockResolvedValueOnce([[], []]);
    const res = await request(app)
      .get("/api/providers")
      .set("Authorization", "Bearer valid-token");
    expect(res.status).toBe(200);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("company_id"),
      expect.arrayContaining(["company-bbb"]),
    );
  });

  it("tenant B cannot update tenant A provider", async () => {
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue({
      ...DEFAULT_SQL_PRINCIPAL,
      tenantId: "company-bbb",
      companyId: "company-bbb",
    });
    const app = buildApp();
    mockQuery.mockResolvedValueOnce([
      [{ id: "pv-001", company_id: "company-aaa", name: "Provider" }],
      [],
    ]);
    const res = await request(app)
      .patch("/api/providers/pv-001")
      .set("Authorization", "Bearer valid-token")
      .send({ name: "Hacked" });
    expect(res.status).toBe(404);
  });

  it("tenant B cannot archive tenant A provider", async () => {
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue({
      ...DEFAULT_SQL_PRINCIPAL,
      tenantId: "company-bbb",
      companyId: "company-bbb",
    });
    const app = buildApp();
    mockQuery.mockResolvedValueOnce([
      [{ id: "pv-001", company_id: "company-aaa", name: "Provider" }],
      [],
    ]);
    const res = await request(app)
      .patch("/api/providers/pv-001/archive")
      .set("Authorization", "Bearer valid-token");
    expect(res.status).toBe(404);
  });
});
