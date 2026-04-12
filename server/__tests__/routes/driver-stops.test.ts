/**
 * Tests for GET /api/loads/:loadId/stops and PATCH /api/loads/:loadId/stops/:stopId
 *
 * Mocking strategy: mock DB driver and requireAuth middleware (architectural
 * boundaries), never the route handlers themselves.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockQuery } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
}));

const authState: { enabled: boolean; userId: string; tenantId: string } = {
  enabled: true,
  userId: "user-1",
  tenantId: "company-aaa",
};

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

vi.mock("../../middleware/requireAuth", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    if (!authState.enabled) {
      return _res.status(401).json({ error: "Authentication required." });
    }
    req.user = {
      id: authState.userId,
      uid: authState.userId,
      tenantId: authState.tenantId,
      companyId: authState.tenantId,
      role: "driver",
      email: "driver@example.com",
      firebaseUid: "firebase-uid-1",
    };
    next();
  },
}));

vi.mock("../../middleware/requireTenant", () => ({
  requireTenant: (req: any, _res: any, next: any) => {
    if (!req.user) {
      return _res
        .status(403)
        .json({ error: "Tenant verification requires authentication." });
    }
    next();
  },
}));

vi.mock("../../lib/sentry", () => ({
  captureException: vi.fn(),
}));

import express from "express";
import request from "supertest";
import driverStopsRouter from "../../routes/driver-stops";
import { errorHandler } from "../../middleware/errorHandler";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(driverStopsRouter);
  app.use(errorHandler);
  return app;
}

describe("GET /api/loads/:loadId/stops", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.enabled = true;
    authState.userId = "user-1";
    authState.tenantId = "company-aaa";
  });

  // Tests R-P4-01
  it("Tests R-P4-01 -- returns stops ordered by sequence_order, tenant-scoped", async () => {
    // First query: load exists check
    mockQuery.mockResolvedValueOnce([[{ id: "load-1" }], []]);
    // Second query: fetch stops
    mockQuery.mockResolvedValueOnce([
      [
        {
          id: "stop-1",
          load_id: "load-1",
          type: "Pickup",
          facility_name: "Warehouse A",
          city: "Dallas",
          state: "TX",
          date: "2026-04-15",
          appointment_time: "08:00",
          completed: false,
          sequence_order: 1,
          status: "pending",
          arrived_at: null,
          departed_at: null,
        },
        {
          id: "stop-2",
          load_id: "load-1",
          type: "Dropoff",
          facility_name: "Distribution Center B",
          city: "Houston",
          state: "TX",
          date: "2026-04-16",
          appointment_time: "14:00",
          completed: false,
          sequence_order: 2,
          status: "pending",
          arrived_at: null,
          departed_at: null,
        },
        {
          id: "stop-3",
          load_id: "load-1",
          type: "Dropoff",
          facility_name: "Customer C",
          city: "Austin",
          state: "TX",
          date: "2026-04-17",
          appointment_time: "10:00",
          completed: false,
          sequence_order: 3,
          status: "pending",
          arrived_at: null,
          departed_at: null,
        },
      ],
      [],
    ]);

    const app = buildApp();
    const res = await request(app)
      .get("/api/loads/load-1/stops")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(res.body.stops).toHaveLength(3);
    expect(res.body.stops[0].sequence_order).toBe(1);
    expect(res.body.stops[1].sequence_order).toBe(2);
    expect(res.body.stops[2].sequence_order).toBe(3);
    expect(res.body.stops[0].facility_name).toBe("Warehouse A");
    expect(res.body.stops[2].facility_name).toBe("Customer C");

    // Verify tenant scoping: first query checks company_id
    const loadCheckSql = mockQuery.mock.calls[0][0];
    expect(loadCheckSql).toMatch(/SELECT\s+id\s+FROM\s+loads/i);
    const loadCheckParams = mockQuery.mock.calls[0][1];
    expect(loadCheckParams).toContain("load-1");
    expect(loadCheckParams).toContain("company-aaa");

    // Verify second query orders by sequence_order
    const stopsSql = mockQuery.mock.calls[1][0];
    expect(stopsSql).toMatch(/ORDER BY.*sequence_order\s+ASC/i);
  });

  // Tests R-P4-02
  it("Tests R-P4-02 -- returns 404 when load not found", async () => {
    // Load does not exist
    mockQuery.mockResolvedValueOnce([[], []]);

    const app = buildApp();
    const res = await request(app)
      .get("/api/loads/nonexistent-load/stops")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(404);
    expect(res.body.error_class).toBe("NOT_FOUND");
    expect(res.body.message).toBe("Load not found");
    // Should not make a second query for stops
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  // Tests R-P4-02
  it("Tests R-P4-02 -- returns 404 when load belongs to wrong tenant", async () => {
    // Load exists but the company_id check with tenant filter returns empty
    mockQuery.mockResolvedValueOnce([[], []]);

    authState.tenantId = "company-bbb";

    const app = buildApp();
    const res = await request(app)
      .get("/api/loads/load-1/stops")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(404);
    expect(res.body.error_class).toBe("NOT_FOUND");
    // Verify the query used the wrong tenant's company_id
    const params = mockQuery.mock.calls[0][1];
    expect(params).toContain("company-bbb");
  });
});

describe("PATCH /api/loads/:loadId/stops/:stopId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.enabled = true;
    authState.userId = "user-1";
    authState.tenantId = "company-aaa";
  });

  // Tests R-P4-03
  it("Tests R-P4-03 -- updates status field", async () => {
    // Stop exists check
    mockQuery.mockResolvedValueOnce([[{ id: "stop-1" }], []]);
    // UPDATE query
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    // Fetch updated stop
    mockQuery.mockResolvedValueOnce([
      [
        {
          id: "stop-1",
          load_id: "load-1",
          type: "Pickup",
          facility_name: "Warehouse A",
          city: "Dallas",
          state: "TX",
          date: "2026-04-15",
          appointment_time: "08:00",
          completed: false,
          sequence_order: 1,
          status: "arrived",
          arrived_at: null,
          departed_at: null,
        },
      ],
      [],
    ]);

    const app = buildApp();
    const res = await request(app)
      .patch("/api/loads/load-1/stops/stop-1")
      .set("Authorization", "Bearer valid-token")
      .send({ status: "arrived" });

    expect(res.status).toBe(200);
    expect(res.body.stop.status).toBe("arrived");
    expect(res.body.stop.id).toBe("stop-1");

    // Verify UPDATE SQL includes status
    const updateSql = mockQuery.mock.calls[1][0];
    expect(updateSql).toMatch(/UPDATE\s+load_legs\s+SET/i);
    expect(updateSql).toContain("status = ?");
    const updateParams = mockQuery.mock.calls[1][1];
    expect(updateParams).toContain("arrived");
  });

  // Tests R-P4-03
  it("Tests R-P4-03 -- updates arrived_at timestamp", async () => {
    mockQuery.mockResolvedValueOnce([[{ id: "stop-1" }], []]);
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    mockQuery.mockResolvedValueOnce([
      [
        {
          id: "stop-1",
          load_id: "load-1",
          type: "Pickup",
          facility_name: "Warehouse A",
          city: "Dallas",
          state: "TX",
          date: "2026-04-15",
          appointment_time: "08:00",
          completed: false,
          sequence_order: 1,
          status: "arrived",
          arrived_at: "2026-04-15T08:30:00Z",
          departed_at: null,
        },
      ],
      [],
    ]);

    const app = buildApp();
    const res = await request(app)
      .patch("/api/loads/load-1/stops/stop-1")
      .set("Authorization", "Bearer valid-token")
      .send({ arrived_at: "2026-04-15T08:30:00Z" });

    expect(res.status).toBe(200);
    expect(res.body.stop.arrived_at).toBe("2026-04-15T08:30:00Z");

    const updateSql = mockQuery.mock.calls[1][0];
    expect(updateSql).toContain("arrived_at = ?");
    const updateParams = mockQuery.mock.calls[1][1];
    expect(updateParams).toContain("2026-04-15T08:30:00Z");
  });

  // Tests R-P4-03
  it("Tests R-P4-03 -- updates departed_at and completed together", async () => {
    mockQuery.mockResolvedValueOnce([[{ id: "stop-1" }], []]);
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    mockQuery.mockResolvedValueOnce([
      [
        {
          id: "stop-1",
          load_id: "load-1",
          type: "Pickup",
          facility_name: "Warehouse A",
          city: "Dallas",
          state: "TX",
          date: "2026-04-15",
          appointment_time: "08:00",
          completed: true,
          sequence_order: 1,
          status: "departed",
          arrived_at: "2026-04-15T08:30:00Z",
          departed_at: "2026-04-15T10:00:00Z",
        },
      ],
      [],
    ]);

    const app = buildApp();
    const res = await request(app)
      .patch("/api/loads/load-1/stops/stop-1")
      .set("Authorization", "Bearer valid-token")
      .send({ departed_at: "2026-04-15T10:00:00Z", completed: true });

    expect(res.status).toBe(200);
    expect(res.body.stop.departed_at).toBe("2026-04-15T10:00:00Z");
    expect(res.body.stop.completed).toBe(true);

    const updateSql = mockQuery.mock.calls[1][0];
    expect(updateSql).toContain("departed_at = ?");
    expect(updateSql).toContain("completed = ?");
    const updateParams = mockQuery.mock.calls[1][1];
    expect(updateParams).toContain("2026-04-15T10:00:00Z");
    expect(updateParams).toContain(true);
  });

  // Tests R-P4-04
  it("Tests R-P4-04 -- returns 404 when stop not found", async () => {
    // Stop does not exist
    mockQuery.mockResolvedValueOnce([[], []]);

    const app = buildApp();
    const res = await request(app)
      .patch("/api/loads/load-1/stops/nonexistent-stop")
      .set("Authorization", "Bearer valid-token")
      .send({ status: "arrived" });

    expect(res.status).toBe(404);
    expect(res.body.error_class).toBe("NOT_FOUND");
    expect(res.body.message).toBe("Stop not found");
    // Should only have made the existence check query
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  // Tests R-P4-04
  it("Tests R-P4-04 -- returns 404 when stop belongs to wrong tenant", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);
    authState.tenantId = "company-bbb";

    const app = buildApp();
    const res = await request(app)
      .patch("/api/loads/load-1/stops/stop-1")
      .set("Authorization", "Bearer valid-token")
      .send({ status: "arrived" });

    expect(res.status).toBe(404);
    expect(res.body.error_class).toBe("NOT_FOUND");

    // Verify the check query included the wrong tenant
    const checkParams = mockQuery.mock.calls[0][1];
    expect(checkParams).toContain("company-bbb");
  });

  // Tests R-P4-05
  it("Tests R-P4-05 -- returns 400 when body is empty (no fields provided)", async () => {
    const app = buildApp();
    const res = await request(app)
      .patch("/api/loads/load-1/stops/stop-1")
      .set("Authorization", "Bearer valid-token")
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error_class).toBe("VALIDATION");
    // Should not have queried the database at all
    expect(mockQuery).not.toHaveBeenCalled();
  });

  // Tests R-P4-05
  it("Tests R-P4-05 -- returns 400 when status has invalid value (negative test)", async () => {
    const app = buildApp();
    const res = await request(app)
      .patch("/api/loads/load-1/stops/stop-1")
      .set("Authorization", "Bearer valid-token")
      .send({ status: "invalid_status" });

    expect(res.status).toBe(400);
    expect(res.body.error_class).toBe("VALIDATION");
    expect(mockQuery).not.toHaveBeenCalled();
  });

  // Tests R-P4-05
  it("Tests R-P4-05 -- returns 400 when arrived_at is not a valid ISO datetime (negative test)", async () => {
    const app = buildApp();
    const res = await request(app)
      .patch("/api/loads/load-1/stops/stop-1")
      .set("Authorization", "Bearer valid-token")
      .send({ arrived_at: "not-a-date" });

    expect(res.status).toBe(400);
    expect(res.body.error_class).toBe("VALIDATION");
    expect(mockQuery).not.toHaveBeenCalled();
  });
});
