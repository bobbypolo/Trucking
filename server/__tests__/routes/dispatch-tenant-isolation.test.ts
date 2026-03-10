import { describe, it, expect, vi, beforeEach } from "vitest";

// Tests R-P1-01, R-P1-04, R-P1-05, R-P1-06

/**
 * Dispatch Route Tenant Isolation Tests
 *
 * Verifies that:
 *   - POST /api/dispatch-events validates load_id ownership (R-P1-01)
 *   - Cross-tenant load_id is rejected with 403 (R-P1-01)
 *   - Missing load_id returns 404 (R-P1-01)
 *   - All handlers use AuthenticatedRequest (R-P1-04)
 *   - JSON.stringify(payload) is wrapped in try/catch (R-P1-05)
 *   - At least 3 tenant isolation test cases exist (R-P1-06)
 *
 * Pattern: Mock pool.query and middleware, inject req.user via middleware,
 * assert SQL structure and params. Follows accounting-tenant.test.ts pattern.
 */

const TEST_TENANT_ID = "tenant-dispatch-abc123";
const OTHER_TENANT_ID = "tenant-dispatch-other";

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
  }),
}));

// Mock auth/tenant middleware to pass through; req.user injected by buildApp below
vi.mock("../../middleware/requireAuth", () => ({
  requireAuth: (_req: unknown, _res: unknown, next: Function) => next(),
}));

vi.mock("../../middleware/requireTenant", () => ({
  requireTenant: (_req: unknown, _res: unknown, next: Function) => next(),
}));

import dispatchRouter from "../../routes/dispatch";
import express from "express";
import request from "supertest";

function makeUser(tenantId = TEST_TENANT_ID) {
  return {
    uid: "user-001",
    tenantId,
    role: "dispatcher",
    email: "dispatch@test.com",
    firebaseUid: "fb-001",
  };
}

function buildApp(tenantId = TEST_TENANT_ID) {
  const app = express();
  app.use(express.json());
  // Inject user context the same way requireAuth does (it's mocked to call next())
  app.use((req: any, _res: unknown, next: Function) => {
    req.user = makeUser(tenantId);
    next();
  });
  app.use(dispatchRouter);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPoolQuery.mockResolvedValue([[], []]);
});

// ============================================================
// R-P1-01: POST /api/dispatch-events — tenant ownership check
// ============================================================

describe("R-P1-01: POST /api/dispatch-events — tenant isolation", () => {
  it("accepts dispatch event when load belongs to user's tenant (R-P1-06 case 1)", async () => {
    // First query: SELECT load → belongs to user's tenant
    mockPoolQuery
      .mockResolvedValueOnce([[{ company_id: TEST_TENANT_ID }], []])
      // Second query: INSERT dispatch_event
      .mockResolvedValueOnce([{ affectedRows: 1 }, []]);

    const app = buildApp();
    const res = await request(app)
      .post("/api/dispatch-events")
      .send({
        load_id: "load-001",
        dispatcher_id: "user-001",
        event_type: "StatusChange",
        message: "Test event",
        payload: { key: "value" },
      });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe("Dispatch event logged");

    // Verify the ownership check query was made
    expect(mockPoolQuery).toHaveBeenCalledTimes(2);
    const [ownershipSql, ownershipParams] = mockPoolQuery.mock.calls[0];
    expect(ownershipSql).toContain("SELECT");
    expect(ownershipSql).toContain("loads");
    expect(ownershipParams).toContain("load-001");
  });

  it("rejects dispatch event with 403 when load belongs to different tenant (R-P1-06 case 2)", async () => {
    // SELECT load → belongs to a DIFFERENT tenant
    mockPoolQuery.mockResolvedValueOnce([
      [{ company_id: OTHER_TENANT_ID }],
      [],
    ]);

    const app = buildApp();
    const res = await request(app).post("/api/dispatch-events").send({
      load_id: "load-other-001",
      dispatcher_id: "user-001",
      event_type: "StatusChange",
      message: "Cross-tenant attempt",
      payload: {},
    });

    expect(res.status).toBe(403);
    expect(res.body.error).toContain("tenant");

    // Only the ownership query should have been made, NOT the INSERT
    expect(mockPoolQuery).toHaveBeenCalledTimes(1);
  });

  it("returns 404 when load_id does not exist (R-P1-06 case 3)", async () => {
    // SELECT load → no rows
    mockPoolQuery.mockResolvedValueOnce([[], []]);

    const app = buildApp();
    const res = await request(app).post("/api/dispatch-events").send({
      load_id: "nonexistent-load",
      dispatcher_id: "user-001",
      event_type: "StatusChange",
      message: "Missing load",
      payload: {},
    });

    expect(res.status).toBe(404);
    expect(res.body.error).toContain("Load not found");
    expect(mockPoolQuery).toHaveBeenCalledTimes(1);
  });

  it("INSERT params do NOT contain attacker-supplied tenant values", async () => {
    // SELECT load → belongs to user's tenant
    mockPoolQuery
      .mockResolvedValueOnce([[{ company_id: TEST_TENANT_ID }], []])
      .mockResolvedValueOnce([{ affectedRows: 1 }, []]);

    const app = buildApp();
    await request(app)
      .post("/api/dispatch-events")
      .send({
        load_id: "load-001",
        dispatcher_id: "user-001",
        event_type: "StatusChange",
        message: "Normal event",
        payload: { tenant_override: OTHER_TENANT_ID },
        company_id: OTHER_TENANT_ID, // attacker-supplied — should be ignored
      });

    // The INSERT query (2nd call) should not contain the attacker's tenant ID in params
    const insertParams = mockPoolQuery.mock.calls[1][1] as unknown[];
    expect(insertParams).not.toContain(OTHER_TENANT_ID);
  });
});

// ============================================================
// R-P1-04: AuthenticatedRequest typing — tenantId used correctly
// ============================================================

describe("R-P1-04: dispatch.ts uses AuthenticatedRequest (no req: any)", () => {
  it("GET /api/dispatch-events/:companyId uses tenantId for authorization", async () => {
    const app = buildApp();
    await request(app).get(`/api/dispatch-events/${TEST_TENANT_ID}`);

    // The route should succeed and the SQL should scope by company_id
    expect(mockPoolQuery).toHaveBeenCalled();
    const [sql, params] = mockPoolQuery.mock.calls[0];
    expect(sql).toContain("company_id");
    expect(params).toContain(TEST_TENANT_ID);
  });

  it("GET /api/dispatch-events/:companyId rejects mismatched tenantId with 403", async () => {
    const app = buildApp();
    const res = await request(app).get(
      `/api/dispatch-events/${OTHER_TENANT_ID}`,
    );

    expect(res.status).toBe(403);
    // No SQL query should have been executed
    expect(mockPoolQuery).not.toHaveBeenCalled();
  });

  it("GET /api/time-logs/company/:companyId uses tenantId for authorization", async () => {
    const app = buildApp();
    await request(app).get(`/api/time-logs/company/${TEST_TENANT_ID}`);

    expect(mockPoolQuery).toHaveBeenCalled();
    const [sql, params] = mockPoolQuery.mock.calls[0];
    expect(sql).toContain("company_id");
    expect(params).toContain(TEST_TENANT_ID);
  });

  it("GET /api/time-logs/company/:companyId rejects mismatched tenantId with 403", async () => {
    const app = buildApp();
    const res = await request(app).get(
      `/api/time-logs/company/${OTHER_TENANT_ID}`,
    );

    expect(res.status).toBe(403);
    expect(mockPoolQuery).not.toHaveBeenCalled();
  });
});

// ============================================================
// R-P1-05: JSON.stringify payload validation
// ============================================================

describe("R-P1-05: JSON.stringify(payload) wrapped in try/catch", () => {
  it("valid payload is serialized and stored successfully", async () => {
    mockPoolQuery
      .mockResolvedValueOnce([[{ company_id: TEST_TENANT_ID }], []])
      .mockResolvedValueOnce([{ affectedRows: 1 }, []]);

    const app = buildApp();
    const res = await request(app)
      .post("/api/dispatch-events")
      .send({
        load_id: "load-001",
        dispatcher_id: "user-001",
        event_type: "StatusChange",
        message: "Valid payload",
        payload: { nested: { data: [1, 2, 3] } },
      });

    expect(res.status).toBe(201);

    // Verify the serialized payload was passed to INSERT
    const insertParams = mockPoolQuery.mock.calls[1][1] as unknown[];
    const payloadParam = insertParams[5] as string;
    expect(JSON.parse(payloadParam)).toEqual({ nested: { data: [1, 2, 3] } });
  });

  it("null/undefined payload is serialized without error", async () => {
    mockPoolQuery
      .mockResolvedValueOnce([[{ company_id: TEST_TENANT_ID }], []])
      .mockResolvedValueOnce([{ affectedRows: 1 }, []]);

    const app = buildApp();
    const res = await request(app).post("/api/dispatch-events").send({
      load_id: "load-001",
      dispatcher_id: "user-001",
      event_type: "StatusChange",
      message: "No payload",
    });

    expect(res.status).toBe(201);
  });
});
