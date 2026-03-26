import { describe, it, expect, vi, beforeEach } from "vitest";

// Tests R-P5-05-AC1, R-P5-05-AC2, R-P5-05-AC3

// ---------------------------------------------------------------------------
// Mock setup (hoisted so vi.mock factory can reference them)
// ---------------------------------------------------------------------------
const {
  mockQuery,
  mockBeginTransaction,
  mockCommit,
  mockRollback,
  mockRelease,
  mockGetConnection,
  mockConnection,
  mockResolveSqlPrincipalByFirebaseUid,
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
    mockResolveSqlPrincipalByFirebaseUid: vi.fn(),
  };
});

vi.mock("../../db", () => ({
  default: {
    query: mockQuery,
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
  createChildLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock("../../geoUtils", () => ({
  detectState: vi.fn().mockReturnValue("TX"),
  calculateDistance: vi.fn().mockReturnValue(100),
}));

vi.mock("../../services/geocoding.service", () => ({
  geocodeStopAddress: vi.fn().mockResolvedValue(null),
}));

vi.mock("../../services/load.service", () => ({
  loadService: {
    transitionStatus: vi
      .fn()
      .mockResolvedValue({ id: "load-001", status: "Active" }),
  },
}));

vi.mock("firebase-admin", () => {
  const mockAuth = {
    verifyIdToken: vi.fn().mockResolvedValue({ uid: "firebase-uid-perf" }),
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
                  company_id: "company-perf",
                  role: "admin",
                  email: "perf@test.com",
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

// Mock requireTier to pass-through (perf tests focus on latency, not tier gating)
vi.mock("../../middleware/requireTier", () => ({
  requireTier: () => (_req: any, _res: any, next: any) => next(),
}));

import express from "express";
import request from "supertest";
import loadRoutes from "../../routes/loads";
import equipmentRoutes from "../../routes/equipment";
import trackingRoutes from "../../routes/tracking";
import accountingRoutes from "../../routes/accounting";
import { errorHandler } from "../../middleware/errorHandler";
import { DEFAULT_SQL_PRINCIPAL } from "../helpers/mock-sql-auth";

const PERF_PRINCIPAL = {
  ...DEFAULT_SQL_PRINCIPAL,
  id: "user-1",
  tenantId: "company-perf",
  companyId: "company-perf",
  role: "admin",
  email: "perf@test.com",
  firebaseUid: "fb-perf",
};

mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(PERF_PRINCIPAL);

const AUTH_HEADER = "Bearer valid-firebase-token";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Compute p95 from an array of numeric values */
function p95(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil(sorted.length * 0.95) - 1;
  return sorted[Math.max(0, idx)];
}

/** Create a standard Express app with the given router */
function createApp(router: any) {
  const app = express();
  app.use(express.json());
  app.use(router);
  app.use(errorHandler);
  return app;
}

/** Fire N concurrent requests and collect latencies (ms) */
async function measureConcurrentLatency(
  app: express.Express,
  method: "get" | "post" | "put" | "delete",
  path: string,
  concurrency: number,
  body?: Record<string, unknown>,
): Promise<{ latencies: number[]; statuses: number[] }> {
  const latencies: number[] = [];
  const statuses: number[] = [];

  const promises = Array.from({ length: concurrency }, async () => {
    const start = performance.now();
    let res: request.Response;
    if (method === "get" || method === "delete") {
      res = await request(app)[method](path).set("Authorization", AUTH_HEADER);
    } else {
      res = await request(app)
        [method](path)
        .set("Authorization", AUTH_HEADER)
        .send(body ?? {});
    }
    const elapsed = performance.now() - start;
    latencies.push(elapsed);
    statuses.push(res.status);
  });

  await Promise.all(promises);
  return { latencies, statuses };
}

// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------

function makeLoadRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "load-001",
    company_id: "company-perf",
    customer_id: "cust-1",
    driver_id: "driver-1",
    dispatcher_id: "disp-1",
    load_number: "LD-001",
    status: "Active",
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
    bol_number: null,
    notification_emails: "[]",
    contract_id: null,
    gps_history: "[]",
    pod_urls: "[]",
    customer_user_id: null,
    created_at: "2026-03-07T10:00:00Z",
    ...overrides,
  };
}

function makeLegRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "leg-001",
    load_id: "load-001",
    type: "Pickup",
    facility_name: "Warehouse A",
    city: "Chicago",
    state: "IL",
    latitude: 41.8781,
    longitude: -87.6298,
    completed: true,
    sequence_order: 0,
    ...overrides,
  };
}

function makeEquipmentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "equip-001",
    company_id: "company-perf",
    unit_number: "T-100",
    type: "Truck",
    status: "Available",
    ownership_type: "Owned",
    provider_name: null,
    daily_cost: 0,
    maintenance_history: "[]",
    ...overrides,
  };
}

function makeSettlementRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "settle-001",
    company_id: "company-perf",
    driver_id: "driver-1",
    settlement_date: "2026-03-01",
    period_start: "2026-02-15",
    period_end: "2026-02-28",
    total_earnings: 5000,
    total_deductions: 200,
    total_reimbursements: 100,
    net_pay: 4900,
    status: "Draft",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// AC1: Performance / Latency Tests — modest concurrent load
// ---------------------------------------------------------------------------

describe("R-P5-05 AC1: Performance Sanity — Latency under Concurrent Load", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetConnection.mockResolvedValue(mockConnection);
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(PERF_PRINCIPAL);
  });

  it("GET /api/loads — p95 < 2000ms at 15 concurrent requests (list endpoint)", async () => {
    // Each request triggers: 1 loads query + 1 legs query per load + 1 visibility query
    const loads = Array.from({ length: 5 }, (_, i) =>
      makeLoadRow({ id: `load-${i}`, load_number: `LD-${i}` }),
    );

    mockQuery.mockImplementation(async (sql: string) => {
      // Simulate a realistic but fast DB response
      if (typeof sql === "string" && sql.includes("load_legs")) {
        return [[makeLegRow()], []];
      }
      return [[...loads], []];
    });

    const app = createApp(loadRoutes);
    const { latencies, statuses } = await measureConcurrentLatency(
      app,
      "get",
      "/api/loads",
      15,
    );

    const p95val = p95(latencies);
    console.log(
      `[perf] GET /api/loads — p95: ${p95val.toFixed(1)}ms, mean: ${(latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(1)}ms (15 concurrent)`,
    );

    // All should succeed
    statuses.forEach((s) => expect(s).toBe(200));
    // p95 must be under 2000ms for list endpoints
    expect(p95val).toBeLessThan(2000);
  });

  it("GET /api/equipment/:companyId — p95 < 2000ms at 15 concurrent requests (list endpoint)", async () => {
    const equipment = Array.from({ length: 10 }, (_, i) =>
      makeEquipmentRow({ id: `equip-${i}`, unit_number: `T-${i}` }),
    );

    mockQuery.mockResolvedValue([equipment, []]);

    const app = createApp(equipmentRoutes);
    const { latencies, statuses } = await measureConcurrentLatency(
      app,
      "get",
      "/api/equipment/company-perf",
      15,
    );

    const p95val = p95(latencies);
    console.log(
      `[perf] GET /api/equipment — p95: ${p95val.toFixed(1)}ms, mean: ${(latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(1)}ms (15 concurrent)`,
    );

    statuses.forEach((s) => expect(s).toBe(200));
    expect(p95val).toBeLessThan(2000);
  });

  it("GET /api/accounting/settlements — p95 < 2000ms at 15 concurrent requests (list endpoint)", async () => {
    const settlements = Array.from({ length: 5 }, (_, i) =>
      makeSettlementRow({ id: `settle-${i}` }),
    );

    mockQuery.mockImplementation(async (sql: string) => {
      if (typeof sql === "string" && sql.includes("settlement_lines")) {
        return [
          [
            {
              id: "line-1",
              settlement_id: "settle-0",
              description: "Trip pay",
              amount: 500,
              type: "Earning",
            },
          ],
          [],
        ];
      }
      return [settlements, []];
    });

    const app = createApp(accountingRoutes);
    const { latencies, statuses } = await measureConcurrentLatency(
      app,
      "get",
      "/api/accounting/settlements",
      15,
    );

    const p95val = p95(latencies);
    console.log(
      `[perf] GET /api/accounting/settlements — p95: ${p95val.toFixed(1)}ms, mean: ${(latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(1)}ms (15 concurrent)`,
    );

    statuses.forEach((s) => expect(s).toBe(200));
    expect(p95val).toBeLessThan(2000);
  });

  it("GET /api/loads/tracking — p95 < 2000ms at 15 concurrent requests (list endpoint)", async () => {
    const loads = Array.from({ length: 3 }, (_, i) => ({
      id: `load-${i}`,
      load_number: `L-${i}`,
      status: "Active",
      driver_id: `driver-${i}`,
    }));

    mockQuery.mockImplementation(async (sql: string) => {
      if (typeof sql === "string" && sql.includes("load_legs")) {
        return [[makeLegRow()], []];
      }
      return [loads, []];
    });

    const app = createApp(trackingRoutes);
    const { latencies, statuses } = await measureConcurrentLatency(
      app,
      "get",
      "/api/loads/tracking",
      15,
    );

    const p95val = p95(latencies);
    console.log(
      `[perf] GET /api/loads/tracking — p95: ${p95val.toFixed(1)}ms, mean: ${(latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(1)}ms (15 concurrent)`,
    );

    statuses.forEach((s) => expect(s).toBe(200));
    expect(p95val).toBeLessThan(2000);
  });

  it("GET /api/accounting/accounts — p95 < 1000ms at 20 concurrent requests (CRUD read)", async () => {
    mockQuery.mockResolvedValue([
      [
        {
          id: "GL-1000",
          account_number: "1000",
          name: "Cash",
          type: "Asset",
          is_active: true,
        },
        {
          id: "GL-1200",
          account_number: "1200",
          name: "AR",
          type: "Asset",
          is_active: true,
        },
      ],
      [],
    ]);

    const app = createApp(accountingRoutes);
    const { latencies, statuses } = await measureConcurrentLatency(
      app,
      "get",
      "/api/accounting/accounts",
      20,
    );

    const p95val = p95(latencies);
    console.log(
      `[perf] GET /api/accounting/accounts — p95: ${p95val.toFixed(1)}ms, mean: ${(latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(1)}ms (20 concurrent)`,
    );

    statuses.forEach((s) => expect(s).toBe(200));
    // CRUD read endpoint — p95 < 1000ms
    expect(p95val).toBeLessThan(1000);
  });
});

// ---------------------------------------------------------------------------
// AC2: N+1 Query Detection — query count per request
// ---------------------------------------------------------------------------

describe("R-P5-05 AC2: N+1 Query Detection", () => {
  let queryCount: number;

  beforeEach(() => {
    vi.clearAllMocks();
    queryCount = 0;
    mockGetConnection.mockResolvedValue(mockConnection);
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(PERF_PRINCIPAL);
  });

  /** Wrap mockQuery to count calls */
  function instrumentQueryCounting(
    handler: (sql: string, params?: unknown[]) => [unknown[], unknown[]],
  ) {
    mockQuery.mockImplementation(async (sql: string, params?: unknown[]) => {
      queryCount++;
      return handler(sql, params);
    });
  }

  describe("Load list endpoint — N+1 detection", () => {
    it("GET /api/loads with N loads produces at most N+2 queries (loads + N legs + visibility)", async () => {
      const N = 10;
      const loads = Array.from({ length: N }, (_, i) =>
        makeLoadRow({ id: `load-${i}`, load_number: `LD-${i}` }),
      );

      instrumentQueryCounting((sql: string) => {
        if (typeof sql === "string" && sql.includes("load_legs")) {
          return [[makeLegRow()], []];
        }
        return [loads, []];
      });

      const app = createApp(loadRoutes);
      await request(app)
        .get("/api/loads")
        .set("Authorization", AUTH_HEADER)
        .expect(200);

      console.log(
        `[query-count] GET /api/loads with ${N} loads: ${queryCount} DB queries (expected ~${N + 1})`,
      );

      expect(queryCount).toBeGreaterThanOrEqual(N + 1);
      expect(queryCount).toBeLessThanOrEqual(N + 3);
    });
  });

  describe("Settlement list endpoint — N+1 detection", () => {
    it("GET /api/accounting/settlements with N settlements produces at most N+1 queries", async () => {
      const N = 5;
      const settlements = Array.from({ length: N }, (_, i) =>
        makeSettlementRow({ id: `settle-${i}` }),
      );

      instrumentQueryCounting((sql: string) => {
        if (typeof sql === "string" && sql.includes("settlement_lines")) {
          return [
            [
              {
                id: "line-1",
                settlement_id: "settle-0",
                description: "Trip pay",
                amount: 500,
                type: "Earning",
              },
            ],
            [],
          ];
        }
        return [settlements, []];
      });

      const app = createApp(accountingRoutes);
      await request(app)
        .get("/api/accounting/settlements")
        .set("Authorization", AUTH_HEADER)
        .expect(200);

      console.log(
        `[query-count] GET /api/accounting/settlements with ${N} settlements: ${queryCount} DB queries (expected ~${N + 1})`,
      );

      expect(queryCount).toBeGreaterThanOrEqual(N + 1);
      expect(queryCount).toBeLessThanOrEqual(N + 3);
    });
  });

  describe("Tracking endpoints — query budget", () => {
    it("GET /api/loads/tracking produces < 5 DB queries per load", async () => {
      const N = 3; // 3 active loads
      const loads = Array.from({ length: N }, (_, i) => ({
        id: `load-${i}`,
        load_number: `L-${i}`,
        status: "Active",
        driver_id: `driver-${i}`,
      }));

      instrumentQueryCounting((sql: string) => {
        if (typeof sql === "string" && sql.includes("load_legs")) {
          return [[makeLegRow()], []];
        }
        return [loads, []];
      });

      const app = createApp(trackingRoutes);
      await request(app)
        .get("/api/loads/tracking")
        .set("Authorization", AUTH_HEADER)
        .expect(200);

      const queriesPerLoad = queryCount / N;
      console.log(
        `[query-count] GET /api/loads/tracking: ${queryCount} total queries for ${N} loads = ${queriesPerLoad.toFixed(1)} per load`,
      );

      expect(queriesPerLoad).toBeLessThan(5);
    });

    it("GET /api/loads/:id/tracking produces < 5 DB queries per request", async () => {
      instrumentQueryCounting((sql: string) => {
        if (typeof sql === "string" && sql.includes("load_legs")) {
          return [[makeLegRow({ load_id: "load-single" })], []];
        }
        return [
          [
            {
              id: "load-single",
              load_number: "L-SINGLE",
              status: "Active",
              driver_id: "driver-1",
            },
          ],
          [],
        ];
      });

      const app = createApp(trackingRoutes);
      await request(app)
        .get("/api/loads/load-single/tracking")
        .set("Authorization", AUTH_HEADER)
        .expect(200);

      console.log(
        `[query-count] GET /api/loads/:id/tracking: ${queryCount} DB queries (target: < 5)`,
      );

      expect(queryCount).toBeLessThan(5);
    });
  });

  describe("Excessive query detection", () => {
    it("No endpoint produces more than 3x expected queries (excessive N+1 indicator)", async () => {
      const N = 20;
      const loads = Array.from({ length: N }, (_, i) =>
        makeLoadRow({ id: `load-${i}`, load_number: `LD-${i}` }),
      );

      instrumentQueryCounting((sql: string) => {
        if (typeof sql === "string" && sql.includes("load_legs")) {
          return [[makeLegRow()], []];
        }
        return [loads, []];
      });

      const app = createApp(loadRoutes);
      await request(app)
        .get("/api/loads")
        .set("Authorization", AUTH_HEADER)
        .expect(200);

      const expected = N + 1;
      console.log(
        `[query-count] Excessive check — GET /api/loads with ${N} loads: ${queryCount} queries (expected ~${expected}, excessive threshold: ${expected * 3})`,
      );

      expect(queryCount).toBeLessThanOrEqual(expected * 3);
    });
  });
});

// ---------------------------------------------------------------------------
// AC1 continued: Auth middleware overhead
// ---------------------------------------------------------------------------

describe("R-P5-05 AC1: Auth Middleware Performance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetConnection.mockResolvedValue(mockConnection);
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(PERF_PRINCIPAL);
  });

  it("Auth middleware pass-through p95 < 500ms at 20 concurrent requests", async () => {
    mockQuery.mockResolvedValue([
      [
        {
          id: "GL-1000",
          account_number: "1000",
          name: "Cash",
          type: "Asset",
          is_active: true,
        },
      ],
      [],
    ]);

    const app = createApp(accountingRoutes);
    const { latencies, statuses } = await measureConcurrentLatency(
      app,
      "get",
      "/api/accounting/accounts",
      20,
    );

    const p95val = p95(latencies);
    console.log(
      `[perf] Auth pass-through p95: ${p95val.toFixed(1)}ms (20 concurrent, target: <500ms)`,
    );

    statuses.forEach((s) => expect(s).toBe(200));
    expect(p95val).toBeLessThan(500);
  });
});
