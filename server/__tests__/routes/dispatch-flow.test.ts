import { describe, it, expect, vi, beforeEach } from "vitest";

// Tests R-P2-06-AC1, R-P2-06-AC2, R-P2-06-AC3

// --- Mock setup (hoisted so vi.mock factory can reference them) ---
const {
  mockQuery,
  mockExecute,
  mockBeginTransaction,
  mockCommit,
  mockRollback,
  mockRelease,
  mockGetConnection,
  mockConnection,
  mockResolveSqlPrincipalByFirebaseUid,
} = vi.hoisted(() => {
  const mockQuery = vi.fn();
  const mockExecute = vi.fn();
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
    execute: mockExecute,
  };

  return {
    mockQuery,
    mockExecute,
    mockBeginTransaction,
    mockCommit,
    mockRollback,
    mockRelease,
    mockGetConnection,
    mockConnection,
    mockResolveSqlPrincipalByFirebaseUid: vi.fn(),
  };
});

vi.mock("../../db", () => ({
  default: {
    query: mockQuery,
    execute: mockExecute,
    getConnection: mockGetConnection,
  },
}));

vi.mock("../../helpers", () => ({
  redactData: (data: unknown) => data,
  getVisibilitySettings: vi.fn().mockResolvedValue({}),
  sendNotification: vi.fn(),
  checkBreakdownLateness: vi
    .fn()
    .mockResolvedValue({ isLate: false, dist: 100, required: 2 }),
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

// Mock firebase-admin for requireAuth
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
import loadRoutes from "../../routes/loads";
import { errorHandler } from "../../middleware/errorHandler";
import { DEFAULT_SQL_PRINCIPAL } from "../helpers/mock-sql-auth";

mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(DEFAULT_SQL_PRINCIPAL);

// --- Constants ---
const COMPANY_A = "company-aaa";

const makeLoadRow = (overrides: Record<string, unknown> = {}) => ({
  id: "load-001",
  company_id: COMPANY_A,
  customer_id: "cust-1",
  driver_id: "driver-1",
  dispatcher_id: "disp-1",
  load_number: "LD-001",
  status: "draft",
  carrier_rate: 1500,
  driver_pay: 800,
  pickup_date: "2026-03-10",
  freight_type: "Dry Van",
  commodity: "Electronics",
  weight: 42000,
  container_number: null,
  container_size: null,
  chassis_number: null,
  chassis_provider: null,
  bol_number: "BOL-001",
  notification_emails: "[]",
  contract_id: null,
  gps_history: "[]",
  pod_urls: "[]",
  customer_user_id: null,
  created_at: "2026-03-07T00:00:00.000Z",
  version: 1,
  ...overrides,
});

const makeStopRow = (overrides: Record<string, unknown> = {}) => ({
  id: "stop-001",
  load_id: "load-001",
  type: "Pickup",
  facility_name: "Warehouse A",
  city: "Chicago",
  state: "IL",
  date: "2026-03-10",
  appointment_time: "08:00",
  completed: false,
  sequence_order: 0,
  ...overrides,
});

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(loadRoutes);
  app.use(errorHandler);
  return app;
}

/**
 * Helper to mock the standard sequence for a single status transition.
 * The loadService.transitionLoad method performs:
 *   1. pool.query to fetch load
 *   2. pool.query to fetch stops
 *   3. (if dispatched) pool.query for driver/equipment company lookups
 *   4. connection.execute for UPDATE loads
 *   5. connection.execute for INSERT dispatch_events
 */
function mockSuccessfulTransition(
  currentStatus: string,
  currentVersion: number,
  opts: {
    driverId?: string | null;
    chassisNumber?: string | null;
    stopTypes?: string[];
  } = {},
) {
  const {
    driverId = "driver-1",
    chassisNumber = null,
    stopTypes = ["Pickup", "Dropoff"],
  } = opts;

  // 1. Fetch load
  mockQuery.mockResolvedValueOnce([
    [
      makeLoadRow({
        status: currentStatus,
        version: currentVersion,
        driver_id: driverId,
        chassis_number: chassisNumber,
      }),
    ],
    [],
  ]);

  // 2. Fetch stops
  const stops = stopTypes.map((type, i) =>
    makeStopRow({ id: `stop-${i}`, type, sequence_order: i }),
  );
  mockQuery.mockResolvedValueOnce([stops, []]);
}

describe("R-P2-06: Dispatch Flow — Status Transitions via API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetConnection.mockResolvedValue(mockConnection);
  });

  describe("AC1: PATCH /api/loads/:id/status calls loadService.transitionLoad", () => {
    it("transitions draft to planned via state machine and returns structured result", async () => {
      // Mock the loadService.transitionLoad flow
      mockSuccessfulTransition("draft", 1);

      // Mock transaction: status change and event record
      mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
      mockExecute.mockResolvedValueOnce([{ affectedRows: 1, insertId: 0 }, []]);

      const app = createApp();
      const res = await request(app)
        .patch("/api/loads/load-001/status")
        .set("Authorization", "Bearer valid-token")
        .send({ status: "planned" });

      expect(res.status).toBe(200);
      expect(res.body.id).toBe("load-001");
      expect(res.body.status).toBe("planned");
      expect(res.body.previous_status).toBe("draft");
      expect(res.body.version).toBe(2);
    });

    it("returns 422 with error_code for invalid status transition", async () => {
      // Load is in draft state; attempting to transition directly to completed
      mockSuccessfulTransition("draft", 1);

      const app = createApp();
      const res = await request(app)
        .patch("/api/loads/load-001/status")
        .set("Authorization", "Bearer valid-token")
        .send({ status: "completed" });

      expect(res.status).toBe(422);
      expect(res.body.error_class).toBe("BUSINESS_RULE");
      expect(res.body.error_code).toMatch(/BUSINESS_RULE/);
    });
  });

  describe("AC2: Full lifecycle transition via API (draft->planned->dispatched->in_transit->arrived->delivered->completed)", () => {
    it("transitions load through complete lifecycle — each state persists correctly", async () => {
      const app = createApp();

      const lifecycle: Array<{ from: string; to: string; version: number }> = [
        { from: "draft", to: "planned", version: 1 },
        { from: "planned", to: "dispatched", version: 2 },
        { from: "dispatched", to: "in_transit", version: 3 },
        { from: "in_transit", to: "arrived", version: 4 },
        { from: "arrived", to: "delivered", version: 5 },
        { from: "delivered", to: "completed", version: 6 },
      ];

      for (const step of lifecycle) {
        vi.clearAllMocks();
        mockGetConnection.mockResolvedValue(mockConnection);

        // For dispatch transition, we need driver + equipment lookups
        if (step.to === "dispatched") {
          mockSuccessfulTransition(step.from, step.version, {
            driverId: "driver-1",
            chassisNumber: "CHASSIS-001",
          });
          // Driver company lookup
          mockQuery.mockResolvedValueOnce([[{ company_id: COMPANY_A }], []]);
          // Equipment company lookup
          mockQuery.mockResolvedValueOnce([[{ company_id: COMPANY_A }], []]);
        } else {
          mockSuccessfulTransition(step.from, step.version);
        }

        // Mock transaction: status change and event record
        mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
        mockExecute.mockResolvedValueOnce([
          { affectedRows: 1, insertId: 0 },
          [],
        ]);

        const res = await request(app)
          .patch("/api/loads/load-001/status")
          .set("Authorization", "Bearer valid-token")
          .send({ status: step.to });

        expect(res.status).toBe(200);
        expect(res.body.status).toBe(step.to);
        expect(res.body.previous_status).toBe(step.from);
        expect(res.body.version).toBe(step.version + 1);
      }
    });
  });

  describe("AC3: Invalid transition returns structured error with BUSINESS_RULE error code", () => {
    it("draft -> in_transit returns 422 with BUSINESS_RULE error code", async () => {
      mockSuccessfulTransition("draft", 1);

      const app = createApp();
      const res = await request(app)
        .patch("/api/loads/load-001/status")
        .set("Authorization", "Bearer valid-token")
        .send({ status: "in_transit" });

      expect(res.status).toBe(422);
      expect(res.body.error_code).toMatch(/BUSINESS_RULE/);
      expect(res.body.error_class).toBe("BUSINESS_RULE");
      expect(res.body.message).toContain("Invalid load transition");
      expect(res.body.details).toBeDefined();
      expect(res.body.details.from).toBe("draft");
      expect(res.body.details.to).toBe("in_transit");
    });

    it("completed -> draft returns 422 with BUSINESS_RULE error code", async () => {
      mockSuccessfulTransition("completed", 7);

      const app = createApp();
      const res = await request(app)
        .patch("/api/loads/load-001/status")
        .set("Authorization", "Bearer valid-token")
        .send({ status: "draft" });

      expect(res.status).toBe(422);
      expect(res.body.error_code).toMatch(/BUSINESS_RULE/);
      expect(res.body.error_class).toBe("BUSINESS_RULE");
    });

    it("cancelled -> planned returns 422 — terminal states have no transitions", async () => {
      mockSuccessfulTransition("cancelled", 3);

      const app = createApp();
      const res = await request(app)
        .patch("/api/loads/load-001/status")
        .set("Authorization", "Bearer valid-token")
        .send({ status: "planned" });

      expect(res.status).toBe(422);
      expect(res.body.error_code).toMatch(/BUSINESS_RULE/);
    });

    it("error response includes correlation_id for traceability", async () => {
      mockSuccessfulTransition("draft", 1);

      const app = createApp();
      const res = await request(app)
        .patch("/api/loads/load-001/status")
        .set("Authorization", "Bearer valid-token")
        .send({ status: "completed" });

      expect(res.status).toBe(422);
      expect(res.body.correlation_id).toBeDefined();
      expect(typeof res.body.correlation_id).toBe("string");
    });
  });

  describe("AC1: Dashboard shows real counts from API", () => {
    it("GET /api/loads/counts returns status counts for tenant", async () => {
      // Mock the count query
      mockQuery.mockResolvedValueOnce([
        [
          { status: "draft", count: 3 },
          { status: "planned", count: 5 },
          { status: "dispatched", count: 2 },
          { status: "in_transit", count: 4 },
          { status: "arrived", count: 1 },
          { status: "delivered", count: 7 },
          { status: "completed", count: 15 },
          { status: "cancelled", count: 0 },
        ],
      ]);

      const app = createApp();
      const res = await request(app)
        .get("/api/loads/counts")
        .set("Authorization", "Bearer valid-token");

      expect(res.status).toBe(200);
      expect(res.body.draft).toBe(3);
      expect(res.body.planned).toBe(5);
      expect(res.body.dispatched).toBe(2);
      expect(res.body.in_transit).toBe(4);
      expect(res.body.arrived).toBe(1);
      expect(res.body.delivered).toBe(7);
      expect(res.body.completed).toBe(15);
      expect(res.body.total).toBe(37);
    });

    it("GET /api/loads/counts returns zeros when no loads exist", async () => {
      mockQuery.mockResolvedValueOnce([[]]);

      const app = createApp();
      const res = await request(app)
        .get("/api/loads/counts")
        .set("Authorization", "Bearer valid-token");

      expect(res.status).toBe(200);
      expect(res.body.draft).toBe(0);
      expect(res.body.total).toBe(0);
    });
  });
});
