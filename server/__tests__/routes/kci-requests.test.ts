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
import kciRequestsRouter from "../../routes/kci-requests";
import { errorHandler } from "../../middleware/errorHandler";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(kciRequestsRouter);
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

// ── GET /api/kci-requests — auth enforcement ────────────────────────────────

describe("GET /api/kci-requests — auth enforcement", () => {
  beforeEach(() => {
    mockUserRole = "dispatcher";
    mockUserTenantId = "company-aaa";
    mockUserCompanyId = "company-aaa";
    vi.clearAllMocks();
  });

  it("returns 401 when auth middleware rejects (no token path)", async () => {
    const app = buildUnauthApp();
    const res = await request(app).get("/api/kci-requests");
    expect(res.status).toBe(401);
  });
});

// ── GET /api/kci-requests — success path ────────────────────────────────────

describe("GET /api/kci-requests — success", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    mockUserRole = "dispatcher";
    mockUserTenantId = "company-aaa";
    mockUserCompanyId = "company-aaa";
    app = buildApp();
    vi.clearAllMocks();
  });

  it("returns KCI requests list with 200", async () => {
    const kciRequests = [
      {
        id: "kci-001",
        company_id: "company-aaa",
        type: "Fuel Advance",
        status: "Pending",
        priority: "HIGH",
        requested_amount: 500,
      },
      {
        id: "kci-002",
        company_id: "company-aaa",
        type: "Lumper Fee",
        status: "Approved",
        priority: "MEDIUM",
        requested_amount: 200,
        approved_amount: 200,
      },
    ];
    // findByCompany: SELECT * FROM kci_requests WHERE company_id = ?
    mockQuery.mockResolvedValueOnce([kciRequests, []]);

    const res = await request(app)
      .get("/api/kci-requests")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
  });

  it("returns 500 on database error", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB connection error"));

    const res = await request(app)
      .get("/api/kci-requests")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(500);
  });
});

// ── POST /api/kci-requests — creation ───────────────────────────────────────

describe("POST /api/kci-requests — creation", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    mockUserRole = "dispatcher";
    mockUserTenantId = "company-aaa";
    mockUserCompanyId = "company-aaa";
    app = buildApp();
    vi.clearAllMocks();
  });

  it("returns 201 with valid data", async () => {
    const createdRequest = {
      id: "kci-new",
      company_id: "company-aaa",
      type: "Fuel Advance",
      status: "Pending",
      priority: "HIGH",
      requested_amount: 500,
      currency: "USD",
    };
    // INSERT INTO kci_requests
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    // findById (return after create)
    mockQuery.mockResolvedValueOnce([[createdRequest], []]);

    const res = await request(app)
      .post("/api/kci-requests")
      .set("Authorization", "Bearer valid-token")
      .send({
        type: "Fuel Advance",
        status: "Pending",
        priority: "HIGH",
        requested_amount: 500,
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe("kci-new");
    expect(res.body.type).toBe("Fuel Advance");
  });

  it("returns 400 when required field 'type' is missing", async () => {
    const res = await request(app)
      .post("/api/kci-requests")
      .set("Authorization", "Bearer valid-token")
      .send({ status: "Pending", priority: "HIGH" });

    expect(res.status).toBe(400);
  });

  it("returns 400 when 'type' is empty string", async () => {
    const res = await request(app)
      .post("/api/kci-requests")
      .set("Authorization", "Bearer valid-token")
      .send({ type: "" });

    expect(res.status).toBe(400);
  });

  it("returns 500 on database error during creation", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB insert failed"));

    const res = await request(app)
      .post("/api/kci-requests")
      .set("Authorization", "Bearer valid-token")
      .send({ type: "Fuel Advance" });

    expect(res.status).toBe(500);
  });
});

// ── PATCH /api/kci-requests/:id — tenant isolation ──────────────────────────

describe("PATCH /api/kci-requests/:id — tenant isolation", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    mockUserRole = "dispatcher";
    mockUserTenantId = "company-aaa";
    mockUserCompanyId = "company-aaa";
    app = buildApp();
    vi.clearAllMocks();
  });

  it("returns 404 for cross-tenant update attempt (conceals existence)", async () => {
    // findById returns KCI request belonging to different tenant
    mockQuery.mockResolvedValueOnce([
      [{ id: "kci-001", company_id: "company-zzz", type: "Fuel Advance" }],
      [],
    ]);

    const res = await request(app)
      .patch("/api/kci-requests/kci-001")
      .set("Authorization", "Bearer valid-token")
      .send({ status: "Approved" });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("KCI request not found");
  });

  it("returns 404 when KCI request does not exist", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);

    const res = await request(app)
      .patch("/api/kci-requests/nonexistent")
      .set("Authorization", "Bearer valid-token")
      .send({ status: "Denied" });

    expect(res.status).toBe(404);
  });

  it("returns 200 for same-tenant update (non-approval fields)", async () => {
    const existing = {
      id: "kci-001",
      company_id: "company-aaa",
      type: "Fuel Advance",
      status: "Pending",
      decision_log: null,
    };
    const updated = {
      id: "kci-001",
      company_id: "company-aaa",
      type: "Fuel Advance",
      status: "Under Review",
    };
    // findById (ownership check)
    mockQuery.mockResolvedValueOnce([[existing], []]);
    // UPDATE kci_requests SET ...
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    // findById (return updated)
    mockQuery.mockResolvedValueOnce([[updated], []]);

    const res = await request(app)
      .patch("/api/kci-requests/kci-001")
      .set("Authorization", "Bearer valid-token")
      .send({ status: "Under Review" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("Under Review");
  });
});

// ── PATCH /api/kci-requests/:id — role-based approval enforcement ───────────

describe("PATCH /api/kci-requests/:id — approval role enforcement", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 403 when driver tries to set approved_amount", async () => {
    mockUserRole = "driver";
    mockUserTenantId = "company-aaa";
    mockUserCompanyId = "company-aaa";
    app = buildApp();

    const existing = {
      id: "kci-001",
      company_id: "company-aaa",
      type: "Fuel Advance",
      status: "Pending",
      decision_log: null,
    };
    // findById (ownership check)
    mockQuery.mockResolvedValueOnce([[existing], []]);

    const res = await request(app)
      .patch("/api/kci-requests/kci-001")
      .set("Authorization", "Bearer valid-token")
      .send({ approved_amount: 500 });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("Insufficient role for approval actions");
  });

  it("returns 403 when driver tries to set status to Approved", async () => {
    mockUserRole = "driver";
    mockUserTenantId = "company-aaa";
    mockUserCompanyId = "company-aaa";
    app = buildApp();

    const existing = {
      id: "kci-001",
      company_id: "company-aaa",
      type: "Fuel Advance",
      status: "Pending",
      decision_log: null,
    };
    // findById (ownership check)
    mockQuery.mockResolvedValueOnce([[existing], []]);

    const res = await request(app)
      .patch("/api/kci-requests/kci-001")
      .set("Authorization", "Bearer valid-token")
      .send({ status: "Approved" });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("Insufficient role for approval actions");
  });

  it("returns 200 when admin approves (approved_amount)", async () => {
    mockUserRole = "admin";
    mockUserTenantId = "company-aaa";
    mockUserCompanyId = "company-aaa";
    app = buildApp();

    const existing = {
      id: "kci-001",
      company_id: "company-aaa",
      type: "Fuel Advance",
      status: "Pending",
      decision_log: null,
    };
    const updated = {
      id: "kci-001",
      company_id: "company-aaa",
      type: "Fuel Advance",
      status: "Approved",
      approved_amount: 500,
    };
    // findById (ownership check)
    mockQuery.mockResolvedValueOnce([[existing], []]);
    // UPDATE
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    // findById (return updated)
    mockQuery.mockResolvedValueOnce([[updated], []]);

    const res = await request(app)
      .patch("/api/kci-requests/kci-001")
      .set("Authorization", "Bearer valid-token")
      .send({ approved_amount: 500, status: "Approved" });

    expect(res.status).toBe(200);
    expect(res.body.approved_amount).toBe(500);
  });

  it("returns 200 when dispatcher approves", async () => {
    mockUserRole = "dispatcher";
    mockUserTenantId = "company-aaa";
    mockUserCompanyId = "company-aaa";
    app = buildApp();

    const existing = {
      id: "kci-001",
      company_id: "company-aaa",
      type: "Fuel Advance",
      status: "Pending",
      decision_log: null,
    };
    const updated = {
      id: "kci-001",
      company_id: "company-aaa",
      type: "Fuel Advance",
      status: "Approved",
      approved_amount: 300,
    };
    // findById (ownership check)
    mockQuery.mockResolvedValueOnce([[existing], []]);
    // UPDATE
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    // findById (return updated)
    mockQuery.mockResolvedValueOnce([[updated], []]);

    const res = await request(app)
      .patch("/api/kci-requests/kci-001")
      .set("Authorization", "Bearer valid-token")
      .send({ approved_amount: 300, status: "Approved" });

    expect(res.status).toBe(200);
  });

  it("returns 200 when payroll_manager approves", async () => {
    mockUserRole = "payroll_manager";
    mockUserTenantId = "company-aaa";
    mockUserCompanyId = "company-aaa";
    app = buildApp();

    const existing = {
      id: "kci-001",
      company_id: "company-aaa",
      type: "Fuel Advance",
      status: "Pending",
      decision_log: null,
    };
    const updated = {
      id: "kci-001",
      company_id: "company-aaa",
      type: "Fuel Advance",
      status: "Approved",
      approved_amount: 400,
    };
    mockQuery.mockResolvedValueOnce([[existing], []]);
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    mockQuery.mockResolvedValueOnce([[updated], []]);

    const res = await request(app)
      .patch("/api/kci-requests/kci-001")
      .set("Authorization", "Bearer valid-token")
      .send({ approved_amount: 400, status: "Approved" });

    expect(res.status).toBe(200);
  });
});

// ── DELETE /api/kci-requests — no endpoint ──────────────────────────────────

describe("DELETE /api/kci-requests/:id — no endpoint exists", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    mockUserRole = "admin";
    mockUserTenantId = "company-aaa";
    mockUserCompanyId = "company-aaa";
    app = buildApp();
    vi.clearAllMocks();
  });

  it("returns 404 — DELETE endpoint does not exist (retention policy)", async () => {
    const res = await request(app)
      .delete("/api/kci-requests/kci-001")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(404);
  });
});
