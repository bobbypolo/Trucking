/**
 * Tests R-P2-01, R-P2-02, R-P2-03, R-P2-04, R-P2-05, R-P2-07
 *
 * Message threading and read-state route tests.
 * Validates POST /api/threads, GET /api/threads, GET /api/threads/:id/messages,
 * PATCH /api/messages/:id/read, and POST /api/messages with thread_id.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockFindByCompany,
  mockFindById,
  mockCreate,
  mockDelete,
  mockCreateThread,
  mockFindThreadsByCompany,
  mockFindByThread,
  mockMarkRead,
  mockResolveSqlPrincipalByFirebaseUid,
} = vi.hoisted(() => ({
  mockFindByCompany: vi.fn(),
  mockFindById: vi.fn(),
  mockCreate: vi.fn(),
  mockDelete: vi.fn(),
  mockCreateThread: vi.fn(),
  mockFindThreadsByCompany: vi.fn(),
  mockFindByThread: vi.fn(),
  mockMarkRead: vi.fn(),
  mockResolveSqlPrincipalByFirebaseUid: vi.fn(),
}));

vi.mock("../../repositories/message.repository", () => ({
  messageRepository: {
    findByCompany: mockFindByCompany,
    findById: mockFindById,
    create: mockCreate,
    delete: mockDelete,
    createThread: mockCreateThread,
    findThreadsByCompany: mockFindThreadsByCompany,
    findByThread: mockFindByThread,
    markRead: mockMarkRead,
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
import messagesRouter from "../../routes/messages";
import { errorHandler } from "../../middleware/errorHandler";
import { DEFAULT_SQL_PRINCIPAL } from "../helpers/mock-sql-auth";

mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(DEFAULT_SQL_PRINCIPAL);

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(messagesRouter);
  app.use(errorHandler);
  return app;
}

const AUTH_HEADER = "Bearer valid-firebase-token";

const makeThread = (overrides = {}) => ({
  id: "thread-001",
  company_id: "company-aaa",
  title: "Load discussion",
  load_id: "load-001",
  participant_ids: JSON.stringify(["user-001", "user-002"]),
  status: "Active",
  owner_id: null,
  record_links: null,
  created_at: "2026-04-12T10:00:00.000Z",
  updated_at: "2026-04-12T10:00:00.000Z",
  created_by: null,
  ...overrides,
});

const makeMessage = (overrides = {}) => ({
  id: "msg-001",
  company_id: "company-aaa",
  load_id: "load-001",
  thread_id: "thread-001",
  sender_id: "user-001",
  sender_name: "Driver Joe",
  text: "ETA 30 minutes",
  timestamp: "2026-04-12T10:05:00.000Z",
  attachments: null,
  read_at: null,
  ...overrides,
});

/* ── R-P2-01: POST /api/threads ── */

describe("POST /api/threads", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    app = buildApp();
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
  });

  it("Tests R-P2-01 — creates thread with company_id, participant_ids, optional load_id and returns 201", async () => {
    const thread = makeThread();
    mockCreateThread.mockResolvedValueOnce(thread);

    const res = await request(app)
      .post("/api/threads")
      .set("Authorization", AUTH_HEADER)
      .send({
        title: "Load discussion",
        load_id: "load-001",
        participant_ids: ["user-001", "user-002"],
      });

    expect(res.status).toBe(201);
    expect(res.body.thread.id).toBe("thread-001");
    expect(res.body.thread.company_id).toBe("company-aaa");
    expect(res.body.thread.participant_ids).toBe(
      JSON.stringify(["user-001", "user-002"]),
    );
    expect(res.body.thread.load_id).toBe("load-001");
    expect(mockCreateThread).toHaveBeenCalledWith(
      {
        title: "Load discussion",
        load_id: "load-001",
        participant_ids: ["user-001", "user-002"],
      },
      "company-aaa",
    );
  });

  it("Tests R-P2-01 — creates thread without load_id (optional) and returns 201", async () => {
    const thread = makeThread({ load_id: null });
    mockCreateThread.mockResolvedValueOnce(thread);

    const res = await request(app)
      .post("/api/threads")
      .set("Authorization", AUTH_HEADER)
      .send({
        participant_ids: ["user-001"],
      });

    expect(res.status).toBe(201);
    expect(res.body.thread.load_id).toBeNull();
  });

  it("Tests R-P2-01 — returns 400 when participant_ids is missing", async () => {
    const res = await request(app)
      .post("/api/threads")
      .set("Authorization", AUTH_HEADER)
      .send({ title: "No participants" });

    expect(res.status).toBe(400);
  });

  it("Tests R-P2-01 — returns 400 when participant_ids is empty array", async () => {
    const res = await request(app)
      .post("/api/threads")
      .set("Authorization", AUTH_HEADER)
      .send({ participant_ids: [] });

    expect(res.status).toBe(400);
  });

  it("Tests R-P2-01 — returns 401 without auth header", async () => {
    const res = await request(app)
      .post("/api/threads")
      .send({ participant_ids: ["user-001"] });

    expect(res.status).toBe(401);
  });

  it("Tests R-P2-01 — returns 500 on database error", async () => {
    mockCreateThread.mockRejectedValueOnce(new Error("DB error"));

    const res = await request(app)
      .post("/api/threads")
      .set("Authorization", AUTH_HEADER)
      .send({ participant_ids: ["user-001"] });

    expect(res.status).toBe(500);
  });
});

/* ── R-P2-02: GET /api/threads ── */

describe("GET /api/threads", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    app = buildApp();
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
  });

  it("Tests R-P2-02 — returns all threads for tenant", async () => {
    const threads = [makeThread(), makeThread({ id: "thread-002" })];
    mockFindThreadsByCompany.mockResolvedValueOnce(threads);

    const res = await request(app)
      .get("/api/threads")
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.threads).toHaveLength(2);
    expect(res.body.threads[0].id).toBe("thread-001");
    expect(res.body.threads[1].id).toBe("thread-002");
    expect(mockFindThreadsByCompany).toHaveBeenCalledWith(
      "company-aaa",
      undefined,
    );
  });

  it("Tests R-P2-02 — filters threads by loadId query parameter", async () => {
    const threads = [makeThread()];
    mockFindThreadsByCompany.mockResolvedValueOnce(threads);

    const res = await request(app)
      .get("/api/threads?loadId=load-001")
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.threads).toHaveLength(1);
    expect(mockFindThreadsByCompany).toHaveBeenCalledWith(
      "company-aaa",
      "load-001",
    );
  });

  it("Tests R-P2-02 — returns 401 without auth header", async () => {
    const res = await request(app).get("/api/threads");
    expect(res.status).toBe(401);
  });

  it("Tests R-P2-02 — returns 500 on database error", async () => {
    mockFindThreadsByCompany.mockRejectedValueOnce(new Error("DB error"));

    const res = await request(app)
      .get("/api/threads")
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(500);
  });
});

/* ── R-P2-03: GET /api/threads/:id/messages ── */

describe("GET /api/threads/:id/messages", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    app = buildApp();
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
  });

  it("Tests R-P2-03 — returns messages ordered by created_at ASC, tenant-scoped", async () => {
    const messages = [
      makeMessage({ id: "msg-001", timestamp: "2026-04-12T10:00:00.000Z" }),
      makeMessage({ id: "msg-002", timestamp: "2026-04-12T10:05:00.000Z" }),
    ];
    mockFindByThread.mockResolvedValueOnce(messages);

    const res = await request(app)
      .get("/api/threads/thread-001/messages")
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.messages).toHaveLength(2);
    expect(res.body.messages[0].id).toBe("msg-001");
    expect(res.body.messages[1].id).toBe("msg-002");
    expect(mockFindByThread).toHaveBeenCalledWith("thread-001", "company-aaa");
  });

  it("Tests R-P2-03 — returns empty array when thread has no messages", async () => {
    mockFindByThread.mockResolvedValueOnce([]);

    const res = await request(app)
      .get("/api/threads/thread-empty/messages")
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.messages).toHaveLength(0);
  });

  it("Tests R-P2-03 — returns 401 without auth header", async () => {
    const res = await request(app).get("/api/threads/thread-001/messages");
    expect(res.status).toBe(401);
  });

  it("Tests R-P2-03 — returns 500 on database error", async () => {
    mockFindByThread.mockRejectedValueOnce(new Error("DB error"));

    const res = await request(app)
      .get("/api/threads/thread-001/messages")
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(500);
  });
});

/* ── R-P2-04: PATCH /api/messages/:id/read ── */

describe("PATCH /api/messages/:id/read", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    app = buildApp();
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
  });

  it("Tests R-P2-04 — sets read_at and returns 200 with timestamp", async () => {
    const readAt = "2026-04-12 10:30:00";
    mockMarkRead.mockResolvedValueOnce(readAt);

    const res = await request(app)
      .patch("/api/messages/msg-001/read")
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.read_at).toBe("2026-04-12 10:30:00");
    expect(mockMarkRead).toHaveBeenCalledWith("msg-001", "company-aaa");
  });

  it("Tests R-P2-04 — returns 401 without auth header", async () => {
    const res = await request(app).patch("/api/messages/msg-001/read");
    expect(res.status).toBe(401);
  });

  it("Tests R-P2-04 — returns 500 on database error", async () => {
    mockMarkRead.mockRejectedValueOnce(new Error("DB error"));

    const res = await request(app)
      .patch("/api/messages/msg-001/read")
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(500);
  });
});

/* ── R-P2-05: PATCH /api/messages/:id/read — 404 cases ── */

describe("PATCH /api/messages/:id/read — not found", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    app = buildApp();
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
  });

  it("Tests R-P2-05 — returns 404 when message not found", async () => {
    mockMarkRead.mockResolvedValueOnce(null);

    const res = await request(app)
      .patch("/api/messages/nonexistent/read")
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Not Found");
  });

  it("Tests R-P2-05 — returns 404 when message belongs to wrong tenant", async () => {
    mockMarkRead.mockResolvedValueOnce(null);

    const res = await request(app)
      .patch("/api/messages/msg-other-tenant/read")
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Not Found");
    expect(mockMarkRead).toHaveBeenCalledWith(
      "msg-other-tenant",
      "company-aaa",
    );
  });
});

/* ── R-P2-07: POST /api/messages accepts optional thread_id ── */

describe("POST /api/messages — thread_id support", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    app = buildApp();
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
  });

  it("Tests R-P2-07 — accepts thread_id and stores it", async () => {
    const msg = makeMessage({ id: "msg-threaded", thread_id: "thread-001" });
    mockCreate.mockResolvedValueOnce(msg);

    const res = await request(app)
      .post("/api/messages")
      .set("Authorization", AUTH_HEADER)
      .send({
        load_id: "load-001",
        sender_id: "user-001",
        text: "Threaded message",
        thread_id: "thread-001",
      });

    expect(res.status).toBe(201);
    expect(res.body.message.thread_id).toBe("thread-001");
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ thread_id: "thread-001" }),
      "company-aaa",
    );
  });

  it("Tests R-P2-07 — creates message without thread_id (optional)", async () => {
    const msg = makeMessage({ id: "msg-no-thread", thread_id: null });
    mockCreate.mockResolvedValueOnce(msg);

    const res = await request(app)
      .post("/api/messages")
      .set("Authorization", AUTH_HEADER)
      .send({
        load_id: "load-001",
        sender_id: "user-001",
        text: "No thread",
      });

    expect(res.status).toBe(201);
    expect(res.body.message.thread_id).toBeNull();
  });
});
