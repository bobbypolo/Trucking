import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for STORY-007 — Server push trigger on dispatcher status update.
 *
 * Verifies the push-notification branch added to
 * `PATCH /api/loads/:id/status` in `server/routes/loads.ts`. Mocks are
 * placed at architectural boundaries:
 *   - `vi.mock("../../db")` — DB driver
 *   - `vi.mock("../../lib/expo-push")` — outbound push HTTP sender
 *   - `vi.mock("../../middleware/requireAuth")` — auth middleware
 *   - `vi.mock("../../services/load.service")` — state-machine orchestrator
 *
 * The handler under test (`PATCH /api/loads/:id/status`) is NEVER mocked —
 * the real router is mounted onto an Express app via supertest.
 *
 * # Tests R-P7-01
 * # Tests R-P7-02
 * # Tests R-P7-03
 * # Tests R-P7-04
 */

const {
  mockQuery,
  mockGetConnection,
  mockConnection,
  mockSendPush,
  mockTransitionLoad,
} = vi.hoisted(() => {
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
    mockTransitionLoad: vi.fn(),
  };
});

const authState: { enabled: boolean; userId: string } = {
  enabled: true,
  userId: "dispatcher-x",
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

vi.mock("../../services/load.service", () => ({
  loadService: {
    transitionLoad: mockTransitionLoad,
  },
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

// Idempotency middleware pass-through — the real middleware short-circuits
// when no Idempotency-Key header is present, but we mock it anyway to avoid
// hitting the DB layer for its replay lookup.
vi.mock("../../middleware/idempotency", () => ({
  idempotencyMiddleware: () => (_req: any, _res: any, next: any) => next(),
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
 * Routes the shared mockQuery based on the SQL text. The PATCH /status
 * handler (after our STORY-007 edit) issues these reads:
 *   1. SELECT id, driver_id, load_number FROM loads WHERE id = ? AND company_id = ?
 *      — used by the push trigger to discover the assigned driver.
 *   2. SELECT expo_push_token FROM push_tokens WHERE user_id = ? AND enabled = 1
 *      — used to fetch delivery tokens for that driver.
 *
 * Each test seeds the row shapes it needs and the dispatcher honors them.
 */
function installSqlDispatcher(opts: {
  driverId?: string | null;
  loadNumber?: string;
  pushTokenRows?: Array<{ expo_push_token: string }>;
}) {
  const {
    driverId = "driver-y",
    loadNumber = "LD-123",
    pushTokenRows = [{ expo_push_token: "ExponentPushToken[driver-y-tok]" }],
  } = opts;

  mockQuery.mockImplementation((sql: unknown, _params?: unknown) => {
    if (typeof sql !== "string") {
      return Promise.resolve([[], []]);
    }
    if (/FROM\s+loads\s+WHERE\s+id/i.test(sql)) {
      return Promise.resolve([
        [
          {
            id: "load-123",
            driver_id: driverId,
            load_number: loadNumber,
          },
        ],
        [],
      ]);
    }
    if (/FROM\s+push_tokens/i.test(sql)) {
      return Promise.resolve([pushTokenRows, []]);
    }
    return Promise.resolve([[], []]);
  });
}

describe("PATCH /api/loads/:id/status — push notification trigger (STORY-007)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery.mockReset();
    mockTransitionLoad.mockReset();
    authState.enabled = true;
    authState.userId = "dispatcher-x";
    mockGetConnection.mockResolvedValue(mockConnection);
    mockSendPush.mockResolvedValue({ sent: 1, errors: [] });
    // Default: transitionLoad succeeds with a predictable shape.
    mockTransitionLoad.mockResolvedValue({
      id: "load-123",
      status: "dispatched",
      version: 2,
    });
  });

  // Tests R-P7-01
  it("fires exactly one sendPush with title 'Load status changed' and data.loadId='load-123' when a dispatcher transitions a load assigned to another driver", async () => {
    // Caller = "dispatcher-x", load.driver_id = "driver-y" → distinct → push fires.
    authState.userId = "dispatcher-x";
    installSqlDispatcher({
      driverId: "driver-y",
      loadNumber: "LD-123",
      pushTokenRows: [{ expo_push_token: "ExponentPushToken[driver-y-tok]" }],
    });

    const app = buildApp();
    const res = await request(app)
      .patch("/api/loads/load-123/status")
      .set("Authorization", "Bearer valid-token")
      .send({ status: "dispatched" });

    expect(res.status).toBe(200);
    expect(mockTransitionLoad).toHaveBeenCalledTimes(1);

    const sendPushMock = vi.mocked(sendPush);
    expect(sendPushMock).toHaveBeenCalledTimes(1);

    const call = sendPushMock.mock.calls[0];
    // First arg: tokens (string[])
    expect(Array.isArray(call[0])).toBe(true);
    expect(call[0]).toEqual(["ExponentPushToken[driver-y-tok]"]);
    // Second arg: exact title string from R-P7-01
    expect(call[1]).toBe("Load status changed");
    // Third arg: body includes load_number and new status
    expect(typeof call[2]).toBe("string");
    expect(call[2]).toContain("LD-123");
    expect(call[2]).toContain("dispatched");
    // Fourth arg: data payload with loadId === "load-123"
    expect(call[3]).toBeDefined();
    expect((call[3] as { loadId: unknown }).loadId).toBe("load-123");
  });

  // Tests R-P7-02
  it("does NOT call sendPush when the caller is the assigned driver (self-transition)", async () => {
    // Caller = "driver-y" AND load.driver_id = "driver-y" → same actor → no push.
    authState.userId = "driver-y";
    installSqlDispatcher({
      driverId: "driver-y",
      loadNumber: "LD-123",
      pushTokenRows: [
        { expo_push_token: "ExponentPushToken[should-not-be-used]" },
      ],
    });

    const app = buildApp();
    const res = await request(app)
      .patch("/api/loads/load-123/status")
      .set("Authorization", "Bearer valid-token")
      .send({ status: "dispatched" });

    expect(res.status).toBe(200);
    expect(mockTransitionLoad).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendPush)).not.toHaveBeenCalled();
  });

  // Tests R-P7-03
  it("does NOT call sendPush when the load's driver_id column is NULL (unassigned load)", async () => {
    authState.userId = "dispatcher-x";
    installSqlDispatcher({
      driverId: null,
      loadNumber: "LD-123",
      // Provide tokens to prove the null guard short-circuits BEFORE the
      // token select — the push branch must never reach push_tokens lookup.
      pushTokenRows: [
        { expo_push_token: "ExponentPushToken[should-not-be-used]" },
      ],
    });

    const app = buildApp();
    const res = await request(app)
      .patch("/api/loads/load-123/status")
      .set("Authorization", "Bearer valid-token")
      .send({ status: "dispatched" });

    expect(res.status).toBe(200);
    expect(mockTransitionLoad).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendPush)).not.toHaveBeenCalled();
  });

  // Tests R-P7-04
  it("returns HTTP 200 with the transitionLoad result when sendPush rejects (push failure must not fail the PATCH)", async () => {
    authState.userId = "dispatcher-x";
    const expectedResult = {
      id: "load-123",
      status: "dispatched",
      version: 7,
      marker: "transition-result-marker",
    };
    mockTransitionLoad.mockReset();
    mockTransitionLoad.mockResolvedValue(expectedResult);

    installSqlDispatcher({
      driverId: "driver-y",
      loadNumber: "LD-123",
      pushTokenRows: [{ expo_push_token: "ExponentPushToken[driver-y-tok]" }],
    });

    mockSendPush.mockReset();
    mockSendPush.mockRejectedValueOnce(new Error("expo down"));

    const app = buildApp();
    const res = await request(app)
      .patch("/api/loads/load-123/status")
      .set("Authorization", "Bearer valid-token")
      .send({ status: "dispatched" });

    // Response body must be the transitionLoad result — verified via supertest.
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expectedResult);

    // sendPush was invoked (and rejected).
    expect(vi.mocked(sendPush)).toHaveBeenCalledTimes(1);
    // transitionLoad was invoked exactly once.
    expect(mockTransitionLoad).toHaveBeenCalledTimes(1);
  });
});
