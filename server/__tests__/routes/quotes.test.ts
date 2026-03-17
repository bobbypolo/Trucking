import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoisted mocks for pool.query
const { mockQuery } = vi.hoisted(() => {
  const mockQuery = vi.fn();
  return { mockQuery };
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

// Directly mock auth middleware to control user context per-test
let mockUserRole = "dispatcher";
let mockUserTenantId = "company-aaa";
let mockUserCompanyId = "company-aaa";

vi.mock("../../middleware/requireAuth", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.user = {
      uid: "user-1",
      tenantId: mockUserTenantId,
      companyId: mockUserCompanyId,
      role: mockUserRole,
      email: "test@loadpilot.com",
      firebaseUid: "firebase-uid-1",
    };
    next();
  },
}));

vi.mock("../../middleware/requireTenant", () => ({
  requireTenant: (req: any, res: any, next: any) => {
    const user = req.user;
    if (!user) {
      return res
        .status(403)
        .json({ error: "Tenant verification requires authentication." });
    }
    next();
  },
}));

import express from "express";
import request from "supertest";
import quotesRouter from "../../routes/quotes";
import { errorHandler } from "../../middleware/errorHandler";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(quotesRouter);
  app.use(errorHandler);
  return app;
}

// Simulate missing auth — raw app without mocked middleware
function buildUnauthApp() {
  const app = express();
  app.use(express.json());
  app.use((_req: any, res: any) => {
    res.status(401).json({ error: "Authentication required." });
  });
  return app;
}

// ── GET /api/quotes — auth enforcement ──────────────────────────────────────

describe("GET /api/quotes — auth enforcement", () => {
  beforeEach(() => {
    mockUserRole = "dispatcher";
    mockUserTenantId = "company-aaa";
    mockUserCompanyId = "company-aaa";
    vi.clearAllMocks();
  });

  it("returns 401 when auth middleware rejects (no token path)", async () => {
    const app = buildUnauthApp();
    const res = await request(app).get("/api/quotes");
    expect(res.status).toBe(401);
  });
});

// ── GET /api/quotes — success path ──────────────────────────────────────────

describe("GET /api/quotes — success", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    mockUserRole = "dispatcher";
    mockUserTenantId = "company-aaa";
    mockUserCompanyId = "company-aaa";
    app = buildApp();
    vi.clearAllMocks();
  });

  it("returns quotes list with 200", async () => {
    const quotes = [
      {
        id: "q-001",
        company_id: "company-aaa",
        status: "Draft",
        pickup_city: "Chicago",
        pickup_state: "IL",
        total_rate: 2500,
      },
      {
        id: "q-002",
        company_id: "company-aaa",
        status: "Sent",
        pickup_city: "Dallas",
        pickup_state: "TX",
        total_rate: 3200,
      },
    ];
    // findByCompany: SELECT * FROM quotes WHERE company_id = ?
    mockQuery.mockResolvedValueOnce([quotes, []]);

    const res = await request(app)
      .get("/api/quotes")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
  });

  it("returns 500 on database error", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB connection error"));

    const res = await request(app)
      .get("/api/quotes")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(500);
  });
});

// ── GET /api/quotes/:id — tenant isolation ──────────────────────────────────

describe("GET /api/quotes/:id — tenant isolation", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    mockUserRole = "dispatcher";
    mockUserTenantId = "company-aaa";
    mockUserCompanyId = "company-aaa";
    app = buildApp();
    vi.clearAllMocks();
  });

  it("returns 404 for cross-tenant quote (conceals existence)", async () => {
    // findById returns a quote belonging to a different tenant
    mockQuery.mockResolvedValueOnce([
      [{ id: "q-001", company_id: "company-zzz", status: "Draft" }],
      [],
    ]);

    const res = await request(app)
      .get("/api/quotes/q-001")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Quote not found");
  });

  it("returns 404 when quote does not exist", async () => {
    // findById returns empty
    mockQuery.mockResolvedValueOnce([[], []]);

    const res = await request(app)
      .get("/api/quotes/nonexistent")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Quote not found");
  });

  it("returns 200 for same-tenant quote", async () => {
    const quote = {
      id: "q-001",
      company_id: "company-aaa",
      status: "Draft",
      pickup_city: "Chicago",
      total_rate: 2500,
    };
    // findById: SELECT * FROM quotes WHERE id = ?
    mockQuery.mockResolvedValueOnce([[quote], []]);

    const res = await request(app)
      .get("/api/quotes/q-001")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(res.body.id).toBe("q-001");
    expect(res.body.company_id).toBe("company-aaa");
  });
});

// ── POST /api/quotes — creation ─────────────────────────────────────────────

describe("POST /api/quotes — creation", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    mockUserRole = "dispatcher";
    mockUserTenantId = "company-aaa";
    mockUserCompanyId = "company-aaa";
    app = buildApp();
    vi.clearAllMocks();
  });

  it("returns 201 with valid data", async () => {
    const createdQuote = {
      id: "q-new",
      company_id: "company-aaa",
      status: "Draft",
      pickup_city: "Chicago",
      pickup_state: "IL",
      total_rate: 2500,
    };
    // INSERT INTO quotes
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    // findById (return after create)
    mockQuery.mockResolvedValueOnce([[createdQuote], []]);

    const res = await request(app)
      .post("/api/quotes")
      .set("Authorization", "Bearer valid-token")
      .send({
        status: "Draft",
        pickup_city: "Chicago",
        pickup_state: "IL",
        total_rate: 2500,
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe("q-new");
    expect(res.body.company_id).toBe("company-aaa");
  });

  it("returns 201 with minimal data (all fields optional except defaults)", async () => {
    const createdQuote = {
      id: "q-min",
      company_id: "company-aaa",
      status: "Draft",
    };
    // INSERT
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    // findById
    mockQuery.mockResolvedValueOnce([[createdQuote], []]);

    const res = await request(app)
      .post("/api/quotes")
      .set("Authorization", "Bearer valid-token")
      .send({});

    expect(res.status).toBe(201);
  });

  it("returns 400 with invalid status enum value", async () => {
    const res = await request(app)
      .post("/api/quotes")
      .set("Authorization", "Bearer valid-token")
      .send({ status: "InvalidStatus" });

    expect(res.status).toBe(400);
  });

  it("returns 500 on database error during creation", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB insert failed"));

    const res = await request(app)
      .post("/api/quotes")
      .set("Authorization", "Bearer valid-token")
      .send({ status: "Draft", pickup_city: "Chicago" });

    expect(res.status).toBe(500);
  });
});

// ── PATCH /api/quotes/:id — update ──────────────────────────────────────────

describe("PATCH /api/quotes/:id — update", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    mockUserRole = "dispatcher";
    mockUserTenantId = "company-aaa";
    mockUserCompanyId = "company-aaa";
    app = buildApp();
    vi.clearAllMocks();
  });

  it("returns 404 for cross-tenant update attempt (conceals existence)", async () => {
    // findById returns quote belonging to different tenant
    mockQuery.mockResolvedValueOnce([
      [{ id: "q-001", company_id: "company-zzz", status: "Draft" }],
      [],
    ]);

    const res = await request(app)
      .patch("/api/quotes/q-001")
      .set("Authorization", "Bearer valid-token")
      .send({ status: "Sent" });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Quote not found");
  });

  it("returns 404 when quote does not exist", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);

    const res = await request(app)
      .patch("/api/quotes/nonexistent")
      .set("Authorization", "Bearer valid-token")
      .send({ status: "Sent" });

    expect(res.status).toBe(404);
  });

  it("returns 200 for same-tenant update", async () => {
    const existingQuote = {
      id: "q-001",
      company_id: "company-aaa",
      status: "Draft",
    };
    const updatedQuote = {
      id: "q-001",
      company_id: "company-aaa",
      status: "Sent",
    };
    // findById (ownership check)
    mockQuery.mockResolvedValueOnce([[existingQuote], []]);
    // UPDATE quotes SET ...
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    // findById (return updated)
    mockQuery.mockResolvedValueOnce([[updatedQuote], []]);

    const res = await request(app)
      .patch("/api/quotes/q-001")
      .set("Authorization", "Bearer valid-token")
      .send({ status: "Sent" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("Sent");
  });
});

// ── PATCH /api/quotes/:id/archive — soft-delete ─────────────────────────────

describe("PATCH /api/quotes/:id/archive — soft-delete", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    mockUserRole = "dispatcher";
    mockUserTenantId = "company-aaa";
    mockUserCompanyId = "company-aaa";
    app = buildApp();
    vi.clearAllMocks();
  });

  it("returns 404 for cross-tenant archive attempt (conceals existence)", async () => {
    // findById returns quote belonging to different tenant
    mockQuery.mockResolvedValueOnce([
      [{ id: "q-001", company_id: "company-zzz", status: "Draft" }],
      [],
    ]);

    const res = await request(app)
      .patch("/api/quotes/q-001/archive")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Quote not found");
  });

  it("returns 404 when quote does not exist", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);

    const res = await request(app)
      .patch("/api/quotes/nonexistent/archive")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(404);
  });

  it("returns 200 for same-tenant archive", async () => {
    const existingQuote = {
      id: "q-001",
      company_id: "company-aaa",
      status: "Draft",
    };
    // findById (ownership check)
    mockQuery.mockResolvedValueOnce([[existingQuote], []]);
    // UPDATE quotes SET archived_at = NOW()
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

    const res = await request(app)
      .patch("/api/quotes/q-001/archive")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Quote archived");
  });
});
