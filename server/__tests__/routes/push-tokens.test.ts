import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for POST /api/push-tokens (register) and POST /api/push-tokens/unregister.
 *
 * Mocking strategy follows the project pattern: mock the DB driver and the
 * `requireAuth` middleware (architectural boundaries) — never the route
 * handlers themselves.
 */

const { mockQuery } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
}));

const authState: { enabled: boolean; userId: string } = {
  enabled: true,
  userId: "user-1",
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
  requireAuth: (req: any, res: any, next: any) => {
    if (!authState.enabled) {
      return res.status(401).json({ error: "Authentication required." });
    }
    req.user = {
      id: authState.userId,
      uid: authState.userId,
      tenantId: "company-aaa",
      companyId: "company-aaa",
      role: "driver",
      email: "driver@example.com",
      firebaseUid: "firebase-uid-1",
    };
    next();
  },
}));

vi.mock("../../middleware/requireTenant", () => ({
  requireTenant: (req: any, res: any, next: any) => {
    if (!req.user) {
      return res
        .status(403)
        .json({ error: "Tenant verification requires authentication." });
    }
    next();
  },
}));

import express from "express";
import request from "supertest";
import pushTokensRouter from "../../routes/push-tokens";
import { errorHandler } from "../../middleware/errorHandler";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(pushTokensRouter);
  app.use(errorHandler);
  return app;
}

describe("POST /api/push-tokens — register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.enabled = true;
    authState.userId = "user-1";
  });

  // Tests R-P4-01
  it("returns 201 with id and inserts into push_tokens for authenticated request", async () => {
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

    const app = buildApp();
    const res = await request(app)
      .post("/api/push-tokens")
      .set("Authorization", "Bearer valid-token")
      .send({ token: "ExponentPushToken[abc]", platform: "ios" });

    expect(res.status).toBe(201);
    expect(typeof res.body.id).toBe("string");
    expect(res.body.id.length).toBeGreaterThan(0);

    expect(mockQuery).toHaveBeenCalledTimes(1);
    const sql = mockQuery.mock.calls[0][0];
    expect(sql).toMatch(/INSERT INTO push_tokens/i);

    const params = mockQuery.mock.calls[0][1];
    expect(Array.isArray(params)).toBe(true);
    // Params: [id, user_id, token, platform]
    expect(params).toContain("user-1");
    expect(params).toContain("ExponentPushToken[abc]");
    expect(params).toContain("ios");
  });

  // Tests R-P4-02
  it("returns 401 when no Authorization header is present and never calls pool.query", async () => {
    authState.enabled = false;

    const app = buildApp();
    const res = await request(app)
      .post("/api/push-tokens")
      .send({ token: "ExponentPushToken[abc]", platform: "ios" });

    expect(res.status).toBe(401);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  // Tests R-P4-03
  it("returns 400 and never calls pool.query when token is missing", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/push-tokens")
      .set("Authorization", "Bearer valid-token")
      .send({ platform: "ios" });

    expect(res.status).toBe(400);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("returns 400 when platform is invalid (negative test)", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/push-tokens")
      .set("Authorization", "Bearer valid-token")
      .send({ token: "ExponentPushToken[abc]", platform: "windows" });

    expect(res.status).toBe(400);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("accepts platform 'android'", async () => {
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

    const app = buildApp();
    const res = await request(app)
      .post("/api/push-tokens")
      .set("Authorization", "Bearer valid-token")
      .send({ token: "ExponentPushToken[xyz]", platform: "android" });

    expect(res.status).toBe(201);
    expect(typeof res.body.id).toBe("string");
    const params = mockQuery.mock.calls[0][1];
    expect(params).toContain("android");
  });
});

describe("POST /api/push-tokens/unregister", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.enabled = true;
    authState.userId = "user-1";
  });

  // Tests R-P4-04
  it("returns 204 and updates push_tokens with enabled=0 for authenticated request", async () => {
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

    const app = buildApp();
    const res = await request(app)
      .post("/api/push-tokens/unregister")
      .set("Authorization", "Bearer valid-token")
      .send({ token: "ExponentPushToken[abc]" });

    expect(res.status).toBe(204);

    expect(mockQuery).toHaveBeenCalledTimes(1);
    const sql = mockQuery.mock.calls[0][0];
    expect(sql).toMatch(/UPDATE push_tokens SET enabled = 0/i);

    const params = mockQuery.mock.calls[0][1];
    expect(Array.isArray(params)).toBe(true);
    expect(params).toContain("user-1");
    expect(params).toContain("ExponentPushToken[abc]");
  });

  // Tests R-P4-05
  it("returns 401 when no Authorization header is present", async () => {
    authState.enabled = false;

    const app = buildApp();
    const res = await request(app)
      .post("/api/push-tokens/unregister")
      .send({ token: "ExponentPushToken[abc]" });

    expect(res.status).toBe(401);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("returns 400 when token is missing (negative test)", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/push-tokens/unregister")
      .set("Authorization", "Bearer valid-token")
      .send({});

    expect(res.status).toBe(400);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("returns 400 when token is empty string (negative test)", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/push-tokens/unregister")
      .set("Authorization", "Bearer valid-token")
      .send({ token: "" });

    expect(res.status).toBe(400);
    expect(mockQuery).not.toHaveBeenCalled();
  });
});
