import { describe, it, expect, vi, beforeEach } from "vitest";

// Tests R-FS-05-01, R-FS-05-07, R-S27-01, R-S27-02, R-S27-03, R-S27-04

// Hoisted mocks
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

vi.mock("../../helpers", () => ({
  redactData: vi.fn((data: any) => data),
  getVisibilitySettings: vi.fn().mockResolvedValue({}),
}));

// Mock Firestore used by clients.ts (companies endpoint + firestore.ts init)
vi.mock("../../firestore", () => ({
  default: {
    collection: vi.fn().mockReturnValue({
      doc: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({ id: "company-aaa" }),
        }),
        set: vi.fn().mockResolvedValue(undefined),
      }),
      where: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({ docs: [] }),
        limit: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
        }),
      }),
    }),
  },
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
import clientsRouter from "../../routes/clients";
import { errorHandler } from "../../middleware/errorHandler";
import { DEFAULT_SQL_PRINCIPAL } from "../helpers/mock-sql-auth";

mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(DEFAULT_SQL_PRINCIPAL);

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(clientsRouter);
  app.use(errorHandler);
  return app;
}

const COMPANY_ID = "company-aaa";
const AUTH_HEADER = "Bearer valid-token";

// ── Auth enforcement ──────────────────────────────────────────────────────────

describe("GET /api/clients/:companyId — auth enforcement", () => {
  beforeEach(() => {
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
    vi.clearAllMocks();
  });

  it("returns 401 when no Authorization header is sent", async () => {
    const app = buildApp();
    const res = await request(app).get(`/api/clients/${COMPANY_ID}`);
    expect(res.status).toBe(401);
  });
});

// ── Tenant enforcement ────────────────────────────────────────────────────────

describe("GET /api/clients/:companyId — tenant enforcement", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
    app = buildApp();
    vi.clearAllMocks();
  });

  it("returns 403 when companyId param does not match user tenant", async () => {
    const res = await request(app)
      .get("/api/clients/company-zzz")
      .set("Authorization", AUTH_HEADER);

    // requireTenant returns 403 for mismatched :companyId
    expect(res.status).toBe(403);
  });

  it("returns 403 when user tenantId mismatches requested companyId (requireTenant enforcement)", async () => {
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue({
      ...DEFAULT_SQL_PRINCIPAL,
      tenantId: "company-zzz",
      companyId: "company-zzz",
    });
    app = buildApp();

    const res = await request(app)
      .get(`/api/clients/${COMPANY_ID}`)
      .set("Authorization", AUTH_HEADER);

    // requireTenant sees tenantId = company-zzz != company-aaa -> 403
    expect(res.status).toBe(403);
  });
});

// ── Success path ──────────────────────────────────────────────────────────────

describe("GET /api/clients/:companyId — success", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
    app = buildApp();
    vi.clearAllMocks();
  });

  it("returns client list with 200", async () => {
    const clients = [
      {
        id: "c-001",
        name: "ACME Freight",
        type: "Broker",
        company_id: COMPANY_ID,
      },
    ];
    mockQuery.mockResolvedValueOnce([clients, []]);

    const res = await request(app)
      .get(`/api/clients/${COMPANY_ID}`)
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);
  });

  it("returns 500 on database error", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB error"));

    const res = await request(app)
      .get(`/api/clients/${COMPANY_ID}`)
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(500);
  });
});

// ── POST auth enforcement ─────────────────────────────────────────────────────

describe("POST /api/clients — auth enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when no Authorization header is sent", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/clients")
      .send({ name: "ACME Freight", company_id: COMPANY_ID });
    expect(res.status).toBe(401);
  });
});

// ── POST tenant enforcement ───────────────────────────────────────────────────

describe("POST /api/clients — tenant enforcement", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
    app = buildApp();
    vi.clearAllMocks();
  });

  it("returns 403 when company_id in body does not match user tenant", async () => {
    const res = await request(app)
      .post("/api/clients")
      .set("Authorization", AUTH_HEADER)
      .send({ name: "ACME Freight", company_id: "company-zzz" });

    expect(res.status).toBe(403);
  });
});

// ── POST success path ─────────────────────────────────────────────────────────

describe("POST /api/clients — success", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
    app = buildApp();
    vi.clearAllMocks();
  });

  it("creates client and returns 201", async () => {
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

    const res = await request(app)
      .post("/api/clients")
      .set("Authorization", AUTH_HEADER)
      .send({
        id: "c-new",
        name: "ACME Freight",
        type: "Broker",
        company_id: COMPANY_ID,
      });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe("Client saved");
  });

  it("returns 500 on database error", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB insert failed"));

    const res = await request(app)
      .post("/api/clients")
      .set("Authorization", AUTH_HEADER)
      .send({ name: "ACME Freight", company_id: COMPANY_ID });

    expect(res.status).toBe(500);
  });
});

// ── STORY-027: GET with include_archived ─────────────────────────────────────

describe("GET /api/clients/:companyId — archived filtering (R-S27-02)", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
    app = buildApp();
    vi.clearAllMocks();
  });

  it("excludes archived customers from default response (no include_archived param)", async () => {
    const activeClients = [
      { id: "c-001", name: "Active Corp", archived_at: null },
    ];
    mockQuery.mockResolvedValueOnce([activeClients, []]);

    const res = await request(app)
      .get(`/api/clients/${COMPANY_ID}`)
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(200);
    const sqlCall = mockQuery.mock.calls[0][0] as string;
    expect(sqlCall).toContain("archived_at IS NULL");
  });

  it("includes archived customers when include_archived=true", async () => {
    const allClients = [
      { id: "c-001", name: "Active Corp", archived_at: null },
      { id: "c-002", name: "Old Corp", archived_at: "2024-01-01T00:00:00Z" },
    ];
    mockQuery.mockResolvedValueOnce([allClients, []]);

    const res = await request(app)
      .get(`/api/clients/${COMPANY_ID}?include_archived=true`)
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(200);
    const sqlCall = mockQuery.mock.calls[0][0] as string;
    expect(sqlCall).not.toContain("archived_at IS NULL");
  });
});

// ── STORY-027: PATCH /api/clients/:id/archive ─────────────────────────────────

describe("PATCH /api/clients/:id/archive — archive endpoint (R-S27-01)", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
    app = buildApp();
    vi.clearAllMocks();
  });

  it("sets archived_at timestamp on customer record and returns 200", async () => {
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

    const res = await request(app)
      .patch("/api/clients/c-001/archive")
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Client archived");

    const sqlCall = mockQuery.mock.calls[0][0] as string;
    expect(sqlCall).toContain("archived_at = NOW()");
    expect(sqlCall).toContain("archived_by");
  });

  it("returns 404 when client does not exist in tenant", async () => {
    mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

    const res = await request(app)
      .patch("/api/clients/nonexistent/archive")
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(404);
  });

  it("returns 500 on database error", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB error"));

    const res = await request(app)
      .patch("/api/clients/c-001/archive")
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(500);
  });
});

// ── STORY-027: PATCH /api/clients/:id/unarchive ───────────────────────────────

describe("PATCH /api/clients/:id/unarchive — unarchive endpoint (R-S27-03)", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
    app = buildApp();
    vi.clearAllMocks();
  });

  it("clears archived_at and returns 200", async () => {
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

    const res = await request(app)
      .patch("/api/clients/c-001/unarchive")
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Client unarchived");

    const sqlCall = mockQuery.mock.calls[0][0] as string;
    expect(sqlCall).toContain("archived_at = NULL");
    expect(sqlCall).toContain("archived_by = NULL");
  });

  it("returns 404 when client does not exist in tenant", async () => {
    mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

    const res = await request(app)
      .patch("/api/clients/nonexistent/unarchive")
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(404);
  });

  it("returns 500 on database error", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB error"));

    const res = await request(app)
      .patch("/api/clients/c-001/unarchive")
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(500);
  });
});

// ── STORY-027: Role-based access control (R-S27-04) ──────────────────────────

describe("PATCH /api/clients/:id/archive — role enforcement (R-S27-04)", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
    app = buildApp();
    vi.clearAllMocks();
  });

  it("allows admin to archive a client", async () => {
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue({
      ...DEFAULT_SQL_PRINCIPAL,
      role: "admin",
    });
    app = buildApp();
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

    const res = await request(app)
      .patch("/api/clients/c-001/archive")
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(200);
  });

  it("allows dispatcher to archive a client", async () => {
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue({
      ...DEFAULT_SQL_PRINCIPAL,
      role: "dispatcher",
    });
    app = buildApp();
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

    const res = await request(app)
      .patch("/api/clients/c-001/archive")
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(200);
  });

  it("returns 403 for driver role attempting to archive", async () => {
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue({
      ...DEFAULT_SQL_PRINCIPAL,
      role: "driver",
    });
    app = buildApp();

    const res = await request(app)
      .patch("/api/clients/c-001/archive")
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(403);
    expect(res.body.error).toContain("Forbidden");
  });

  it("returns 403 for customer role attempting to archive", async () => {
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue({
      ...DEFAULT_SQL_PRINCIPAL,
      role: "customer",
    });
    app = buildApp();

    const res = await request(app)
      .patch("/api/clients/c-001/archive")
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(403);
  });

  it("returns 403 for driver role attempting to unarchive", async () => {
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue({
      ...DEFAULT_SQL_PRINCIPAL,
      role: "driver",
    });
    app = buildApp();

    const res = await request(app)
      .patch("/api/clients/c-001/unarchive")
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(403);
  });

  it("verifies tenant isolation — update query uses tenant company_id", async () => {
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue({
      ...DEFAULT_SQL_PRINCIPAL,
      role: "admin",
    });
    app = buildApp();
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

    await request(app)
      .patch("/api/clients/c-001/archive")
      .set("Authorization", AUTH_HEADER);

    // company_id is always drawn from req.user.tenantId, not URL/body
    const params = mockQuery.mock.calls[0][1] as any[];
    // params: [archived_by (uid), id, tenantId]
    expect(params[2]).toBe("company-aaa");
  });
});

// ── STORY-006: Server-side company_id enforcement
describe("POST /api/clients — company_id enforcement (STORY-006)", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
    app = buildApp();
    vi.clearAllMocks();
  });

  it("succeeds when body has no company_id (server injects from auth)", async () => {
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

    const res = await request(app)
      .post("/api/clients")
      .set("Authorization", AUTH_HEADER)
      .send({ name: "No CompanyId Client" });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe("Client saved");
    const insertCall = mockQuery.mock.calls[0];
    const params = insertCall[1];
    // company_id is the 10th parameter (index 9)
    expect(params[9]).toBe("company-aaa");
  });

  it("succeeds when body company_id matches auth tenant (stripped/ignored)", async () => {
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

    const res = await request(app)
      .post("/api/clients")
      .set("Authorization", AUTH_HEADER)
      .send({ name: "Matching Client", company_id: "company-aaa" });

    expect(res.status).toBe(201);
  });

  it("returns 400 when name is missing (Zod validation)", async () => {
    const res = await request(app)
      .post("/api/clients")
      .set("Authorization", AUTH_HEADER)
      .send({ type: "Broker" });

    expect(res.status).toBe(400);
  });
});

// ── GET /api/clients (tenant-scoped, no companyId param) ─────────────────────

describe("GET /api/clients — tenant-scoped list (COM-03)", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
    app = buildApp();
    vi.clearAllMocks();
  });

  it("returns 401 when no auth header is sent", async () => {
    const res = await request(app).get("/api/clients");
    expect(res.status).toBe(401);
  });

  it("returns client list scoped to tenant from auth context", async () => {
    const mockClients = [
      { id: "c1", name: "Shipper A", company_id: COMPANY_ID },
      { id: "c2", name: "Broker B", company_id: COMPANY_ID },
    ];
    mockQuery.mockResolvedValueOnce([mockClients]);

    const res = await request(app)
      .get("/api/clients")
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].name).toBe("Shipper A");
    // Verify query uses tenantId from auth, not URL param
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("WHERE company_id = ?"),
      [COMPANY_ID],
    );
  });

  it("returns 500 on database error", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB down"));

    const res = await request(app)
      .get("/api/clients")
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(500);
  });
});

// ── PATCH /api/clients/:id — general update (COM-03/COM-04) ─────────────────

describe("PATCH /api/clients/:id — update client (COM-03)", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
    app = buildApp();
    vi.clearAllMocks();
  });

  it("returns 401 when no auth header is sent", async () => {
    const res = await request(app).patch("/api/clients/c1");
    expect(res.status).toBe(401);
  });

  it("updates client status and returns 200", async () => {
    // First query: verify client exists
    mockQuery.mockResolvedValueOnce([[{ id: "c1" }]]);
    // Second query: update
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }]);

    const res = await request(app)
      .patch("/api/clients/c1")
      .set("Authorization", AUTH_HEADER)
      .send({ status: "inactive" });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Client updated");
    // Verify tenant isolation in update query
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE customers SET status = ?"),
      ["inactive", "c1", COMPANY_ID],
    );
  });

  it("returns 404 when client does not belong to tenant", async () => {
    mockQuery.mockResolvedValueOnce([[]]);

    const res = await request(app)
      .patch("/api/clients/c999")
      .set("Authorization", AUTH_HEADER)
      .send({ status: "active" });

    expect(res.status).toBe(404);
  });

  it("returns 400 when no valid fields are provided", async () => {
    mockQuery.mockResolvedValueOnce([[{ id: "c1" }]]);

    const res = await request(app)
      .patch("/api/clients/c1")
      .set("Authorization", AUTH_HEADER)
      .send({ nonexistent_field: "value" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("No valid fields to update");
  });

  it("returns 500 on database error", async () => {
    mockQuery.mockRejectedValueOnce(new Error("Connection lost"));

    const res = await request(app)
      .patch("/api/clients/c1")
      .set("Authorization", AUTH_HEADER)
      .send({ status: "active" });

    expect(res.status).toBe(500);
  });
});
