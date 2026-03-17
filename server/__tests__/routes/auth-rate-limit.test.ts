import { describe, it, expect, vi, beforeEach } from "vitest";

// STORY-007: Login rate limiting tests

const { mockQuery, mockResolveSqlPrincipalByFirebaseUid } = vi.hoisted(() => {
  const mockQuery = vi.fn();
  const mockResolveSqlPrincipalByFirebaseUid = vi.fn();
  return { mockQuery, mockResolveSqlPrincipalByFirebaseUid };
});

vi.mock("../../db", () => ({
  default: { query: mockQuery },
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

vi.mock("firebase-admin", () => {
  const mockAuth = {
    verifyIdToken: vi.fn().mockResolvedValue({
      uid: "firebase-uid-1",
      email: "test@loadpilot.com",
    }),
  };
  return {
    default: {
      app: vi.fn(),
      auth: () => mockAuth,
      firestore: () => ({
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
                      email: "test@loadpilot.com",
                    }),
                  },
                ],
              }),
            }),
          }),
        }),
      }),
    },
  };
});

vi.mock("../../lib/sql-auth", () => ({
  resolveSqlPrincipalByFirebaseUid: mockResolveSqlPrincipalByFirebaseUid,
  findSqlUserById: vi.fn().mockResolvedValue({
    id: "user-1",
    name: "Test User",
    email: "test@loadpilot.com",
    role: "dispatcher",
    company_id: "company-aaa",
  }),
  linkSqlUserToFirebaseUid: vi.fn(),
  mapUserRowToApiUser: vi.fn((row: any) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    companyId: row.company_id,
  })),
  mirrorUserToFirestore: vi.fn(),
  upsertSqlUser: vi.fn(),
}));

vi.mock("../../firestore", () => ({
  default: {
    collection: vi.fn().mockReturnValue({
      doc: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({ id: "company-aaa", name: "Test Co" }),
        }),
        set: vi.fn(),
      }),
    }),
  },
}));

import express from "express";
import request from "supertest";
import usersRouter from "../../routes/users";
import { errorHandler } from "../../middleware/errorHandler";

function buildApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json());
  app.use(usersRouter);
  app.use(errorHandler);
  return app;
}

describe("POST /api/auth/login — rate limiting (STORY-007)", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    // Build a fresh app for each test to reset rate limiter state
    app = buildApp();
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue({
      id: "user-1",
      companyId: "company-aaa",
      role: "dispatcher",
      email: "test@loadpilot.com",
      firebaseUid: "firebase-uid-1",
    });
  });

  it("allows requests within rate limit window", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .set("Authorization", "Bearer valid-token")
      .send({ email: "test@loadpilot.com", password: "test123" });

    // Should get through rate limiter (may fail at auth step, but not 429)
    expect(res.status).not.toBe(429);
  });

  it("returns 429 after exceeding 10 requests", async () => {
    const loginPayload = {
      email: "test@loadpilot.com",
      password: "test123",
    };

    // Send 10 requests (should all pass rate limiter)
    for (let i = 0; i < 10; i++) {
      await request(app)
        .post("/api/auth/login")
        .set("Authorization", "Bearer valid-token")
        .send(loginPayload);
    }

    // 11th request should be rate-limited
    const res = await request(app)
      .post("/api/auth/login")
      .set("Authorization", "Bearer valid-token")
      .send(loginPayload);

    expect(res.status).toBe(429);
    expect(res.body.error).toMatch(/too many/i);
  });

  it("includes RateLimit headers in response", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .set("Authorization", "Bearer valid-token")
      .send({ email: "test@loadpilot.com", password: "test123" });

    // express-rate-limit v8 with standardHeaders: true sends RateLimit-* headers
    const headers = Object.keys(res.headers).map((h) => h.toLowerCase());
    const hasRateLimitHeader = headers.some(
      (h) => h.includes("ratelimit") || h.includes("x-ratelimit"),
    );
    expect(hasRateLimitHeader).toBe(true);
  });
});
