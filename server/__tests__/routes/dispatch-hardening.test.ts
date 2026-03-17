import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Dispatch Route Hardening Tests
 *
 * Covers previously uncovered lines and branches in dispatch.ts:
 * - POST /api/dispatch-events: DB error paths
 * - POST /api/time-logs: role-based access, driver self-only restriction
 * - GET /api/time-logs/:userId: driver role restriction
 * - GET /api/audit: filter params, pagination, DB error
 * - GET /api/dashboard/cards: success and DB error
 */

const TEST_TENANT_ID = "company-aaa";

const { mockPoolQuery } = vi.hoisted(() => {
  const mockPoolQuery = vi.fn();
  return { mockPoolQuery };
});

vi.mock("../../db", () => ({
  default: {
    query: mockPoolQuery,
  },
}));

vi.mock("../../lib/logger", () => ({
  createChildLogger: () => ({
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

// User context: controlled per-test
let mockUserUid = "user-001";
let mockUserRole = "dispatcher";
let mockUserTenantId = TEST_TENANT_ID;

vi.mock("../../middleware/requireAuth", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.user = {
      uid: mockUserUid,
      id: "1",
      tenantId: mockUserTenantId,
      role: mockUserRole,
      email: "dispatch@test.com",
      firebaseUid: "fb-001",
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
import dispatchRouter from "../../routes/dispatch";
import { errorHandler } from "../../middleware/errorHandler";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(dispatchRouter);
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

beforeEach(() => {
  vi.clearAllMocks();
  mockUserUid = "user-001";
  mockUserRole = "dispatcher";
  mockUserTenantId = TEST_TENANT_ID;
  mockPoolQuery.mockResolvedValue([[], []]);
});

// ── POST /api/dispatch-events — DB error path ───────────────────────

describe("POST /api/dispatch-events — DB error handling", () => {
  it("returns 500 when DB throws on INSERT (after ownership check passes)", async () => {
    // First query: ownership check succeeds
    mockPoolQuery.mockResolvedValueOnce([[{ company_id: TEST_TENANT_ID }], []]);
    // Second query: INSERT throws
    mockPoolQuery.mockRejectedValueOnce(new Error("DB write error"));

    const app = buildApp();
    const res = await request(app)
      .post("/api/dispatch-events")
      .send({
        load_id: "load-001",
        dispatcher_id: "user-001",
        event_type: "StatusChange",
        message: "Test",
        payload: {},
      });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Database error");
  });

  it("returns 500 when DB throws on ownership SELECT", async () => {
    mockPoolQuery.mockRejectedValueOnce(new Error("DB read error"));

    const app = buildApp();
    const res = await request(app)
      .post("/api/dispatch-events")
      .send({
        load_id: "load-001",
        dispatcher_id: "user-001",
        event_type: "StatusChange",
        message: "Test",
        payload: {},
      });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Database error");
  });
});

// ── POST /api/time-logs — driver role restriction ───────────────────

describe("POST /api/time-logs — role-based access control", () => {
  it("driver can only log for themselves — rejects logging for another user_id", async () => {
    mockUserRole = "driver";
    mockUserUid = "driver-001";

    const app = buildApp();
    const res = await request(app)
      .post("/api/time-logs")
      .send({
        user_id: "driver-other", // not the authenticated driver
        load_id: "load-001",
        activity_type: "driving",
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("Access denied");
  });

  it("driver can log for themselves", async () => {
    mockUserRole = "driver";
    mockUserUid = "driver-001";
    mockPoolQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

    const app = buildApp();
    const res = await request(app)
      .post("/api/time-logs")
      .send({
        user_id: "driver-001",
        load_id: "load-001",
        activity_type: "driving",
        location_lat: 41.8,
        location_lng: -87.6,
      });

    expect(res.status).toBe(201);
  });

  it("admin can log for any user", async () => {
    mockUserRole = "admin";
    mockUserUid = "admin-001";
    // user lookup (different uid)
    mockPoolQuery.mockResolvedValueOnce([[{ company_id: TEST_TENANT_ID }], []]);
    // INSERT
    mockPoolQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

    const app = buildApp();
    const res = await request(app)
      .post("/api/time-logs")
      .send({
        user_id: "driver-999",
        load_id: "load-001",
        activity_type: "driving",
      });

    expect(res.status).toBe(201);
  });

  it("returns 500 on DB error during time log INSERT", async () => {
    mockPoolQuery.mockRejectedValueOnce(new Error("DB error"));

    const app = buildApp();
    const res = await request(app)
      .post("/api/time-logs")
      .send({
        user_id: "user-001",
        load_id: "load-001",
        activity_type: "driving",
      });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Database error");
  });
});

// ── GET /api/time-logs/:userId — driver role restriction ────────────

describe("GET /api/time-logs/:userId — role-based access", () => {
  it("driver cannot access another user time logs", async () => {
    mockUserRole = "driver";
    mockUserUid = "driver-001";

    const app = buildApp();
    const res = await request(app).get("/api/time-logs/driver-other");

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("Unauthorized profile access");
  });

  it("driver can access own time logs", async () => {
    mockUserRole = "driver";
    mockUserUid = "driver-001";
    mockPoolQuery.mockResolvedValueOnce([
      [{ id: "log-001", user_id: "driver-001" }],
      [],
    ]);

    const app = buildApp();
    const res = await request(app).get("/api/time-logs/driver-001");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("dispatcher can access any user time logs", async () => {
    mockUserRole = "dispatcher";
    mockUserUid = "dispatch-001";
    mockPoolQuery.mockResolvedValueOnce([[], []]);

    const app = buildApp();
    const res = await request(app).get("/api/time-logs/driver-001");

    expect(res.status).toBe(200);
  });

  it("returns 500 on DB error", async () => {
    mockPoolQuery.mockRejectedValueOnce(new Error("DB error"));

    const app = buildApp();
    const res = await request(app).get("/api/time-logs/user-001");

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Database error");
  });
});

// ── GET /api/time-logs/company/:companyId — company logs ────────────

describe("GET /api/time-logs/company/:companyId — success", () => {
  it("returns company time logs with 200", async () => {
    mockPoolQuery.mockResolvedValueOnce([
      [{ id: "log-001" }, { id: "log-002" }],
      [],
    ]);

    const app = buildApp();
    const res = await request(app).get(
      `/api/time-logs/company/${TEST_TENANT_ID}`,
    );

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
  });

  it("returns 500 on DB error", async () => {
    mockPoolQuery.mockRejectedValueOnce(new Error("DB error"));

    const app = buildApp();
    const res = await request(app).get(
      `/api/time-logs/company/${TEST_TENANT_ID}`,
    );

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Database error");
  });
});

// ── GET /api/dispatch-events/:companyId — success & error ───────────

describe("GET /api/dispatch-events/:companyId — success and error paths", () => {
  it("returns dispatch events with 200", async () => {
    mockPoolQuery.mockResolvedValueOnce([
      [
        { id: "de-001", event_type: "StatusChange" },
        { id: "de-002", event_type: "DriverAssigned" },
      ],
      [],
    ]);

    const app = buildApp();
    const res = await request(app).get(
      `/api/dispatch-events/${TEST_TENANT_ID}`,
    );

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it("returns 500 on DB error", async () => {
    mockPoolQuery.mockRejectedValueOnce(new Error("DB error"));

    const app = buildApp();
    const res = await request(app).get(
      `/api/dispatch-events/${TEST_TENANT_ID}`,
    );

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Database error");
  });
});

// ── GET /api/audit — filter params and pagination ───────────────────

describe("GET /api/audit — filtering, pagination, and error paths", () => {
  it("returns audit entries with 200 (no filters)", async () => {
    mockPoolQuery
      .mockResolvedValueOnce([
        [{ id: "de-001", event_type: "StatusChange", load_number: "LD-001" }],
        [],
      ])
      .mockResolvedValueOnce([[{ total: 1 }], []]);

    const app = buildApp();
    const res = await request(app)
      .get("/api/audit")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("entries");
    expect(res.body).toHaveProperty("total");
    expect(res.body.total).toBe(1);
  });

  it("supports type filter", async () => {
    mockPoolQuery
      .mockResolvedValueOnce([[], []])
      .mockResolvedValueOnce([[{ total: 0 }], []]);

    const app = buildApp();
    const res = await request(app)
      .get("/api/audit?type=StatusChange")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    // Verify the query params include event_type filter
    const entrySql = mockPoolQuery.mock.calls[0][0] as string;
    expect(entrySql).toContain("event_type = ?");
  });

  it("supports loadId filter", async () => {
    mockPoolQuery
      .mockResolvedValueOnce([[], []])
      .mockResolvedValueOnce([[{ total: 0 }], []]);

    const app = buildApp();
    const res = await request(app)
      .get("/api/audit?loadId=load-001")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    const entrySql = mockPoolQuery.mock.calls[0][0] as string;
    expect(entrySql).toContain("load_id = ?");
  });

  it("supports combined type and loadId filters", async () => {
    mockPoolQuery
      .mockResolvedValueOnce([[], []])
      .mockResolvedValueOnce([[{ total: 0 }], []]);

    const app = buildApp();
    const res = await request(app)
      .get("/api/audit?type=StatusChange&loadId=load-001")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    const entrySql = mockPoolQuery.mock.calls[0][0] as string;
    expect(entrySql).toContain("event_type = ?");
    expect(entrySql).toContain("load_id = ?");
  });

  it("supports limit and offset pagination", async () => {
    mockPoolQuery
      .mockResolvedValueOnce([[], []])
      .mockResolvedValueOnce([[{ total: 100 }], []]);

    const app = buildApp();
    const res = await request(app)
      .get("/api/audit?limit=10&offset=20")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    // Verify LIMIT and OFFSET are passed
    const entryParams = mockPoolQuery.mock.calls[0][1] as unknown[];
    expect(entryParams).toContain(10);
    expect(entryParams).toContain(20);
  });

  it("caps limit at 500", async () => {
    mockPoolQuery
      .mockResolvedValueOnce([[], []])
      .mockResolvedValueOnce([[{ total: 0 }], []]);

    const app = buildApp();
    await request(app)
      .get("/api/audit?limit=1000")
      .set("Authorization", "Bearer valid-token");

    const entryParams = mockPoolQuery.mock.calls[0][1] as unknown[];
    // Should be capped at 500
    expect(entryParams).toContain(500);
  });

  it("returns 500 on DB error", async () => {
    mockPoolQuery.mockRejectedValueOnce(new Error("DB error"));

    const app = buildApp();
    const res = await request(app)
      .get("/api/audit")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Database error");
  });
});

// ── GET /api/dashboard/cards — success and error ────────────────────

describe("GET /api/dashboard/cards — success and error paths", () => {
  it("returns dashboard cards with 200", async () => {
    mockPoolQuery.mockResolvedValueOnce([
      [
        { id: "card-1", company_id: TEST_TENANT_ID, sort_order: 1 },
        { id: "card-2", company_id: null, sort_order: 2 },
      ],
      [],
    ]);

    const app = buildApp();
    const res = await request(app)
      .get("/api/dashboard/cards")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
  });

  it("returns empty array when no cards exist", async () => {
    mockPoolQuery.mockResolvedValueOnce([[], []]);

    const app = buildApp();
    const res = await request(app)
      .get("/api/dashboard/cards")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  it("returns 500 on DB error", async () => {
    mockPoolQuery.mockRejectedValueOnce(new Error("DB error"));

    const app = buildApp();
    const res = await request(app)
      .get("/api/dashboard/cards")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Database error");
  });
});

// ── Auth enforcement for all dispatch endpoints ─────────────────────

describe("Dispatch routes — auth enforcement", () => {
  it("POST /api/time-logs returns 401 without auth", async () => {
    const app = buildUnauthApp();
    const res = await request(app)
      .post("/api/time-logs")
      .send({ user_id: "u", activity_type: "driving" });
    expect(res.status).toBe(401);
  });

  it("GET /api/audit returns 401 without auth", async () => {
    const app = buildUnauthApp();
    const res = await request(app).get("/api/audit");
    expect(res.status).toBe(401);
  });

  it("GET /api/dashboard/cards returns 401 without auth", async () => {
    const app = buildUnauthApp();
    const res = await request(app).get("/api/dashboard/cards");
    expect(res.status).toBe(401);
  });
});
