import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for STORY-006 — Server push trigger on driver reassignment (PATCH).
 *
 * Verifies the push-notification branch added to `PATCH /api/loads/:id` in
 * `server/routes/loads.ts`. Mocks are placed at architectural boundaries:
 *   - `vi.mock("../../db")` — DB driver
 *   - `vi.mock("../../lib/expo-push")` — outbound push HTTP sender
 *   - `vi.mock("../../middleware/requireAuth")` — auth middleware
 *
 * The handler under test (`PATCH /api/loads/:id`) is NEVER mocked — the real
 * router is mounted onto an Express app via supertest.
 */

const { mockQuery, mockGetConnection, mockConnection, mockSendPush } =
  vi.hoisted(() => {
    const mockQuery = vi.fn();
    const mockGetConnection = vi.fn();
    const mockConnection = {
      beginTransaction: vi.fn().mockResolvedValue(undefined),
      commit: vi.fn().mockResolvedValue(undefined),
      rollback: vi.fn().mockResolvedValue(undefined),
      release: vi.fn(),
      query: mockQuery,
    };

    return {
      mockQuery,
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

/**
 * Routes the shared mockQuery to different rowsets based on the SQL text.
 * The PATCH handler issues these kinds of queries:
 *   1. SELECT id, driver_id FROM loads (existence + old driver probe)
 *   2. UPDATE loads SET ... WHERE id = ? AND company_id = ?
 *   3. SELECT * FROM loads (reload for response)
 *   4. SELECT * FROM load_legs (legs for response shape)
 *   5. SELECT expo_push_token FROM push_tokens (reassign push branch)
 *   6. SELECT city, type FROM load_legs (reassign push branch)
 */
function installSqlDispatcher(opts: {
  oldDriverId?: string | null;
  pushTokenRows?: Array<{ expo_push_token: string }>;
  legRows?: Array<{ city: string; type: string }>;
  loadRow?: Record<string, unknown>;
}) {
  const {
    oldDriverId = "driver-old",
    pushTokenRows = [],
    legRows = [],
    loadRow = {
      id: "load-123",
      company_id: "company-aaa",
      load_number: "LD-123",
      driver_id: oldDriverId,
      status: "draft",
    },
  } = opts;

  mockQuery.mockImplementation((sql: unknown, _params?: unknown) => {
    if (typeof sql !== "string") {
      return Promise.resolve([{ affectedRows: 1 }, []]);
    }
    // Existence probe — first SELECT before UPDATE. Must return the row with
    // driver_id so the handler can compare new vs old. We widen the pattern
    // to match both the original existence-only select and the extended form.
    if (/^SELECT\s+[\s\S]*\bFROM\s+loads\s+WHERE\s+id/i.test(sql)) {
      // Differentiate between the pre-UPDATE probe (returns id + driver_id)
      // and the post-UPDATE reload (SELECT *).
      if (/SELECT\s+\*/i.test(sql)) {
        return Promise.resolve([[loadRow], []]);
      }
      return Promise.resolve([
        [
          {
            id: "load-123",
            driver_id: oldDriverId,
            load_number: "LD-123",
          },
        ],
        [],
      ]);
    }
    if (/^UPDATE\s+loads/i.test(sql)) {
      return Promise.resolve([{ affectedRows: 1 }, []]);
    }
    if (/FROM\s+push_tokens/i.test(sql)) {
      return Promise.resolve([pushTokenRows, []]);
    }
    if (/FROM\s+load_legs/i.test(sql)) {
      return Promise.resolve([legRows, []]);
    }
    return Promise.resolve([{ affectedRows: 1 }, []]);
  });
}

describe("PATCH /api/loads/:id — push notification on driver reassignment (STORY-006)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery.mockReset();
    authState.enabled = true;
    authState.userId = "dispatcher-1";
    mockGetConnection.mockResolvedValue(mockConnection);
    mockSendPush.mockResolvedValue({ sent: 1, errors: [] });
  });

  // Tests R-P6-01
  it("UPDATE SQL contains 'driver_id = ?' and params include 'driver-new' when driver_id is in body", async () => {
    installSqlDispatcher({
      oldDriverId: "driver-old",
      pushTokenRows: [{ expo_push_token: "ExponentPushToken[tok]" }],
      legRows: [
        { city: "Chicago", type: "Pickup" },
        { city: "Dallas", type: "Dropoff" },
      ],
    });

    const app = buildApp();
    const res = await request(app)
      .patch("/api/loads/load-123")
      .set("Authorization", "Bearer valid-token")
      .send({ driver_id: "driver-new" });

    expect(res.status).toBe(200);

    // Find the UPDATE call
    const updateCall = mockQuery.mock.calls.find(
      (c) =>
        typeof c[0] === "string" && /^UPDATE\s+loads/i.test(c[0] as string),
    );
    expect(updateCall).toBeDefined();
    const updateSql = updateCall![0] as string;
    const updateParams = updateCall![1] as unknown[];

    // R-P6-01: SQL contains substring 'driver_id = ?'
    expect(updateSql.includes("driver_id = ?")).toBe(true);
    // R-P6-01: params include 'driver-new'
    expect(updateParams).toContain("driver-new");
  });

  // Tests R-P6-02
  it("fires exactly one sendPush with 'Load reassigned to you' when driver_id changes to a distinct non-caller value", async () => {
    installSqlDispatcher({
      oldDriverId: "driver-old",
      pushTokenRows: [{ expo_push_token: "ExponentPushToken[new-tok]" }],
      legRows: [
        { city: "Chicago", type: "Pickup" },
        { city: "Dallas", type: "Dropoff" },
      ],
    });

    const app = buildApp();
    const res = await request(app)
      .patch("/api/loads/load-123")
      .set("Authorization", "Bearer valid-token")
      .send({ driver_id: "driver-new" });

    expect(res.status).toBe(200);

    const sendPushMock = vi.mocked(sendPush);
    // Exactly one call
    expect(sendPushMock).toHaveBeenCalledTimes(1);

    const call = sendPushMock.mock.calls[0];
    // First arg: tokens array
    expect(Array.isArray(call[0])).toBe(true);
    expect(call[0]).toEqual(["ExponentPushToken[new-tok]"]);
    // Second arg: exact title
    expect(call[1]).toBe("Load reassigned to you");
    // Third arg: body contains load_number + cities
    expect(typeof call[2]).toBe("string");
    expect(call[2]).toContain("LD-123");
    expect(call[2]).toContain("Chicago");
    expect(call[2]).toContain("Dallas");
    // Fourth arg: data with loadId === 'load-123'
    expect(call[3]).toBeDefined();
    expect((call[3] as { loadId: unknown }).loadId).toBe("load-123");
  });

  // Tests R-P6-03
  it("does NOT call sendPush when the new driver_id equals the pre-existing value (no change)", async () => {
    installSqlDispatcher({
      oldDriverId: "driver-same",
      pushTokenRows: [{ expo_push_token: "ExponentPushToken[unused]" }],
      legRows: [{ city: "Chicago", type: "Pickup" }],
    });

    const app = buildApp();
    const res = await request(app)
      .patch("/api/loads/load-123")
      .set("Authorization", "Bearer valid-token")
      .send({ driver_id: "driver-same" });

    expect(res.status).toBe(200);
    expect(vi.mocked(sendPush)).not.toHaveBeenCalled();
  });

  // Tests R-P6-04
  it("does NOT call sendPush when the new driver_id equals req.user.id (self-assignment)", async () => {
    authState.userId = "dispatcher-self";

    installSqlDispatcher({
      oldDriverId: "driver-old",
      pushTokenRows: [{ expo_push_token: "ExponentPushToken[unused]" }],
      legRows: [{ city: "Chicago", type: "Pickup" }],
    });

    const app = buildApp();
    const res = await request(app)
      .patch("/api/loads/load-123")
      .set("Authorization", "Bearer valid-token")
      .send({ driver_id: "dispatcher-self" });

    expect(res.status).toBe(200);
    expect(vi.mocked(sendPush)).not.toHaveBeenCalled();
  });

  // Tests R-P6-05
  it("PATCH without driver_id in body does NOT modify the driver_id column", async () => {
    installSqlDispatcher({
      oldDriverId: "driver-old",
      pushTokenRows: [],
      legRows: [],
    });

    const app = buildApp();
    const res = await request(app)
      .patch("/api/loads/load-123")
      .set("Authorization", "Bearer valid-token")
      .send({ weight: 500 });

    expect(res.status).toBe(200);

    // Find the UPDATE call
    const updateCall = mockQuery.mock.calls.find(
      (c) =>
        typeof c[0] === "string" && /^UPDATE\s+loads/i.test(c[0] as string),
    );
    expect(updateCall).toBeDefined();
    const updateSql = updateCall![0] as string;
    // R-P6-05: UPDATE SQL does NOT contain 'driver_id = ?'
    expect(updateSql.includes("driver_id = ?")).toBe(false);
    // And sendPush is not called
    expect(vi.mocked(sendPush)).not.toHaveBeenCalled();
  });
});
