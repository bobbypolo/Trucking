import { describe, it, expect, vi, beforeEach } from "vitest";

// Tests R-P1-13, R-P1-14, R-P1-15

// Hoisted mocks — must be declared before any imports
const { mockQuery, mockResolveSqlPrincipalByFirebaseUid } = vi.hoisted(() => {
  const mockQuery = vi.fn();
  const mockResolveSqlPrincipalByFirebaseUid = vi.fn();
  return { mockQuery, mockResolveSqlPrincipalByFirebaseUid };
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

vi.mock("firebase-admin", () => {
  const mockAuth = {
    verifyIdToken: vi.fn().mockResolvedValue({ uid: "firebase-uid-1" }),
  };
  return {
    default: {
      app: vi.fn(),
      auth: () => mockAuth,
    },
  };
});

vi.mock("../../lib/sql-auth", () => ({
  resolveSqlPrincipalByFirebaseUid: mockResolveSqlPrincipalByFirebaseUid,
}));

import express from "express";
import request from "supertest";
import notificationJobsRouter from "../../routes/notification-jobs";
import { errorHandler } from "../../middleware/errorHandler";
import { DEFAULT_SQL_PRINCIPAL } from "../helpers/mock-sql-auth";

mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(DEFAULT_SQL_PRINCIPAL);

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(notificationJobsRouter);
  app.use(errorHandler);
  return app;
}

// ── GET /api/notification-jobs — auth enforcement ────────────────────────────

describe("GET /api/notification-jobs — auth enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
  });

  it("returns 401 when no auth token is provided", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/notification-jobs");
    expect(res.status).toBe(401);
  });

  it("returns 401 when user has no linked SQL account", async () => {
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(null);
    const app = buildApp();
    const res = await request(app)
      .get("/api/notification-jobs")
      .set("Authorization", "Bearer valid-token");
    expect(res.status).toBe(401);
  });
});

// ── GET /api/notification-jobs — R-P1-13 ─────────────────────────────────────

describe("GET /api/notification-jobs — R-P1-13: returns 200 with JSON array for authenticated tenant", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
    app = buildApp();
  });

  it("returns 200 with an array of notification jobs for the tenant", async () => {
    const jobs = [
      {
        id: "job-001",
        company_id: "company-aaa",
        message: "Driver needed",
        channel: "SMS",
        status: "PENDING",
        sent_by: "user-1",
        sent_at: "2026-03-18T10:00:00.000Z",
        recipients: JSON.stringify([
          { id: "d-1", name: "John", role: "driver", phone: "555-1234" },
        ]),
      },
      {
        id: "job-002",
        company_id: "company-aaa",
        message: "Load update",
        channel: "Email",
        status: "SENT",
        sent_by: "user-1",
        sent_at: "2026-03-18T11:00:00.000Z",
        recipients: JSON.stringify([]),
      },
    ];
    mockQuery.mockResolvedValueOnce([jobs, []]);

    const res = await request(app)
      .get("/api/notification-jobs")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].id).toBe("job-001");
    expect(res.body[1].id).toBe("job-002");
  });

  it("returns 200 with empty array when no jobs exist", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);

    const res = await request(app)
      .get("/api/notification-jobs")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(0);
  });

  it("returns 500 on database error", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB connection failed"));

    const res = await request(app)
      .get("/api/notification-jobs")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(500);
  });
});

// ── POST /api/notification-jobs — R-P1-14 ────────────────────────────────────

describe("POST /api/notification-jobs — R-P1-14: creates job and returns 201", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
    app = buildApp();
  });

  const validJobPayload = {
    message: "Urgent: driver needed for load LAX-001",
    channel: "SMS",
    status: "PENDING",
    sentBy: "user-1",
    sentAt: "2026-03-18T10:00:00.000Z",
    recipients: [
      { id: "d-1", name: "Jane", role: "driver", phone: "555-9876" },
    ],
  };

  it("returns 201 when valid job is created", async () => {
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

    const res = await request(app)
      .post("/api/notification-jobs")
      .set("Authorization", "Bearer valid-token")
      .send(validJobPayload);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("id");
    expect(res.body.message).toBe(validJobPayload.message);
    expect(res.body.channel).toBe("SMS");
  });

  it("returns 400 when message is missing", async () => {
    const { message: _, ...withoutMessage } = validJobPayload;
    const res = await request(app)
      .post("/api/notification-jobs")
      .set("Authorization", "Bearer valid-token")
      .send(withoutMessage);

    expect(res.status).toBe(400);
  });

  it("returns 400 when channel is missing", async () => {
    const { channel: _, ...withoutChannel } = validJobPayload;
    const res = await request(app)
      .post("/api/notification-jobs")
      .set("Authorization", "Bearer valid-token")
      .send(withoutChannel);

    expect(res.status).toBe(400);
  });

  it("returns 401 when not authenticated", async () => {
    const res = await request(app)
      .post("/api/notification-jobs")
      .send(validJobPayload);

    expect(res.status).toBe(401);
  });

  it("returns 500 on database error", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB insert failed"));

    const res = await request(app)
      .post("/api/notification-jobs")
      .set("Authorization", "Bearer valid-token")
      .send(validJobPayload);

    expect(res.status).toBe(500);
  });
});

// ── Cross-tenant isolation — R-P1-15 ─────────────────────────────────────────

describe("Cross-tenant access — R-P1-15: returns 404 for cross-tenant access", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
    app = buildApp();
  });

  it("GET does not return jobs belonging to a different tenant", async () => {
    // DB returns jobs for company-aaa only (parameterized query enforces this)
    // We validate the query is called with the correct company_id
    mockQuery.mockResolvedValueOnce([[], []]);

    const res = await request(app)
      .get("/api/notification-jobs")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    // Verify DB was called with tenant-scoped parameter
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("company_id"),
      expect.arrayContaining(["company-aaa"]),
    );
  });

  it("GET /:id returns 404 when job belongs to a different tenant", async () => {
    // Job exists but belongs to company-bbb (different tenant)
    const foreignJob = {
      id: "job-cross",
      company_id: "company-bbb",
      message: "Other tenant's job",
      channel: "SMS",
      status: "PENDING",
      sent_by: "user-x",
      sent_at: "2026-03-18T10:00:00.000Z",
      recipients: "[]",
    };
    mockQuery.mockResolvedValueOnce([[foreignJob], []]);

    const res = await request(app)
      .get("/api/notification-jobs/job-cross")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(404);
  });
});
