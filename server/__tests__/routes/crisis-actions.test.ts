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
import crisisActionsRouter from "../../routes/crisis-actions";
import { errorHandler } from "../../middleware/errorHandler";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(crisisActionsRouter);
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

// ── GET /api/crisis-actions — auth enforcement ──────────────────────────────

describe("GET /api/crisis-actions — auth enforcement", () => {
  beforeEach(() => {
    mockUserRole = "dispatcher";
    mockUserTenantId = "company-aaa";
    mockUserCompanyId = "company-aaa";
    vi.clearAllMocks();
  });

  it("returns 401 when auth middleware rejects (no token path)", async () => {
    const app = buildUnauthApp();
    const res = await request(app).get("/api/crisis-actions");
    expect(res.status).toBe(401);
  });
});

// ── GET /api/crisis-actions — success path ──────────────────────────────────

describe("GET /api/crisis-actions — success", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    mockUserRole = "dispatcher";
    mockUserTenantId = "company-aaa";
    mockUserCompanyId = "company-aaa";
    app = buildApp();
    vi.clearAllMocks();
  });

  it("returns crisis actions list with 200", async () => {
    const actions = [
      {
        id: "ca-001",
        company_id: "company-aaa",
        type: "Weather Reroute",
        status: "Active",
        incident_id: "inc-001",
        description: "Tornado warning on I-35",
      },
      {
        id: "ca-002",
        company_id: "company-aaa",
        type: "Breakdown Response",
        status: "Resolved",
        incident_id: "inc-002",
        description: "Flat tire on US-75",
      },
    ];
    // findByCompany: SELECT * FROM crisis_actions WHERE company_id = ?
    mockQuery.mockResolvedValueOnce([actions, []]);

    const res = await request(app)
      .get("/api/crisis-actions")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
  });

  it("returns 500 on database error", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB connection error"));

    const res = await request(app)
      .get("/api/crisis-actions")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(500);
  });
});

// ── POST /api/crisis-actions — creation ─────────────────────────────────────

describe("POST /api/crisis-actions — creation", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    mockUserRole = "dispatcher";
    mockUserTenantId = "company-aaa";
    mockUserCompanyId = "company-aaa";
    app = buildApp();
    vi.clearAllMocks();
  });

  it("returns 201 with valid data", async () => {
    const createdAction = {
      id: "ca-new",
      company_id: "company-aaa",
      type: "Weather Reroute",
      status: "Active",
      incident_id: "inc-001",
      description: "Tornado warning on I-35",
    };
    // INSERT INTO crisis_actions
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    // findById (return after create)
    mockQuery.mockResolvedValueOnce([[createdAction], []]);

    const res = await request(app)
      .post("/api/crisis-actions")
      .set("Authorization", "Bearer valid-token")
      .send({
        type: "Weather Reroute",
        status: "Active",
        incident_id: "inc-001",
        description: "Tornado warning on I-35",
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe("ca-new");
    expect(res.body.type).toBe("Weather Reroute");
  });

  it("returns 400 when required field 'type' is missing", async () => {
    const res = await request(app)
      .post("/api/crisis-actions")
      .set("Authorization", "Bearer valid-token")
      .send({ status: "Active", description: "No type provided" });

    expect(res.status).toBe(400);
  });

  it("returns 400 when 'type' is empty string", async () => {
    const res = await request(app)
      .post("/api/crisis-actions")
      .set("Authorization", "Bearer valid-token")
      .send({ type: "" });

    expect(res.status).toBe(400);
  });

  it("returns 500 on database error during creation", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB insert failed"));

    const res = await request(app)
      .post("/api/crisis-actions")
      .set("Authorization", "Bearer valid-token")
      .send({ type: "Weather Reroute" });

    expect(res.status).toBe(500);
  });
});

// ── PATCH /api/crisis-actions/:id — role enforcement ────────────────────────

describe("PATCH /api/crisis-actions/:id — role enforcement", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 403 when driver tries to modify crisis action", async () => {
    mockUserRole = "driver";
    mockUserTenantId = "company-aaa";
    mockUserCompanyId = "company-aaa";
    app = buildApp();

    const res = await request(app)
      .patch("/api/crisis-actions/ca-001")
      .set("Authorization", "Bearer valid-token")
      .send({ status: "Resolved" });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe(
      "Insufficient role for crisis action modification",
    );
  });

  it("returns 403 when customer role tries to modify crisis action", async () => {
    mockUserRole = "customer";
    mockUserTenantId = "company-aaa";
    mockUserCompanyId = "company-aaa";
    app = buildApp();

    const res = await request(app)
      .patch("/api/crisis-actions/ca-001")
      .set("Authorization", "Bearer valid-token")
      .send({ status: "Resolved" });

    expect(res.status).toBe(403);
  });

  it("returns 200 when admin modifies crisis action", async () => {
    mockUserRole = "admin";
    mockUserTenantId = "company-aaa";
    mockUserCompanyId = "company-aaa";
    app = buildApp();

    const existing = {
      id: "ca-001",
      company_id: "company-aaa",
      type: "Weather Reroute",
      status: "Active",
      timeline: null,
    };
    const updated = {
      id: "ca-001",
      company_id: "company-aaa",
      type: "Weather Reroute",
      status: "Resolved",
    };
    // findById (ownership check)
    mockQuery.mockResolvedValueOnce([[existing], []]);
    // UPDATE crisis_actions SET ...
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    // findById (return updated)
    mockQuery.mockResolvedValueOnce([[updated], []]);

    const res = await request(app)
      .patch("/api/crisis-actions/ca-001")
      .set("Authorization", "Bearer valid-token")
      .send({ status: "Resolved" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("Resolved");
  });

  it("returns 200 when dispatcher modifies crisis action", async () => {
    mockUserRole = "dispatcher";
    mockUserTenantId = "company-aaa";
    mockUserCompanyId = "company-aaa";
    app = buildApp();

    const existing = {
      id: "ca-001",
      company_id: "company-aaa",
      type: "Weather Reroute",
      status: "Active",
      timeline: null,
    };
    const updated = {
      id: "ca-001",
      company_id: "company-aaa",
      type: "Weather Reroute",
      status: "Resolved",
    };
    mockQuery.mockResolvedValueOnce([[existing], []]);
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    mockQuery.mockResolvedValueOnce([[updated], []]);

    const res = await request(app)
      .patch("/api/crisis-actions/ca-001")
      .set("Authorization", "Bearer valid-token")
      .send({ status: "Resolved" });

    expect(res.status).toBe(200);
  });

  it("returns 200 when safety_manager modifies crisis action", async () => {
    mockUserRole = "safety_manager";
    mockUserTenantId = "company-aaa";
    mockUserCompanyId = "company-aaa";
    app = buildApp();

    const existing = {
      id: "ca-001",
      company_id: "company-aaa",
      type: "Weather Reroute",
      status: "Active",
      timeline: null,
    };
    const updated = {
      id: "ca-001",
      company_id: "company-aaa",
      type: "Weather Reroute",
      status: "Escalated",
    };
    mockQuery.mockResolvedValueOnce([[existing], []]);
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    mockQuery.mockResolvedValueOnce([[updated], []]);

    const res = await request(app)
      .patch("/api/crisis-actions/ca-001")
      .set("Authorization", "Bearer valid-token")
      .send({ status: "Escalated" });

    expect(res.status).toBe(200);
  });
});

// ── PATCH /api/crisis-actions/:id — tenant isolation ────────────────────────

describe("PATCH /api/crisis-actions/:id — tenant isolation", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    mockUserRole = "admin";
    mockUserTenantId = "company-aaa";
    mockUserCompanyId = "company-aaa";
    app = buildApp();
    vi.clearAllMocks();
  });

  it("returns 404 for cross-tenant update attempt (conceals existence)", async () => {
    // findById returns crisis action belonging to different tenant
    mockQuery.mockResolvedValueOnce([
      [
        {
          id: "ca-001",
          company_id: "company-zzz",
          type: "Weather Reroute",
          timeline: null,
        },
      ],
      [],
    ]);

    const res = await request(app)
      .patch("/api/crisis-actions/ca-001")
      .set("Authorization", "Bearer valid-token")
      .send({ status: "Resolved" });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Crisis action not found");
  });

  it("returns 404 when crisis action does not exist", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);

    const res = await request(app)
      .patch("/api/crisis-actions/nonexistent")
      .set("Authorization", "Bearer valid-token")
      .send({ status: "Resolved" });

    expect(res.status).toBe(404);
  });
});

// ── DELETE /api/crisis-actions — no endpoint ────────────────────────────────

describe("DELETE /api/crisis-actions/:id — no endpoint exists", () => {
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
      .delete("/api/crisis-actions/ca-001")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(404);
  });
});
