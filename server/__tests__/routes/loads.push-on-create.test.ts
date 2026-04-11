import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for STORY-005 — Server push trigger on new load creation.
 *
 * Verifies the push-notification branch added to `POST /api/loads` in
 * `server/routes/loads.ts`. Mocks are placed at architectural boundaries:
 *   - `vi.mock("../../db")` — DB driver
 *   - `vi.mock("../../lib/expo-push")` — outbound push HTTP sender
 *   - `vi.mock("../../middleware/requireAuth")` — auth middleware
 *
 * The handler under test (`POST /api/loads`) is NEVER mocked — the real
 * router is mounted onto an Express app via supertest.
 */

const {
  mockQuery,
  mockBeginTransaction,
  mockCommit,
  mockRollback,
  mockRelease,
  mockGetConnection,
  mockConnection,
  mockSendPush,
} = vi.hoisted(() => {
  const mockQuery = vi.fn();
  const mockBeginTransaction = vi.fn().mockResolvedValue(undefined);
  const mockCommit = vi.fn().mockResolvedValue(undefined);
  const mockRollback = vi.fn().mockResolvedValue(undefined);
  const mockRelease = vi.fn();
  const mockGetConnection = vi.fn();

  const mockConnection = {
    beginTransaction: mockBeginTransaction,
    commit: mockCommit,
    rollback: mockRollback,
    release: mockRelease,
    query: mockQuery,
  };

  return {
    mockQuery,
    mockBeginTransaction,
    mockCommit,
    mockRollback,
    mockRelease,
    mockGetConnection,
    mockConnection,
    mockSendPush: vi.fn(),
  };
});

const authState: { enabled: boolean; userId: string } = {
  enabled: true,
  userId: "dispatcher-1",
};

vi.mock("../../db", () => ({
  default: {
    query: mockQuery,
    getConnection: mockGetConnection,
  },
}));

vi.mock("../../lib/expo-push", () => ({
  sendPush: mockSendPush,
}));

vi.mock("../../helpers", () => ({
  redactData: (data: unknown) => data,
  getVisibilitySettings: vi.fn().mockResolvedValue(null),
  sendNotification: vi.fn(),
  checkBreakdownLateness: vi
    .fn()
    .mockResolvedValue({ isLate: false, dist: 0, required: 0 }),
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
    req.user = {
      id: authState.userId,
      uid: authState.userId,
      tenantId: "company-aaa",
      companyId: "company-aaa",
      role: "dispatcher",
      email: "dispatcher@example.com",
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
import loadRoutes from "../../routes/loads";
import { errorHandler } from "../../middleware/errorHandler";
import { sendPush } from "../../lib/expo-push";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(loadRoutes);
  app.use(errorHandler);
  return app;
}

function basePayload(overrides: Record<string, unknown> = {}) {
  return {
    id: "load-xyz-001",
    load_number: "LD-XYZ-001",
    status: "draft",
    driver_id: "driver-abc",
    ...overrides,
  };
}

/**
 * Routes the shared mockQuery to different rowsets based on the SQL text.
 * The handler issues three kinds of queries that all funnel through
 * `mockQuery` (because connection.query and pool.query share the same mock):
 *   1. REPLACE INTO loads (connection.query, write)
 *   2. SELECT expo_push_token FROM push_tokens (pool.query, read)
 *   3. SELECT city, type FROM load_legs (pool.query, read)
 *
 * Each test seeds the rowsets it needs and the dispatcher honors them.
 */
function installSqlDispatcher(opts: {
  pushTokenRows?: Array<{ expo_push_token: string }>;
  legRows?: Array<{ city: string; type: string }>;
}) {
  mockQuery.mockImplementation((sql: unknown, _params?: unknown) => {
    if (typeof sql !== "string") {
      return Promise.resolve([{ affectedRows: 1 }, []]);
    }
    if (/REPLACE INTO loads/i.test(sql)) {
      return Promise.resolve([{ affectedRows: 1 }, []]);
    }
    if (/INSERT INTO load_legs/i.test(sql)) {
      return Promise.resolve([{ affectedRows: 1 }, []]);
    }
    if (/DELETE FROM load_legs/i.test(sql)) {
      return Promise.resolve([{ affectedRows: 0 }, []]);
    }
    if (/FROM push_tokens/i.test(sql)) {
      return Promise.resolve([opts.pushTokenRows ?? [], []]);
    }
    if (/FROM load_legs/i.test(sql)) {
      return Promise.resolve([opts.legRows ?? [], []]);
    }
    return Promise.resolve([{ affectedRows: 1 }, []]);
  });
}

describe("POST /api/loads — push notification trigger (STORY-005)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery.mockReset();
    authState.enabled = true;
    authState.userId = "dispatcher-1";
    mockGetConnection.mockResolvedValue(mockConnection);
    mockSendPush.mockResolvedValue({ sent: 1, errors: [] });
  });

  // Tests R-P5-01
  it("fires exactly one sendPush with token array, title, and loadId when driver_id differs from caller", async () => {
    installSqlDispatcher({
      pushTokenRows: [
        { expo_push_token: "ExponentPushToken[driver-abc-token]" },
      ],
      legRows: [
        { city: "Chicago", type: "Pickup" },
        { city: "Dallas", type: "Dropoff" },
      ],
    });

    const app = buildApp();
    const body = basePayload({ driver_id: "driver-abc" });
    const res = await request(app)
      .post("/api/loads")
      .set("Authorization", "Bearer valid-token")
      .send(body);

    expect(res.status).toBe(201);

    const sendPushMock = vi.mocked(sendPush);
    expect(sendPushMock).toHaveBeenCalledTimes(1);

    const call = sendPushMock.mock.calls[0];
    // First arg: tokens (string[] containing the registered token)
    expect(Array.isArray(call[0])).toBe(true);
    expect(call[0]).toEqual(["ExponentPushToken[driver-abc-token]"]);
    // Second arg: title
    expect(call[1]).toBe("New load assigned");
    // Third arg: body includes load_number and pickup/dropoff cities
    expect(typeof call[2]).toBe("string");
    expect(call[2]).toContain("LD-XYZ-001");
    expect(call[2]).toContain("Chicago");
    expect(call[2]).toContain("Dallas");
    // Fourth arg: data payload with loadId === body.id
    expect(call[3]).toBeDefined();
    expect((call[3] as { loadId: unknown }).loadId).toBe(body.id);
  });

  // Tests R-P5-02
  it("does NOT call sendPush when driver_id equals req.user.id (self-assignment)", async () => {
    authState.userId = "driver-self";

    // The handler still performs REPLACE INTO via connection.query but the
    // push branch is short-circuited by the self-assignment guard. Use the
    // dispatcher so the REPLACE INTO returns the right shape.
    installSqlDispatcher({
      pushTokenRows: [
        { expo_push_token: "ExponentPushToken[should-not-be-used]" },
      ],
      legRows: [{ city: "Chicago", type: "Pickup" }],
    });

    const app = buildApp();
    const res = await request(app)
      .post("/api/loads")
      .set("Authorization", "Bearer valid-token")
      .send(basePayload({ driver_id: "driver-self" }));

    expect(res.status).toBe(201);
    expect(vi.mocked(sendPush)).not.toHaveBeenCalled();
  });

  // Tests R-P5-03
  it("does NOT call sendPush when the push_tokens query returns an empty row set", async () => {
    // push_tokens SELECT → returns [[], []] (empty rows). The criterion
    // explicitly tests this no-op path where there are no enabled tokens.
    installSqlDispatcher({
      pushTokenRows: [],
      legRows: [
        { city: "Chicago", type: "Pickup" },
        { city: "Dallas", type: "Dropoff" },
      ],
    });

    const app = buildApp();
    const res = await request(app)
      .post("/api/loads")
      .set("Authorization", "Bearer valid-token")
      .send(basePayload({ driver_id: "driver-abc" }));

    expect(res.status).toBe(201);
    expect(vi.mocked(sendPush)).not.toHaveBeenCalled();
  });

  // Tests R-P5-04
  it("returns HTTP 201 when sendPush rejects, and REPLACE INTO loads fires BEFORE the push trigger", async () => {
    installSqlDispatcher({
      pushTokenRows: [
        { expo_push_token: "ExponentPushToken[driver-abc-token]" },
      ],
      legRows: [
        { city: "Chicago", type: "Pickup" },
        { city: "Dallas", type: "Dropoff" },
      ],
    });

    mockSendPush.mockReset();
    mockSendPush.mockRejectedValueOnce(new Error("expo down"));

    const app = buildApp();
    const res = await request(app)
      .post("/api/loads")
      .set("Authorization", "Bearer valid-token")
      .send(basePayload({ driver_id: "driver-abc" }));

    // Response still 201 — push failure is swallowed, never blocks request.
    expect(res.status).toBe(201);

    // sendPush was invoked (and rejected).
    expect(vi.mocked(sendPush)).toHaveBeenCalledTimes(1);

    // Ordering: the FIRST mockQuery invocation (REPLACE INTO) must precede
    // the first sendPush invocation. Use invocationCallOrder — a monotonic
    // global counter assigned by Vitest on every mock call.
    const firstQueryCall = mockQuery.mock.invocationCallOrder[0];
    const firstSendPushCall = mockSendPush.mock.invocationCallOrder[0];
    expect(typeof firstQueryCall).toBe("number");
    expect(typeof firstSendPushCall).toBe("number");
    expect(firstQueryCall).toBeLessThan(firstSendPushCall);

    // And that first query was a REPLACE INTO loads statement (not the
    // push_tokens SELECT that happens later).
    const firstQuerySql = mockQuery.mock.calls[0][0];
    expect(typeof firstQuerySql).toBe("string");
    expect(firstQuerySql as string).toMatch(/REPLACE INTO loads/i);
  });
});
