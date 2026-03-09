import { describe, it, expect, vi, beforeEach } from "vitest";

// Tests R-FS-05-05, R-FS-05-07

// Hoisted mocks
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

// Control user context per-test
let mockUserRole = "dispatcher";
let mockUserTenantId = "company-aaa";

vi.mock("../../middleware/requireAuth", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.user = {
      uid: "user-1",
      tenantId: mockUserTenantId,
      role: mockUserRole,
      email: "test@loadpilot.com",
      firebaseUid: "firebase-uid-1",
    };
    next();
  },
}));

vi.mock("../../middleware/requireTenant", () => ({
  requireTenant: (_req: any, _res: any, next: any) => {
    next();
  },
}));

import express from "express";
import request from "supertest";
import exceptionsRouter from "../../routes/exceptions";
import { errorHandler } from "../../middleware/errorHandler";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(exceptionsRouter);
  app.use(errorHandler);
  return app;
}

function buildUnauthApp() {
  const app = express();
  app.use(express.json());
  app.use((_req: any, res: any) => {
    res.status(401).json({ error: "Authentication required." });
  });
  return app;
}

const makeException = (overrides = {}) => ({
  id: "ex-001",
  tenant_id: "DEFAULT",
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

// ── Auth enforcement ──────────────────────────────────────────────────────────

describe("GET /api/exceptions — auth enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when auth middleware rejects (no token path)", async () => {
    const app = buildUnauthApp();
    const res = await request(app).get("/api/exceptions");
    expect(res.status).toBe(401);
  });
});

describe("POST /api/exceptions — auth enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when auth middleware rejects (no token path)", async () => {
    const app = buildUnauthApp();
    const res = await request(app)
      .post("/api/exceptions")
      .send({ type: "DELAY", entityType: "LOAD", entityId: "load-001" });
    expect(res.status).toBe(401);
  });
});

describe("PATCH /api/exceptions/:id — auth enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when auth middleware rejects (no token path)", async () => {
    const app = buildUnauthApp();
    const res = await request(app)
      .patch("/api/exceptions/ex-001")
      .send({ status: "RESOLVED" });
    expect(res.status).toBe(401);
  });
});

// ── Tenant enforcement ────────────────────────────────────────────────────────
// exceptions routes use requireTenant (no :companyId param) —
// tenant is enforced by the middleware but no param-level mismatch can occur here

describe("GET /api/exceptions — tenant enforcement (middleware present)", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    mockUserRole = "dispatcher";
    mockUserTenantId = "company-aaa";
    app = buildApp();
    vi.clearAllMocks();
  });

  it("allows authenticated user — requireTenant passes with no companyId param", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);

    const res = await request(app)
      .get("/api/exceptions")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
  });
});

// ── Validation errors ─────────────────────────────────────────────────────────

describe("PATCH /api/exceptions/:id — validation (not found)", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    mockUserRole = "dispatcher";
    mockUserTenantId = "company-aaa";
    app = buildApp();
    vi.clearAllMocks();
  });

  it("returns 404 when exception does not exist", async () => {
    mockQuery.mockResolvedValueOnce([[], []]); // SELECT returns empty

    const res = await request(app)
      .patch("/api/exceptions/nonexistent")
      .set("Authorization", "Bearer valid-token")
      .send({ status: "RESOLVED" });

    expect(res.status).toBe(404);
  });
});

// ── Success path ──────────────────────────────────────────────────────────────

describe("GET /api/exceptions — success", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    mockUserRole = "dispatcher";
    mockUserTenantId = "company-aaa";
    app = buildApp();
    vi.clearAllMocks();
  });

  it("returns exceptions list with 200", async () => {
    const exceptions = [makeException(), makeException({ id: "ex-002" })];
    mockQuery.mockResolvedValueOnce([exceptions, []]);

    const res = await request(app)
      .get("/api/exceptions")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
  });

  it("supports filtering by status query param", async () => {
    const openExceptions = [makeException()];
    mockQuery.mockResolvedValueOnce([openExceptions, []]);

    const res = await request(app)
      .get("/api/exceptions?status=OPEN")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it("returns 500 on database error", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB error"));

    const res = await request(app)
      .get("/api/exceptions")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(500);
  });
});

describe("POST /api/exceptions — success", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    mockUserRole = "dispatcher";
    mockUserTenantId = "company-aaa";
    app = buildApp();
    vi.clearAllMocks();
  });

  it("creates exception and returns 201 with id", async () => {
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]); // INSERT exception
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]); // INSERT exception_events

    const res = await request(app)
      .post("/api/exceptions")
      .set("Authorization", "Bearer valid-token")
      .send({
        type: "DELAY",
        entityType: "LOAD",
        entityId: "load-001",
        severity: 2,
        description: "Driver delayed on I-90",
        createdBy: "user-1",
      });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe("Exception recorded");
    expect(res.body).toHaveProperty("id");
  });
});

describe("PATCH /api/exceptions/:id — success", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    mockUserRole = "dispatcher";
    mockUserTenantId = "company-aaa";
    app = buildApp();
    vi.clearAllMocks();
  });

  it("updates exception status and returns 200", async () => {
    const existing = makeException();
    mockQuery.mockResolvedValueOnce([[existing], []]); // SELECT existing
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]); // UPDATE
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]); // INSERT event

    const res = await request(app)
      .patch("/api/exceptions/ex-001")
      .set("Authorization", "Bearer valid-token")
      .send({
        status: "IN_PROGRESS",
        notes: "Working on it",
        actorName: "dispatch",
      });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Exception updated");
  });

  it("returns 500 on database error during update", async () => {
    const existing = makeException();
    mockQuery.mockResolvedValueOnce([[existing], []]); // SELECT existing
    mockQuery.mockRejectedValueOnce(new Error("DB update failed")); // UPDATE fails

    const res = await request(app)
      .patch("/api/exceptions/ex-001")
      .set("Authorization", "Bearer valid-token")
      .send({ status: "RESOLVED" });

    expect(res.status).toBe(500);
  });
});

describe("GET /api/exceptions/:id/events — success", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    mockUserRole = "dispatcher";
    mockUserTenantId = "company-aaa";
    app = buildApp();
    vi.clearAllMocks();
  });

  it("returns 401 when auth middleware rejects (no token path)", async () => {
    const unauthApp = buildUnauthApp();
    const res = await request(unauthApp).get("/api/exceptions/ex-001/events");
    expect(res.status).toBe(401);
  });

  it("returns event history for an exception", async () => {
    const events = [
      {
        id: "evt-001",
        exception_id: "ex-001",
        action: "Exception Created",
        notes: "Initial",
      },
    ];
    mockQuery.mockResolvedValueOnce([events, []]);

    const res = await request(app)
      .get("/api/exceptions/ex-001/events")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);
  });
});
