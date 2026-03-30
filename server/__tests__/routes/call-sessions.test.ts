import { describe, it, expect, vi, beforeEach } from "vitest";

// Tests R-P0-02, R-P5-02-AC5, R-P5-02-AC6

const {
  mockFindByCompany,
  mockFindById,
  mockCreate,
  mockUpdate,
  mockDelete,
  mockResolveSqlPrincipalByFirebaseUid,
} = vi.hoisted(() => ({
  mockFindByCompany: vi.fn(),
  mockFindById: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
  mockResolveSqlPrincipalByFirebaseUid: vi.fn(),
}));

vi.mock("../../repositories/call-session.repository", () => ({
  callSessionRepository: {
    findByCompany: mockFindByCompany,
    findById: mockFindById,
    create: mockCreate,
    update: mockUpdate,
    delete: mockDelete,
  },
}));

vi.mock("../../lib/logger", () => ({
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
  const mockFirestore = {
    collection: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({
            empty: false,
            docs: [
              {
                id: "user-1",
                data: () => ({
                  id: "user-1",
                  company_id: "company-aaa",
                  role: "dispatcher",
                  email: "test@test.com",
                }),
              },
            ],
          }),
        }),
      }),
    }),
  };
  return {
    default: {
      app: vi.fn(),
      auth: () => mockAuth,
      firestore: () => mockFirestore,
    },
  };
});

vi.mock("../../lib/sql-auth", () => ({
  resolveSqlPrincipalByFirebaseUid: mockResolveSqlPrincipalByFirebaseUid,
}));

import express from "express";
import request from "supertest";
import callSessionsRouter from "../../routes/call-sessions";
import { errorHandler } from "../../middleware/errorHandler";
import { DEFAULT_SQL_PRINCIPAL } from "../helpers/mock-sql-auth";

mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(DEFAULT_SQL_PRINCIPAL);

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(callSessionsRouter);
  app.use(errorHandler);
  return app;
}

const AUTH_HEADER = "Bearer valid-firebase-token";

const makeSession = (overrides = {}) => ({
  id: "call-001",
  company_id: "company-aaa",
  start_time: "2026-03-08T10:00:00.000Z",
  end_time: null,
  duration_seconds: 0,
  status: "active",
  assigned_to: "user-001",
  team: "dispatch",
  last_activity_at: "2026-03-08T10:00:00.000Z",
  notes: null,
  participants: null,
  links: null,
  created_at: "2026-03-08T10:00:00.000Z",
  ...overrides,
});

describe("GET /api/call-sessions — authentication", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    app = buildApp();
    vi.clearAllMocks();
  });

  it("returns 401 without Authorization header", async () => {
    const res = await request(app).get("/api/call-sessions");
    expect(res.status).toBe(401);
  });
});

describe("GET /api/call-sessions", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    app = buildApp();
    vi.clearAllMocks();
  });

  it("returns sessions for authenticated tenant", async () => {
    const sessions = [makeSession(), makeSession({ id: "call-002" })];
    mockFindByCompany.mockResolvedValueOnce(sessions);

    const res = await request(app)
      .get("/api/call-sessions")
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("sessions");
    expect(res.body.sessions).toHaveLength(2);
  });

  it("returns empty array when no sessions for tenant", async () => {
    mockFindByCompany.mockResolvedValueOnce([]);

    const res = await request(app)
      .get("/api/call-sessions")
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.sessions).toHaveLength(0);
  });

  it("returns 500 on database error", async () => {
    mockFindByCompany.mockRejectedValueOnce(new Error("DB error"));

    const res = await request(app)
      .get("/api/call-sessions")
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(500);
  });
});

describe("POST /api/call-sessions", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    app = buildApp();
    vi.clearAllMocks();
  });

  it("returns 401 without Authorization header", async () => {
    const res = await request(app)
      .post("/api/call-sessions")
      .send({ status: "active" });
    expect(res.status).toBe(401);
  });

  it("creates a call session and returns 201", async () => {
    const newSession = makeSession({ id: "call-new" });
    mockCreate.mockResolvedValueOnce(newSession);

    const res = await request(app)
      .post("/api/call-sessions")
      .set("Authorization", AUTH_HEADER)
      .send({ status: "active", assigned_to: "user-001" });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("session");
    expect(res.body.session.id).toBe("call-new");
  });

  it("returns 500 on database error", async () => {
    mockCreate.mockRejectedValueOnce(new Error("DB error"));

    const res = await request(app)
      .post("/api/call-sessions")
      .set("Authorization", AUTH_HEADER)
      .send({ status: "active" });

    expect(res.status).toBe(500);
  });
});

describe("PUT /api/call-sessions/:id", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    app = buildApp();
    vi.clearAllMocks();
  });

  it("returns 401 without Authorization header", async () => {
    const res = await request(app)
      .put("/api/call-sessions/call-001")
      .send({ status: "completed" });
    expect(res.status).toBe(401);
  });

  it("updates a session and returns 200", async () => {
    const updatedSession = makeSession({ status: "completed" });
    mockUpdate.mockResolvedValueOnce(updatedSession);

    const res = await request(app)
      .put("/api/call-sessions/call-001")
      .set("Authorization", AUTH_HEADER)
      .send({ status: "completed", duration_seconds: 300 });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("session");
    expect(res.body.session.status).toBe("completed");
  });

  it("returns 404 when session not found", async () => {
    mockUpdate.mockResolvedValueOnce(null);

    const res = await request(app)
      .put("/api/call-sessions/nonexistent")
      .set("Authorization", AUTH_HEADER)
      .send({ status: "completed" });

    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/call-sessions/:id", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    app = buildApp();
    vi.clearAllMocks();
  });

  it("returns 401 without Authorization header", async () => {
    const res = await request(app).delete("/api/call-sessions/call-001");
    expect(res.status).toBe(401);
  });

  it("returns 204 on successful delete", async () => {
    mockDelete.mockResolvedValueOnce(true);

    const res = await request(app)
      .delete("/api/call-sessions/call-001")
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(204);
  });

  it("returns 404 when session not found", async () => {
    mockDelete.mockResolvedValueOnce(false);

    const res = await request(app)
      .delete("/api/call-sessions/nonexistent")
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(404);
  });
});
