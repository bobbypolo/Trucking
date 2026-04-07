import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Change Request endpoints on loads route.
 *
 * POST /api/loads/:id/change-requests — create a change request (work_item)
 * GET  /api/loads/:id/change-requests — list change requests for a load
 */

const { mockQuery } = vi.hoisted(() => {
  const mockQuery = vi.fn();
  return { mockQuery };
});

vi.mock("../../db", () => ({
  default: {
    query: mockQuery,
    getConnection: vi.fn(),
  },
}));

vi.mock("../../helpers", () => ({
  redactData: vi.fn((d: any) => d),
  getVisibilitySettings: vi.fn().mockResolvedValue({}),
  sendNotification: vi.fn().mockResolvedValue(undefined),
  checkBreakdownLateness: vi.fn(),
}));

vi.mock("../../middleware/requireAuth", () => ({
  requireAuth: (_req: any, _res: any, next: any) => {
    _req.user = { uid: "driver-001", tenantId: "company-001" };
    next();
  },
}));

vi.mock("../../middleware/requireTenant", () => ({
  requireTenant: (_req: any, _res: any, next: any) => next(),
}));

vi.mock("../../middleware/validate", () => ({
  validateBody: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock("../../middleware/idempotency", () => ({
  idempotencyMiddleware: () => (_req: any, _res: any, next: any) => next(),
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

vi.mock("../../services/load.service", () => ({
  loadService: {
    transition: vi.fn(),
  },
}));

vi.mock("../../services/load-state-machine", () => ({
  LoadStatus: {},
}));

vi.mock("../../services/geocoding.service", () => ({
  geocodeStopAddress: vi.fn().mockResolvedValue(null),
}));

vi.mock("../../schemas/loads", () => ({
  createLoadSchema: { parse: vi.fn((d: any) => d) },
  partialUpdateLoadSchema: { parse: vi.fn((d: any) => d) },
  updateLoadStatusSchema: { parse: vi.fn((d: any) => d) },
}));

import express from "express";
import request from "supertest";

let app: express.Application;

beforeEach(async () => {
  vi.clearAllMocks();
  // Import fresh router for each test
  const mod = await import("../../routes/loads");
  app = express();
  app.use(express.json());
  app.use(mod.default);
});

describe("POST /api/loads/:id/change-requests", () => {
  it("creates a change request as a work_item and returns 201", async () => {
    // Mock: load exists for this tenant
    mockQuery
      .mockResolvedValueOnce([[{ id: "load-001", company_id: "company-001" }]])
      // INSERT into work_items
      .mockResolvedValueOnce([{ insertId: 0 }])
      // SELECT back the inserted row
      .mockResolvedValueOnce([
        [
          {
            id: "wi-001",
            company_id: "company-001",
            type: "CHANGE_REQUEST",
            priority: "Medium",
            label: "DETENTION",
            description: "",
            entity_id: "load-001",
            entity_type: "load",
            status: "PENDING",
            due_date: null,
            created_at: "2026-03-23T00:00:00Z",
          },
        ],
      ]);

    const res = await request(app)
      .post("/api/loads/load-001/change-requests")
      .send({ type: "DETENTION", notes: "Waited 3 hours", isUrgent: false });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("id");
    expect(res.body.type).toBe("CHANGE_REQUEST");
    expect(res.body.label).toBe("DETENTION");
    expect(res.body.status).toBe("PENDING");
  });

  it("returns 404 if load does not exist", async () => {
    mockQuery.mockResolvedValueOnce([[]]);

    const res = await request(app)
      .post("/api/loads/nonexistent/change-requests")
      .send({ type: "LUMPER", notes: "" });

    expect(res.status).toBe(404);
  });

  it("returns 400 if type is missing", async () => {
    const res = await request(app)
      .post("/api/loads/load-001/change-requests")
      .send({ notes: "no type" });

    expect(res.status).toBe(400);
  });
});

describe("GET /api/loads/:id/change-requests", () => {
  it("returns change requests for the load", async () => {
    // Mock: load exists
    mockQuery
      .mockResolvedValueOnce([[{ id: "load-001", company_id: "company-001" }]])
      // SELECT work_items
      .mockResolvedValueOnce([
        [
          {
            id: "wi-001",
            company_id: "company-001",
            type: "CHANGE_REQUEST",
            label: "DETENTION",
            status: "PENDING",
            entity_id: "load-001",
            entity_type: "load",
            created_at: "2026-03-23T00:00:00Z",
          },
          {
            id: "wi-002",
            company_id: "company-001",
            type: "CHANGE_REQUEST",
            label: "LUMPER",
            status: "APPROVED",
            entity_id: "load-001",
            entity_type: "load",
            created_at: "2026-03-23T01:00:00Z",
          },
        ],
      ]);

    const res = await request(app).get("/api/loads/load-001/change-requests");

    expect(res.status).toBe(200);
    expect(res.body.changeRequests).toHaveLength(2);
    expect(res.body.changeRequests[0].label).toBe("DETENTION");
    expect(res.body.changeRequests[1].status).toBe("APPROVED");
  });

  it("returns 404 if load does not exist", async () => {
    mockQuery.mockResolvedValueOnce([[]]);

    const res = await request(app).get(
      "/api/loads/nonexistent/change-requests",
    );

    expect(res.status).toBe(404);
  });
});
