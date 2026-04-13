/**
 * Tests for POST /api/driver/exceptions and GET /api/driver/exceptions
 *
 * # Tests R-P6-01, R-P6-02, R-P6-03, R-P6-04, R-P6-05, R-P6-06, R-P6-07, R-P6-08
 *
 * Mocking strategy: mock DB driver, message repository, notification service,
 * and requireAuth middleware (architectural boundaries), never the route
 * handlers themselves.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockQuery } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
}));

const authState: { enabled: boolean; userId: string; tenantId: string } = {
  enabled: true,
  userId: "driver-1",
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

const mockMessageCreate = vi.fn();
vi.mock("../../repositories/message.repository", () => ({
  messageRepository: {
    create: (...args: any[]) => mockMessageCreate(...args),
  },
}));

const mockDeliverNotification = vi.fn();
vi.mock("../../services/notification-delivery.service", () => ({
  deliverNotification: (...args: any[]) => mockDeliverNotification(...args),
}));

import express from "express";
import request from "supertest";
import driverExceptionsRouter from "../../routes/driver-exceptions";
import { errorHandler } from "../../middleware/errorHandler";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(driverExceptionsRouter);
  app.use(errorHandler);
  return app;
}

describe("POST /api/driver/exceptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.enabled = true;
    authState.userId = "driver-1";
    authState.tenantId = "company-aaa";
    mockMessageCreate.mockResolvedValue({ id: "msg-1" });
    mockDeliverNotification.mockResolvedValue({ status: "SENT" });
  });

  // Tests R-P6-01
  it("Tests R-P6-01 -- POST creates exception with tenant_id, type from issue_type, status OPEN, entity_type LOAD", async () => {
    // Load exists check
    mockQuery.mockResolvedValueOnce([
      [{ id: "load-1", dispatcher_id: "disp-1" }],
      [],
    ]);
    // INSERT exception
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    // INSERT exception_events
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

    const app = buildApp();
    const res = await request(app)
      .post("/api/driver/exceptions")
      .set("Authorization", "Bearer valid-token")
      .send({
        issue_type: "BREAKDOWN",
        load_id: "load-1",
        description: "Flat tire on I-35",
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(typeof res.body.id).toBe("string");

    // Verify INSERT SQL: tenant_id, type from issue_type, status OPEN, entity_type LOAD
    const insertSql = mockQuery.mock.calls[1][0];
    expect(insertSql).toMatch(/INSERT INTO exceptions/i);
    const insertParams = mockQuery.mock.calls[1][1];
    expect(insertParams[1]).toBe("company-aaa"); // tenant_id
    expect(insertParams[2]).toBe("BREAKDOWN"); // type from issue_type
    expect(insertParams[3]).toBe("OPEN"); // status
    expect(insertParams[5]).toBe("LOAD"); // entity_type
    expect(insertParams[6]).toBe("load-1"); // entity_id
  });

  // Tests R-P6-02
  it("Tests R-P6-02 -- POST accepts BREAKDOWN issue type", async () => {
    mockQuery.mockResolvedValueOnce([
      [{ id: "load-1", dispatcher_id: "disp-1" }],
      [],
    ]);
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

    const app = buildApp();
    const res = await request(app)
      .post("/api/driver/exceptions")
      .set("Authorization", "Bearer valid-token")
      .send({
        issue_type: "BREAKDOWN",
        load_id: "load-1",
        description: "Engine failure",
      });

    expect(res.status).toBe(201);
    expect(mockQuery.mock.calls[1][1][2]).toBe("BREAKDOWN");
  });

  // Tests R-P6-02
  it("Tests R-P6-02 -- POST accepts DELAY_REPORTED issue type", async () => {
    mockQuery.mockResolvedValueOnce([
      [{ id: "load-1", dispatcher_id: "disp-1" }],
      [],
    ]);
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

    const app = buildApp();
    const res = await request(app)
      .post("/api/driver/exceptions")
      .set("Authorization", "Bearer valid-token")
      .send({
        issue_type: "DELAY_REPORTED",
        load_id: "load-1",
        description: "Traffic delay",
      });

    expect(res.status).toBe(201);
    expect(mockQuery.mock.calls[1][1][2]).toBe("DELAY_REPORTED");
  });

  // Tests R-P6-02
  it("Tests R-P6-02 -- POST accepts DETENTION_ELIGIBLE issue type", async () => {
    mockQuery.mockResolvedValueOnce([
      [{ id: "load-1", dispatcher_id: "disp-1" }],
      [],
    ]);
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

    const app = buildApp();
    const res = await request(app)
      .post("/api/driver/exceptions")
      .set("Authorization", "Bearer valid-token")
      .send({
        issue_type: "DETENTION_ELIGIBLE",
        load_id: "load-1",
        description: "Waiting over 2 hours",
      });

    expect(res.status).toBe(201);
    expect(mockQuery.mock.calls[1][1][2]).toBe("DETENTION_ELIGIBLE");
  });

  // Tests R-P6-02
  it("Tests R-P6-02 -- POST accepts LUMPER_REQUEST issue type", async () => {
    mockQuery.mockResolvedValueOnce([
      [{ id: "load-1", dispatcher_id: "disp-1" }],
      [],
    ]);
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

    const app = buildApp();
    const res = await request(app)
      .post("/api/driver/exceptions")
      .set("Authorization", "Bearer valid-token")
      .send({
        issue_type: "LUMPER_REQUEST",
        load_id: "load-1",
        description: "Need lumper at dock 5",
      });

    expect(res.status).toBe(201);
    expect(mockQuery.mock.calls[1][1][2]).toBe("LUMPER_REQUEST");
  });

  // Tests R-P6-02
  it("Tests R-P6-02 -- POST accepts INCIDENT_GENERAL issue type", async () => {
    mockQuery.mockResolvedValueOnce([
      [{ id: "load-1", dispatcher_id: "disp-1" }],
      [],
    ]);
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

    const app = buildApp();
    const res = await request(app)
      .post("/api/driver/exceptions")
      .set("Authorization", "Bearer valid-token")
      .send({
        issue_type: "INCIDENT_GENERAL",
        load_id: "load-1",
        description: "Minor fender bender",
      });

    expect(res.status).toBe(201);
    expect(mockQuery.mock.calls[1][1][2]).toBe("INCIDENT_GENERAL");
  });

  // Tests R-P6-03
  it("Tests R-P6-03 -- POST creates exception_events with action 'Driver Reported'", async () => {
    mockQuery.mockResolvedValueOnce([
      [{ id: "load-1", dispatcher_id: "disp-1" }],
      [],
    ]);
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

    const app = buildApp();
    const res = await request(app)
      .post("/api/driver/exceptions")
      .set("Authorization", "Bearer valid-token")
      .send({
        issue_type: "BREAKDOWN",
        load_id: "load-1",
        description: "Engine overheating",
      });

    expect(res.status).toBe(201);

    // Third query is the exception_events INSERT
    const eventSql = mockQuery.mock.calls[2][0];
    expect(eventSql).toMatch(/INSERT INTO exception_events/i);
    const eventParams = mockQuery.mock.calls[2][1];
    // eventParams: [id, exception_id, action, notes, actor_name]
    expect(eventParams[2]).toBe("Driver Reported");
    expect(eventParams[3]).toBe("Engine overheating");
    expect(eventParams[4]).toBe("driver-1");
  });

  // Tests R-P6-04
  it("Tests R-P6-04 -- POST auto-creates escalation message in load thread", async () => {
    mockQuery.mockResolvedValueOnce([
      [{ id: "load-1", dispatcher_id: "disp-1" }],
      [],
    ]);
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

    const app = buildApp();
    const res = await request(app)
      .post("/api/driver/exceptions")
      .set("Authorization", "Bearer valid-token")
      .send({
        issue_type: "DELAY_REPORTED",
        load_id: "load-1",
        description: "Weather delay",
      });

    expect(res.status).toBe(201);

    // Verify messageRepository.create was called with correct args
    expect(mockMessageCreate).toHaveBeenCalledTimes(1);
    const createArgs = mockMessageCreate.mock.calls[0];
    expect(createArgs[0].load_id).toBe("load-1");
    expect(createArgs[0].sender_id).toBe("driver-1");
    expect(createArgs[0].text).toContain("[Exception]");
    expect(createArgs[0].text).toContain("DELAY_REPORTED");
    expect(createArgs[0].text).toContain("Weather delay");
    expect(createArgs[1]).toBe("company-aaa"); // tenant_id
  });

  // Tests R-P6-05
  it("Tests R-P6-05 -- POST returns 400 for invalid issue_type", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/driver/exceptions")
      .set("Authorization", "Bearer valid-token")
      .send({
        issue_type: "INVALID_TYPE",
        load_id: "load-1",
        description: "Something",
      });

    expect(res.status).toBe(400);
    expect(res.body.error_class).toBe("VALIDATION");
    // Should not have queried the database
    expect(mockQuery).not.toHaveBeenCalled();
  });

  // Tests R-P6-05
  it("Tests R-P6-05 -- POST returns 400 when description is missing (negative test)", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/driver/exceptions")
      .set("Authorization", "Bearer valid-token")
      .send({
        issue_type: "BREAKDOWN",
        load_id: "load-1",
      });

    expect(res.status).toBe(400);
    expect(res.body.error_class).toBe("VALIDATION");
    expect(mockQuery).not.toHaveBeenCalled();
  });

  // Tests R-P6-06
  it("Tests R-P6-06 -- POST returns 404 when load not found", async () => {
    // Load not found
    mockQuery.mockResolvedValueOnce([[], []]);

    const app = buildApp();
    const res = await request(app)
      .post("/api/driver/exceptions")
      .set("Authorization", "Bearer valid-token")
      .send({
        issue_type: "BREAKDOWN",
        load_id: "nonexistent-load",
        description: "Flat tire",
      });

    expect(res.status).toBe(404);
    expect(res.body.error_class).toBe("NOT_FOUND");
    expect(res.body.message).toBe("Load not found");
    // Should have only made the load check query
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  // Tests R-P6-06
  it("Tests R-P6-06 -- POST returns 404 when load belongs to wrong tenant", async () => {
    // Load does not belong to this tenant (query returns empty)
    mockQuery.mockResolvedValueOnce([[], []]);
    authState.tenantId = "company-bbb";

    const app = buildApp();
    const res = await request(app)
      .post("/api/driver/exceptions")
      .set("Authorization", "Bearer valid-token")
      .send({
        issue_type: "BREAKDOWN",
        load_id: "load-1",
        description: "Flat tire",
      });

    expect(res.status).toBe(404);
    expect(res.body.error_class).toBe("NOT_FOUND");

    // Verify the query used the wrong tenant's company_id
    const params = mockQuery.mock.calls[0][1];
    expect(params).toContain("company-bbb");
  });

  // Tests R-P6-08
  it("Tests R-P6-08 -- POST triggers push notification to load's assigned dispatcher", async () => {
    mockQuery.mockResolvedValueOnce([
      [{ id: "load-1", dispatcher_id: "dispatcher-42" }],
      [],
    ]);
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

    const app = buildApp();
    const res = await request(app)
      .post("/api/driver/exceptions")
      .set("Authorization", "Bearer valid-token")
      .send({
        issue_type: "BREAKDOWN",
        load_id: "load-1",
        description: "Engine failure on I-40",
      });

    expect(res.status).toBe(201);

    // Verify deliverNotification was called with push channel
    expect(mockDeliverNotification).toHaveBeenCalledTimes(1);
    const notifArgs = mockDeliverNotification.mock.calls[0][0];
    expect(notifArgs.channel).toBe("push");
    expect(notifArgs.recipients).toEqual([{ id: "dispatcher-42" }]);
    expect(notifArgs.message).toContain("BREAKDOWN");
    expect(notifArgs.message).toContain("load-1");
    expect(notifArgs.message).toContain("Engine failure on I-40");
  });

  // Tests R-P6-08
  it("Tests R-P6-08 -- POST succeeds even when push notification fails (non-blocking)", async () => {
    mockQuery.mockResolvedValueOnce([
      [{ id: "load-1", dispatcher_id: "dispatcher-42" }],
      [],
    ]);
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    mockDeliverNotification.mockRejectedValueOnce(new Error("Push failed"));

    const app = buildApp();
    const res = await request(app)
      .post("/api/driver/exceptions")
      .set("Authorization", "Bearer valid-token")
      .send({
        issue_type: "BREAKDOWN",
        load_id: "load-1",
        description: "Engine failure",
      });

    // Request should still succeed
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
  });
});

describe("GET /api/driver/exceptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.enabled = true;
    authState.userId = "driver-1";
    authState.tenantId = "company-aaa";
  });

  // Tests R-P6-07
  it("Tests R-P6-07 -- GET returns user exceptions without filter", async () => {
    mockQuery.mockResolvedValueOnce([
      [
        {
          id: "exc-1",
          tenant_id: "company-aaa",
          type: "BREAKDOWN",
          status: "OPEN",
          entity_type: "LOAD",
          entity_id: "load-1",
          owner_user_id: "driver-1",
          description: "Flat tire",
          created_at: "2026-04-12T10:00:00Z",
        },
        {
          id: "exc-2",
          tenant_id: "company-aaa",
          type: "DELAY_REPORTED",
          status: "OPEN",
          entity_type: "LOAD",
          entity_id: "load-2",
          owner_user_id: "driver-1",
          description: "Traffic jam",
          created_at: "2026-04-12T09:00:00Z",
        },
      ],
      [],
    ]);

    const app = buildApp();
    const res = await request(app)
      .get("/api/driver/exceptions")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(res.body.exceptions).toHaveLength(2);
    expect(res.body.exceptions[0].id).toBe("exc-1");
    expect(res.body.exceptions[0].type).toBe("BREAKDOWN");
    expect(res.body.exceptions[1].id).toBe("exc-2");
    expect(res.body.exceptions[1].type).toBe("DELAY_REPORTED");

    // Verify tenant + user scoping in SQL
    const sql = mockQuery.mock.calls[0][0];
    expect(sql).toMatch(/tenant_id = \?/);
    expect(sql).toMatch(/owner_user_id = \?/);
    const params = mockQuery.mock.calls[0][1];
    expect(params[0]).toBe("company-aaa");
    expect(params[1]).toBe("driver-1");
  });

  // Tests R-P6-07
  it("Tests R-P6-07 -- GET returns user exceptions filtered by loadId", async () => {
    mockQuery.mockResolvedValueOnce([
      [
        {
          id: "exc-1",
          tenant_id: "company-aaa",
          type: "BREAKDOWN",
          status: "OPEN",
          entity_type: "LOAD",
          entity_id: "load-1",
          owner_user_id: "driver-1",
          description: "Flat tire",
          created_at: "2026-04-12T10:00:00Z",
        },
      ],
      [],
    ]);

    const app = buildApp();
    const res = await request(app)
      .get("/api/driver/exceptions?loadId=load-1")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(res.body.exceptions).toHaveLength(1);
    expect(res.body.exceptions[0].entity_id).toBe("load-1");

    // Verify entity_id filter in SQL
    const sql = mockQuery.mock.calls[0][0];
    expect(sql).toMatch(/entity_id = \?/);
    const params = mockQuery.mock.calls[0][1];
    expect(params).toContain("load-1");
  });

  // Tests R-P6-07
  it("Tests R-P6-07 -- GET returns empty array when no exceptions found", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);

    const app = buildApp();
    const res = await request(app)
      .get("/api/driver/exceptions")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(res.body.exceptions).toEqual([]);
  });
});
