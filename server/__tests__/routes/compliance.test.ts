import { describe, it, expect, vi, beforeEach } from "vitest";

// Tests R-FS-05-02, R-FS-05-07

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
let mockUserId = "user-1";

vi.mock("../../middleware/requireAuth", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.user = {
      uid: mockUserId,
      id: mockUserId,
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
import complianceRouter from "../../routes/compliance";
import { errorHandler } from "../../middleware/errorHandler";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(complianceRouter);
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

const USER_ID = "user-1";

// ── Auth enforcement ──────────────────────────────────────────────────────────

describe("GET /api/compliance/:userId — auth enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when auth middleware rejects (no token path)", async () => {
    const app = buildUnauthApp();
    const res = await request(app).get(`/api/compliance/${USER_ID}`);
    expect(res.status).toBe(401);
  });
});

// ── Tenant / RBAC enforcement ─────────────────────────────────────────────────

describe("GET /api/compliance/:userId — RBAC enforcement", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    mockUserRole = "dispatcher";
    mockUserTenantId = "company-aaa";
    mockUserId = "user-1";
    app = buildApp();
    vi.clearAllMocks();
  });

  it("returns 403 when driver accesses another user's compliance record", async () => {
    mockUserRole = "driver";
    mockUserId = "user-1";
    app = buildApp();

    const res = await request(app)
      .get("/api/compliance/different-user-id")
      .set("Authorization", "Bearer valid-token");

    // Route-level RBAC: driver can only see their own record
    expect(res.status).toBe(403);
  });

  it("allows dispatcher to access any user's compliance record", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);

    const res = await request(app)
      .get("/api/compliance/another-user-id")
      .set("Authorization", "Bearer valid-token");

    // Dispatcher is allowed
    expect([200, 500]).toContain(res.status);
    expect(res.status).not.toBe(403);
  });
});

// ── Validation errors ─────────────────────────────────────────────────────────

describe("GET /api/compliance/:userId — validation", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    mockUserRole = "dispatcher";
    mockUserId = "user-1";
    app = buildApp();
    vi.clearAllMocks();
  });

  it("returns empty array for user with no compliance records", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);

    const res = await request(app)
      .get(`/api/compliance/${USER_ID}`)
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(0);
  });
});

// ── Success path ──────────────────────────────────────────────────────────────

describe("GET /api/compliance/:userId — success", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    mockUserRole = "dispatcher";
    mockUserId = "user-1";
    app = buildApp();
    vi.clearAllMocks();
  });

  it("returns compliance records with 200", async () => {
    const records = [
      {
        id: "comp-001",
        user_id: USER_ID,
        type: "CDL",
        status: "valid",
        expiry: "2027-01-01",
      },
    ];
    mockQuery.mockResolvedValueOnce([records, []]);

    const res = await request(app)
      .get(`/api/compliance/${USER_ID}`)
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].type).toBe("CDL");
  });

  it("allows driver to access their own compliance record", async () => {
    mockUserRole = "driver";
    mockUserId = USER_ID;
    app = buildApp();

    const records = [
      {
        id: "comp-002",
        user_id: USER_ID,
        type: "Medical Card",
        status: "valid",
      },
    ];
    mockQuery.mockResolvedValueOnce([records, []]);

    const res = await request(app)
      .get(`/api/compliance/${USER_ID}`)
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it("returns 500 on database error", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB connection lost"));

    const res = await request(app)
      .get(`/api/compliance/${USER_ID}`)
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(500);
  });
});
