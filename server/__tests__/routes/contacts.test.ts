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

// Mock firebase-admin for requireAuth
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
import contactsRouter from "../../routes/contacts";
import { errorHandler } from "../../middleware/errorHandler";
import { DEFAULT_SQL_PRINCIPAL } from "../helpers/mock-sql-auth";

mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(DEFAULT_SQL_PRINCIPAL);

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(contactsRouter);
  app.use(errorHandler);
  return app;
}

// ── GET /api/contacts — auth enforcement ────────────────────────────────────

describe("GET /api/contacts — auth enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
  });

  it("returns 401 when no auth token is provided", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/contacts");
    expect(res.status).toBe(401);
  });

  it("returns 401 when user has no linked SQL account", async () => {
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(null);
    const app = buildApp();
    const res = await request(app)
      .get("/api/contacts")
      .set("Authorization", "Bearer valid-token");
    expect(res.status).toBe(401);
  });
});

// ── GET /api/contacts — success path ────────────────────────────────────────

describe("GET /api/contacts — success", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
    app = buildApp();
  });

  it("returns contacts list with 200", async () => {
    const contacts = [
      {
        id: "ct-001",
        company_id: "company-aaa",
        name: "John Doe",
        email: "john@example.com",
        phone: "555-0100",
      },
      {
        id: "ct-002",
        company_id: "company-aaa",
        name: "Jane Smith",
        email: "jane@example.com",
        phone: "555-0200",
      },
    ];
    mockQuery.mockResolvedValueOnce([contacts, []]);

    const res = await request(app)
      .get("/api/contacts")
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

  it("returns empty array when no contacts exist", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);

    const res = await request(app)
      .get("/api/contacts")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("supports pagination via page and limit query params", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);

    const res = await request(app)
      .get("/api/contacts?page=3&limit=25")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("LIMIT"), [
      "company-aaa",
      25,
      50,
    ]);
  });

  it("defaults to page=1, limit=50 when not provided", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);

    await request(app)
      .get("/api/contacts")
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
      .get("/api/contacts")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(500);
    expect(res.body.message).toBeDefined();
  });
});

// ── POST /api/contacts — creation ───────────────────────────────────────────

describe("POST /api/contacts — creation", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
    app = buildApp();
  });

  it("returns 201 with valid data", async () => {
    const createdContact = {
      id: "ct-new",
      company_id: "company-aaa",
      name: "New Contact",
      email: "new@example.com",
      phone: "555-0300",
    };
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    mockQuery.mockResolvedValueOnce([[createdContact], []]);

    const res = await request(app)
      .post("/api/contacts")
      .set("Authorization", "Bearer valid-token")
      .send({
        name: "New Contact",
        email: "new@example.com",
        phone: "555-0300",
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe("ct-new");
    expect(res.body.name).toBe("New Contact");

    // Verify INSERT received tenant ID and field values
    const insertCall = mockQuery.mock.calls[0];
    expect(insertCall[0]).toMatch(/INSERT/i);
    expect(insertCall[1]).toEqual(
      expect.arrayContaining(["company-aaa", "New Contact"]),
    );
  });

  it("returns 201 with all optional fields", async () => {
    const createdContact = {
      id: "ct-full",
      company_id: "company-aaa",
      name: "Full Contact",
      email: "full@example.com",
      phone: "555-0400",
      title: "Fleet Manager",
      type: "Broker",
      organization: "ABC Trucking",
      preferred_channel: "email",
      normalized_phone: "+15550400",
      notes: "Important contact",
    };
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    mockQuery.mockResolvedValueOnce([[createdContact], []]);

    const res = await request(app)
      .post("/api/contacts")
      .set("Authorization", "Bearer valid-token")
      .send({
        name: "Full Contact",
        email: "full@example.com",
        phone: "555-0400",
        title: "Fleet Manager",
        type: "Broker",
        organization: "ABC Trucking",
        preferred_channel: "email",
        normalized_phone: "+15550400",
        notes: "Important contact",
      });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe("Fleet Manager");
    expect(res.body.organization).toBe("ABC Trucking");
  });

  it("returns 400 when required field 'name' is missing", async () => {
    const res = await request(app)
      .post("/api/contacts")
      .set("Authorization", "Bearer valid-token")
      .send({ email: "no-name@example.com" });

    expect(res.status).toBe(400);
  });

  it("returns 400 when name is empty string", async () => {
    const res = await request(app)
      .post("/api/contacts")
      .set("Authorization", "Bearer valid-token")
      .send({ name: "" });

    expect(res.status).toBe(400);
  });

  it("returns 400 when email is invalid", async () => {
    const res = await request(app)
      .post("/api/contacts")
      .set("Authorization", "Bearer valid-token")
      .send({ name: "Test", email: "not-an-email" });

    expect(res.status).toBe(400);
  });

  it("accepts empty string email", async () => {
    const createdContact = {
      id: "ct-empty-email",
      company_id: "company-aaa",
      name: "No Email",
      email: "",
    };
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    mockQuery.mockResolvedValueOnce([[createdContact], []]);

    const res = await request(app)
      .post("/api/contacts")
      .set("Authorization", "Bearer valid-token")
      .send({ name: "No Email", email: "" });

    expect(res.status).toBe(201);
  });

  it("returns 500 on database error during creation", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB insert failed"));

    const res = await request(app)
      .post("/api/contacts")
      .set("Authorization", "Bearer valid-token")
      .send({ name: "Test Contact" });

    expect(res.status).toBe(500);
    expect(res.body.message).toBeDefined();
  });

  it("returns 401 when not authenticated", async () => {
    const app2 = buildApp();

    const res = await request(app2)
      .post("/api/contacts")
      .send({ name: "Test Contact" });

    expect(res.status).toBe(401);
  });
});

// ── PATCH /api/contacts/:id — update ────────────────────────────────────────

describe("PATCH /api/contacts/:id — update", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
    app = buildApp();
  });

  it("returns 200 for same-tenant update", async () => {
    const existingContact = {
      id: "ct-001",
      company_id: "company-aaa",
      name: "Old Name",
    };
    const updatedContact = {
      id: "ct-001",
      company_id: "company-aaa",
      name: "New Name",
    };
    mockQuery.mockResolvedValueOnce([[existingContact], []]);
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    mockQuery.mockResolvedValueOnce([[updatedContact], []]);

    const res = await request(app)
      .patch("/api/contacts/ct-001")
      .set("Authorization", "Bearer valid-token")
      .send({ name: "New Name" });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("New Name");

    // Verify UPDATE query received correct parameters
    const updateCall = mockQuery.mock.calls[1];
    expect(updateCall[0]).toMatch(/UPDATE/i);
  });

  it("returns 404 for cross-tenant update attempt (conceals existence)", async () => {
    mockQuery.mockResolvedValueOnce([
      [{ id: "ct-001", company_id: "company-zzz", name: "Other" }],
      [],
    ]);

    const res = await request(app)
      .patch("/api/contacts/ct-001")
      .set("Authorization", "Bearer valid-token")
      .send({ name: "Attempt" });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Contact not found");
  });

  it("returns 404 when contact does not exist", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);

    const res = await request(app)
      .patch("/api/contacts/nonexistent")
      .set("Authorization", "Bearer valid-token")
      .send({ name: "No Contact" });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Contact not found");
  });

  it("returns 500 on database error during update", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB error"));

    const res = await request(app)
      .patch("/api/contacts/ct-001")
      .set("Authorization", "Bearer valid-token")
      .send({ name: "Updated" });

    expect(res.status).toBe(500);
  });
});

// ── PATCH /api/contacts/:id/archive — soft-delete ───────────────────────────

describe("PATCH /api/contacts/:id/archive — soft-delete", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
    app = buildApp();
  });

  it("returns 200 for same-tenant archive", async () => {
    const existingContact = {
      id: "ct-001",
      company_id: "company-aaa",
      name: "John Doe",
    };
    mockQuery.mockResolvedValueOnce([[existingContact], []]);
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

    const res = await request(app)
      .patch("/api/contacts/ct-001/archive")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Contact archived");
  });

  it("returns 404 for cross-tenant archive attempt (conceals existence)", async () => {
    mockQuery.mockResolvedValueOnce([
      [{ id: "ct-001", company_id: "company-zzz", name: "Other" }],
      [],
    ]);

    const res = await request(app)
      .patch("/api/contacts/ct-001/archive")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Contact not found");
  });

  it("returns 404 when contact does not exist", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);

    const res = await request(app)
      .patch("/api/contacts/nonexistent/archive")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Contact not found");
  });

  it("returns 500 on database error during archive", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB error"));

    const res = await request(app)
      .patch("/api/contacts/ct-001/archive")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(500);
    expect(res.body.message).toBeDefined();
  });
});

// ── Tenant isolation — cross-tenant operations ──────────────────────────────

describe("Contacts — tenant isolation across operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("tenant B cannot list tenant A contacts", async () => {
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue({
      ...DEFAULT_SQL_PRINCIPAL,
      tenantId: "company-bbb",
      companyId: "company-bbb",
    });
    const app = buildApp();

    mockQuery.mockResolvedValueOnce([[], []]);

    const res = await request(app)
      .get("/api/contacts")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("company_id"),
      expect.arrayContaining(["company-bbb"]),
    );
  });

  it("tenant B cannot update tenant A contact", async () => {
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue({
      ...DEFAULT_SQL_PRINCIPAL,
      tenantId: "company-bbb",
      companyId: "company-bbb",
    });
    const app = buildApp();

    mockQuery.mockResolvedValueOnce([
      [{ id: "ct-001", company_id: "company-aaa", name: "John" }],
      [],
    ]);

    const res = await request(app)
      .patch("/api/contacts/ct-001")
      .set("Authorization", "Bearer valid-token")
      .send({ name: "Hacked" });

    expect(res.status).toBe(404);
  });

  it("tenant B cannot archive tenant A contact", async () => {
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue({
      ...DEFAULT_SQL_PRINCIPAL,
      tenantId: "company-bbb",
      companyId: "company-bbb",
    });
    const app = buildApp();

    mockQuery.mockResolvedValueOnce([
      [{ id: "ct-001", company_id: "company-aaa", name: "John" }],
      [],
    ]);

    const res = await request(app)
      .patch("/api/contacts/ct-001/archive")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(404);
  });
});
