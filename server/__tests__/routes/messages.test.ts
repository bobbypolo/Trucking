import { describe, it, expect, vi, beforeEach } from "vitest";

// Tests R-P5-02-AC3, R-P5-02-AC4

// Hoisted mocks
const {
  mockFindByCompany,
  mockFindById,
  mockCreate,
  mockDelete,
  mockResolveSqlPrincipalByFirebaseUid,
} = vi.hoisted(() => ({
  mockFindByCompany: vi.fn(),
  mockFindById: vi.fn(),
  mockCreate: vi.fn(),
  mockDelete: vi.fn(),
  mockResolveSqlPrincipalByFirebaseUid: vi.fn(),
}));

vi.mock("../../repositories/message.repository", () => ({
  messageRepository: {
    findByCompany: mockFindByCompany,
    findById: mockFindById,
    create: mockCreate,
    delete: mockDelete,
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

const makeMessage = (overrides = {}) => ({
  id: "msg-001",
  company_id: "company-aaa",
  load_id: "load-001",
  sender_id: "user-001",
  sender_name: "Driver Joe",
  text: "ETA 30 minutes",
  timestamp: "2026-03-08T00:00:00.000Z",
  attachments: null,
  ...overrides,
});

describe("GET /api/messages — authentication", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    app = buildApp();
    vi.clearAllMocks();
  });

  it("returns 401 without Authorization header", async () => {
    const res = await request(app).get("/api/messages");
    expect(res.status).toBe(401);
  });
});

describe("GET /api/messages", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    app = buildApp();
    vi.clearAllMocks();
  });

  it("returns messages for authenticated tenant", async () => {
    const messages = [makeMessage(), makeMessage({ id: "msg-002" })];
    mockFindByCompany.mockResolvedValueOnce(messages);

    const res = await request(app)
      .get("/api/messages")
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("messages");
    expect(res.body.messages).toHaveLength(2);
  });

  it("filters messages by loadId when provided", async () => {
    const messages = [makeMessage()];
    mockFindByCompany.mockResolvedValueOnce(messages);

    const res = await request(app)
      .get("/api/messages?loadId=load-001")
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(mockFindByCompany).toHaveBeenCalledWith(
      expect.any(String),
      "load-001",
    );
  });

  it("returns 500 on database error", async () => {
    mockFindByCompany.mockRejectedValueOnce(new Error("DB connection lost"));

    const res = await request(app)
      .get("/api/messages")
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(500);
  });
});

describe("POST /api/messages", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    app = buildApp();
    vi.clearAllMocks();
  });

  it("returns 401 without Authorization header", async () => {
    const res = await request(app)
      .post("/api/messages")
      .send({ load_id: "load-001", sender_id: "user-001" });
    expect(res.status).toBe(401);
  });

  it("accepts message without load_id (optional field)", async () => {
    const newMessage = makeMessage({ id: "msg-no-load" });
    mockCreate.mockResolvedValueOnce(newMessage);

    const res = await request(app)
      .post("/api/messages")
      .set("Authorization", AUTH_HEADER)
      .send({ sender_id: "user-001", text: "thread-only message" });

    expect(res.status).toBe(201);
  });

  it("returns 400 when sender_id is missing", async () => {
    const res = await request(app)
      .post("/api/messages")
      .set("Authorization", AUTH_HEADER)
      .send({ load_id: "load-001" });

    expect(res.status).toBe(400);
  });

  it("creates a message and returns 201", async () => {
    const newMessage = makeMessage({ id: "msg-new" });
    mockCreate.mockResolvedValueOnce(newMessage);

    const res = await request(app)
      .post("/api/messages")
      .set("Authorization", AUTH_HEADER)
      .send({
        load_id: "load-001",
        sender_id: "user-001",
        text: "ETA 30 minutes",
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("message");
    expect(res.body.message.id).toBe("msg-new");
  });

  it("returns 500 on database error", async () => {
    mockCreate.mockRejectedValueOnce(new Error("DB error"));

    const res = await request(app)
      .post("/api/messages")
      .set("Authorization", AUTH_HEADER)
      .send({ load_id: "load-001", sender_id: "user-001" });

    expect(res.status).toBe(500);
  });
});

describe("DELETE /api/messages/:id", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    app = buildApp();
    vi.clearAllMocks();
  });

  it("returns 401 without Authorization header", async () => {
    const res = await request(app).delete("/api/messages/msg-001");
    expect(res.status).toBe(401);
  });

  it("returns 204 on successful delete", async () => {
    mockDelete.mockResolvedValueOnce(true);

    const res = await request(app)
      .delete("/api/messages/msg-001")
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(204);
  });

  it("returns 404 when message not found", async () => {
    mockDelete.mockResolvedValueOnce(false);

    const res = await request(app)
      .delete("/api/messages/nonexistent")
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(404);
  });
});
