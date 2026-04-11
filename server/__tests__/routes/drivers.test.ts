import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for GET /api/drivers/me and PATCH /api/drivers/me.
 *
 * Mocking strategy follows the project pattern: mock the DB driver and the
 * `requireAuth` middleware (architectural boundaries) — never the route
 * handlers themselves. This is the `push-tokens.test.ts` pattern.
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

import express from "express";
import request from "supertest";
import driversRouter from "../../routes/drivers";
import { errorHandler } from "../../middleware/errorHandler";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(driversRouter);
  app.use(errorHandler);
  return app;
}

const DRIVER_ROW = {
  id: "user-1",
  name: "Alice Driver",
  email: "alice@example.com",
  phone: "555-000-1111",
  role: "driver",
  companyId: "company-aaa",
};

describe("GET /api/drivers/me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.enabled = true;
    authState.userId = "user-1";
  });

  // Tests R-P9-01
  it("returns 200 with exactly the expected sorted keys [companyId,email,id,name,phone,role]", async () => {
    mockQuery.mockResolvedValueOnce([[DRIVER_ROW], []]);

    const app = buildApp();
    const res = await request(app)
      .get("/api/drivers/me")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);

    const sortedKeys = Object.keys(res.body).sort();
    expect(sortedKeys).toEqual([
      "companyId",
      "email",
      "id",
      "name",
      "phone",
      "role",
    ]);
    expect(res.body.id).toBe("user-1");
    expect(res.body.email).toBe("alice@example.com");
    expect(res.body.companyId).toBe("company-aaa");
    expect(res.body.role).toBe("driver");

    expect(mockQuery).toHaveBeenCalledTimes(1);
    const sql = mockQuery.mock.calls[0][0];
    expect(sql).toMatch(/SELECT\s+id,\s*name,\s*email,\s*phone,\s*role/i);
    expect(sql).toMatch(/FROM\s+users/i);
  });

  // Tests R-P9-02
  it("returns 404 when pool.query returns an empty row set [[],[]]", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);

    const app = buildApp();
    const res = await request(app)
      .get("/api/drivers/me")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(404);
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  // Tests R-P9-03
  it("returns 401 when no Authorization header is present and never calls pool.query", async () => {
    authState.enabled = false;

    const app = buildApp();
    const res = await request(app).get("/api/drivers/me");

    expect(res.status).toBe(401);
    expect(mockQuery).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/drivers/me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.enabled = true;
    authState.userId = "user-1";
  });

  // Tests R-P9-04
  it("returns 200 and runs exactly one UPDATE users SET phone = ? with phone and req.user.id", async () => {
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

    const app = buildApp();
    const res = await request(app)
      .patch("/api/drivers/me")
      .set("Authorization", "Bearer valid-token")
      .send({ phone: "555-123-4567" });

    expect(res.status).toBe(200);

    expect(mockQuery).toHaveBeenCalledTimes(1);
    const sql = mockQuery.mock.calls[0][0];
    expect(sql).toMatch(/UPDATE users SET phone = \?/i);

    const params = mockQuery.mock.calls[0][1];
    expect(Array.isArray(params)).toBe(true);
    expect(params).toContain("555-123-4567");
    expect(params).toContain("user-1");
  });

  // Tests R-P9-05
  it("rejects invalid phone with 400 and does NOT call pool.query", async () => {
    const app = buildApp();
    const res = await request(app)
      .patch("/api/drivers/me")
      .set("Authorization", "Bearer valid-token")
      .send({ phone: "not-a-phone-!!" });

    expect(res.status).toBe(400);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  // Tests R-P9-06
  it("ignores role field in body — captured SQL never contains the substring 'role' (case-insensitive)", async () => {
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

    const app = buildApp();
    const res = await request(app)
      .patch("/api/drivers/me")
      .set("Authorization", "Bearer valid-token")
      .send({ phone: "555-1234567", role: "admin" });

    expect(res.status).toBe(200);

    expect(mockQuery).toHaveBeenCalledTimes(1);
    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql.toLowerCase()).not.toContain("role");

    const params = mockQuery.mock.calls[0][1];
    expect(params).toContain("555-1234567");
    expect(params).not.toContain("admin");
  });

  it("rejects missing phone with 400 (negative test — error path)", async () => {
    const app = buildApp();
    const res = await request(app)
      .patch("/api/drivers/me")
      .set("Authorization", "Bearer valid-token")
      .send({});

    expect(res.status).toBe(400);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("rejects phone with letters with 400 (negative test — invalid input)", async () => {
    const app = buildApp();
    const res = await request(app)
      .patch("/api/drivers/me")
      .set("Authorization", "Bearer valid-token")
      .send({ phone: "abc1234" });

    expect(res.status).toBe(400);
    expect(mockQuery).not.toHaveBeenCalled();
  });
});
