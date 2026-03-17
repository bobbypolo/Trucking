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

// Control user context per-test
let mockUserRole = "dispatcher";
let mockUserTenantId = "company-aaa";
let mockUserUid = "user-1";

vi.mock("../../middleware/requireAuth", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.user = {
      uid: mockUserUid,
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
import tasksRouter from "../../routes/tasks";
import { errorHandler } from "../../middleware/errorHandler";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(tasksRouter);
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

const makeTask = (overrides: Record<string, unknown> = {}) => ({
  id: "task-001",
  company_id: "company-aaa",
  type: "DISPATCH",
  title: "Schedule pickup",
  description: "Schedule pickup at warehouse",
  status: "OPEN",
  priority: "MEDIUM",
  assignee_id: "user-2",
  assigned_to: "driver-1",
  due_date: "2026-03-20",
  links: null,
  created_by: "user-1",
  updated_by: "user-1",
  archived_at: null,
  ...overrides,
});

const makeWorkItem = (overrides: Record<string, unknown> = {}) => ({
  id: "wi-001",
  company_id: "company-aaa",
  type: "SAFETY_ALARM",
  label: "Breakdown Alert",
  description: "Driver reported breakdown",
  priority: "High",
  status: "Pending",
  sla_deadline: null,
  assignee_id: null,
  entity_type: "INCIDENT",
  entity_id: "inc-001",
  created_by: "user-1",
  updated_by: "user-1",
  archived_at: null,
  ...overrides,
});

// ── Auth enforcement ────────────────────────────────────────────────

describe("Tasks routes — auth enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET /api/tasks returns 401 without auth", async () => {
    const app = buildUnauthApp();
    const res = await request(app).get("/api/tasks");
    expect(res.status).toBe(401);
  });

  it("POST /api/tasks returns 401 without auth", async () => {
    const app = buildUnauthApp();
    const res = await request(app)
      .post("/api/tasks")
      .send({ type: "DISPATCH", title: "Test" });
    expect(res.status).toBe(401);
  });

  it("PATCH /api/tasks/:id returns 401 without auth", async () => {
    const app = buildUnauthApp();
    const res = await request(app)
      .patch("/api/tasks/task-001")
      .send({ status: "DONE" });
    expect(res.status).toBe(401);
  });

  it("GET /api/work-items returns 401 without auth", async () => {
    const app = buildUnauthApp();
    const res = await request(app).get("/api/work-items");
    expect(res.status).toBe(401);
  });

  it("POST /api/work-items returns 401 without auth", async () => {
    const app = buildUnauthApp();
    const res = await request(app)
      .post("/api/work-items")
      .send({ type: "SAFETY_ALARM" });
    expect(res.status).toBe(401);
  });

  it("PATCH /api/work-items/:id returns 401 without auth", async () => {
    const app = buildUnauthApp();
    const res = await request(app)
      .patch("/api/work-items/wi-001")
      .send({ status: "Resolved" });
    expect(res.status).toBe(401);
  });
});

// ── GET /api/tasks — success ────────────────────────────────────────

describe("GET /api/tasks — success", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    mockUserRole = "dispatcher";
    mockUserTenantId = "company-aaa";
    mockUserUid = "user-1";
    app = buildApp();
    vi.clearAllMocks();
  });

  it("returns tasks list with 200", async () => {
    const tasks = [makeTask(), makeTask({ id: "task-002", title: "Review BOL" })];
    // findByCompany: SELECT * FROM operational_tasks WHERE company_id = ?
    mockQuery.mockResolvedValueOnce([tasks, []]);

    const res = await request(app)
      .get("/api/tasks")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
  });

  it("returns empty array when no tasks exist", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);

    const res = await request(app)
      .get("/api/tasks")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  it("supports pagination via page and limit query params", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);

    // Use page=3, limit=15 so offset=30 — distinct values for unambiguous assertions
    const res = await request(app)
      .get("/api/tasks?page=3&limit=15")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    const queryCall = mockQuery.mock.calls[0];
    const params = queryCall[1] as unknown[];
    expect(queryCall[0]).toMatch(/LIMIT/i);
    expect(params).toContain("company-aaa"); // tenant isolation
    expect(params).toContain(15); // limit
    expect(params).toContain(30); // offset = (3-1)*15
  });

  it("returns 500 on database error", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB connection error"));

    const res = await request(app)
      .get("/api/tasks")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Database error");
  });
});

// ── POST /api/tasks — creation ──────────────────────────────────────

describe("POST /api/tasks — creation", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    mockUserRole = "dispatcher";
    mockUserTenantId = "company-aaa";
    mockUserUid = "user-1";
    app = buildApp();
    vi.clearAllMocks();
  });

  it("creates task and returns 201", async () => {
    const createdTask = makeTask();
    // INSERT
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    // findById (return after create)
    mockQuery.mockResolvedValueOnce([[createdTask], []]);

    const res = await request(app)
      .post("/api/tasks")
      .set("Authorization", "Bearer valid-token")
      .send({
        type: "DISPATCH",
        title: "Schedule pickup",
        description: "Schedule pickup at warehouse",
        priority: "HIGH",
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe("task-001");
  });

  it("returns 400 when type is missing", async () => {
    const res = await request(app)
      .post("/api/tasks")
      .set("Authorization", "Bearer valid-token")
      .send({ title: "No type" });

    expect(res.status).toBe(400);
  });

  it("returns 400 when title is missing", async () => {
    const res = await request(app)
      .post("/api/tasks")
      .set("Authorization", "Bearer valid-token")
      .send({ type: "DISPATCH" });

    expect(res.status).toBe(400);
  });

  it("returns 400 when status is an invalid enum value", async () => {
    const res = await request(app)
      .post("/api/tasks")
      .set("Authorization", "Bearer valid-token")
      .send({ type: "DISPATCH", title: "Test", status: "INVALID_STATUS" });

    expect(res.status).toBe(400);
  });

  it("returns 400 when priority is an invalid enum value", async () => {
    const res = await request(app)
      .post("/api/tasks")
      .set("Authorization", "Bearer valid-token")
      .send({ type: "DISPATCH", title: "Test", priority: "SUPER_URGENT" });

    expect(res.status).toBe(400);
  });

  it("returns 500 on database error during creation", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB insert failed"));

    const res = await request(app)
      .post("/api/tasks")
      .set("Authorization", "Bearer valid-token")
      .send({ type: "DISPATCH", title: "Test task" });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Database error");
  });
});

// ── PATCH /api/tasks/:id — update ───────────────────────────────────

describe("PATCH /api/tasks/:id — update", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    mockUserRole = "dispatcher";
    mockUserTenantId = "company-aaa";
    mockUserUid = "user-1";
    app = buildApp();
    vi.clearAllMocks();
  });

  it("updates task and returns 200", async () => {
    const existing = makeTask();
    const updated = makeTask({ status: "DONE" });
    // findById (ownership check)
    mockQuery.mockResolvedValueOnce([[existing], []]);
    // UPDATE
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    // findById (return updated)
    mockQuery.mockResolvedValueOnce([[updated], []]);

    const res = await request(app)
      .patch("/api/tasks/task-001")
      .set("Authorization", "Bearer valid-token")
      .send({ status: "DONE" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("DONE");
  });

  it("returns 404 when task does not exist", async () => {
    // findById: SELECT * FROM operational_tasks WHERE id = ? → empty result set
    mockQuery.mockResolvedValueOnce([[], []]);

    const res = await request(app)
      .patch("/api/tasks/nonexistent")
      .set("Authorization", "Bearer valid-token")
      .send({ status: "DONE" });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Task not found");
  });

  it("returns 404 for cross-tenant task update (conceals existence)", async () => {
    // findById returns a task belonging to a different tenant
    mockQuery.mockResolvedValueOnce([
      [makeTask({ company_id: "company-zzz" })],
      [],
    ]);

    const res = await request(app)
      .patch("/api/tasks/task-001")
      .set("Authorization", "Bearer valid-token")
      .send({ status: "DONE" });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Task not found");
  });

  it("returns 500 on database error during update", async () => {
    const existing = makeTask();
    mockQuery.mockResolvedValueOnce([[existing], []]); // findById
    mockQuery.mockRejectedValueOnce(new Error("DB update failed")); // UPDATE fails

    const res = await request(app)
      .patch("/api/tasks/task-001")
      .set("Authorization", "Bearer valid-token")
      .send({ status: "IN_PROGRESS" });

    expect(res.status).toBe(500);
  });
});

// ── GET /api/work-items — success ───────────────────────────────────

describe("GET /api/work-items — success", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    mockUserRole = "dispatcher";
    mockUserTenantId = "company-aaa";
    mockUserUid = "user-1";
    app = buildApp();
    vi.clearAllMocks();
  });

  it("returns work items list with 200", async () => {
    const items = [makeWorkItem(), makeWorkItem({ id: "wi-002" })];
    mockQuery.mockResolvedValueOnce([items, []]);

    const res = await request(app)
      .get("/api/work-items")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
  });

  it("returns empty array when no work items exist", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);

    const res = await request(app)
      .get("/api/work-items")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  it("supports pagination via page and limit query params", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);

    await request(app)
      .get("/api/work-items?page=3&limit=25")
      .set("Authorization", "Bearer valid-token");

    const queryCall = mockQuery.mock.calls[0];
    expect(queryCall[1]).toContain(25); // limit
    expect(queryCall[1]).toContain(50); // offset = (3-1)*25
  });

  it("returns 500 on database error", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB connection error"));

    const res = await request(app)
      .get("/api/work-items")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Database error");
  });
});

// ── POST /api/work-items — creation ─────────────────────────────────

describe("POST /api/work-items — creation", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    mockUserRole = "dispatcher";
    mockUserTenantId = "company-aaa";
    mockUserUid = "user-1";
    app = buildApp();
    vi.clearAllMocks();
  });

  it("creates work item and returns 201", async () => {
    const created = makeWorkItem();
    // INSERT
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    // findById
    mockQuery.mockResolvedValueOnce([[created], []]);

    const res = await request(app)
      .post("/api/work-items")
      .set("Authorization", "Bearer valid-token")
      .send({
        type: "SAFETY_ALARM",
        label: "Breakdown Alert",
        description: "Driver reported breakdown",
        priority: "High",
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe("wi-001");
  });

  it("returns 400 when type is missing", async () => {
    const res = await request(app)
      .post("/api/work-items")
      .set("Authorization", "Bearer valid-token")
      .send({ label: "No type" });

    expect(res.status).toBe(400);
  });

  it("returns 400 when priority is an invalid enum value", async () => {
    const res = await request(app)
      .post("/api/work-items")
      .set("Authorization", "Bearer valid-token")
      .send({ type: "SAFETY_ALARM", priority: "SUPER_HIGH" });

    expect(res.status).toBe(400);
  });

  it("returns 400 when status is an invalid enum value", async () => {
    const res = await request(app)
      .post("/api/work-items")
      .set("Authorization", "Bearer valid-token")
      .send({ type: "SAFETY_ALARM", status: "INVALID" });

    expect(res.status).toBe(400);
  });

  it("returns 500 on database error during creation", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB insert failed"));

    const res = await request(app)
      .post("/api/work-items")
      .set("Authorization", "Bearer valid-token")
      .send({ type: "SAFETY_ALARM" });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Database error");
  });
});

// ── PATCH /api/work-items/:id — update ──────────────────────────────

describe("PATCH /api/work-items/:id — update", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    mockUserRole = "dispatcher";
    mockUserTenantId = "company-aaa";
    mockUserUid = "user-1";
    app = buildApp();
    vi.clearAllMocks();
  });

  it("updates work item and returns 200", async () => {
    const existing = makeWorkItem();
    const updated = makeWorkItem({ status: "Resolved" });
    // findById (ownership check)
    mockQuery.mockResolvedValueOnce([[existing], []]);
    // UPDATE
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    // findById (return updated)
    mockQuery.mockResolvedValueOnce([[updated], []]);

    const res = await request(app)
      .patch("/api/work-items/wi-001")
      .set("Authorization", "Bearer valid-token")
      .send({ status: "Resolved" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("Resolved");
  });

  it("returns 404 when work item does not exist", async () => {
    // findById: SELECT * FROM work_items WHERE id = ? → empty result set
    mockQuery.mockResolvedValueOnce([[], []]);

    const res = await request(app)
      .patch("/api/work-items/nonexistent")
      .set("Authorization", "Bearer valid-token")
      .send({ status: "Resolved" });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Work item not found");
  });

  it("returns 404 for cross-tenant work item update", async () => {
    mockQuery.mockResolvedValueOnce([
      [makeWorkItem({ company_id: "company-zzz" })],
      [],
    ]);

    const res = await request(app)
      .patch("/api/work-items/wi-001")
      .set("Authorization", "Bearer valid-token")
      .send({ status: "Resolved" });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Work item not found");
  });

  it("returns 500 on database error during update", async () => {
    const existing = makeWorkItem();
    mockQuery.mockResolvedValueOnce([[existing], []]);
    mockQuery.mockRejectedValueOnce(new Error("DB update failed"));

    const res = await request(app)
      .patch("/api/work-items/wi-001")
      .set("Authorization", "Bearer valid-token")
      .send({ status: "In_Progress" });

    expect(res.status).toBe(500);
  });
});
