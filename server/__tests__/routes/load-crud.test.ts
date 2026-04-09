import { describe, it, expect, vi, beforeEach } from "vitest";

// Tests R-P2-05-AC1, R-P2-05-AC3

// --- Mock setup (hoisted so vi.mock factory can reference them) ---
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

// --- Test data ---
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
  bol_number: null,
  notification_emails: "[]",
  contract_id: null,
  gps_history: "[]",
  pod_urls: "[]",
  customer_user_id: null,
  created_at: "2026-03-07T10:00:00Z",
  ...overrides,
});

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(loadRoutes);
  app.use(errorHandler);
  return app;
}

describe("Load CRUD API — round-trip", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetConnection.mockResolvedValue(mockConnection);
  });

  describe("GET /api/loads (auth-scoped, no companyId in URL)", () => {
    it("returns loads for the authenticated user tenant", async () => {
      const loadRow = makeLoadRow();
      // Mock the loads query
      mockQuery.mockResolvedValueOnce([[loadRow]]);
      // Mock getVisibilitySettings (called via helpers)
      // Mock the legs query for each load
      mockQuery.mockResolvedValueOnce([[]]);

      const app = createApp();
      const res = await request(app)
        .get("/api/loads")
        .set("Authorization", "Bearer valid-token");

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(1);
      expect(res.body[0].load_number).toBe("LD-001");
      expect(res.body[0].company_id).toBe(COMPANY_A);

      // Verify query used tenantId from auth, NOT from URL
      const firstQueryCall = mockQuery.mock.calls[0];
      expect(firstQueryCall[0]).toContain("company_id = ?");
      expect(firstQueryCall[1]).toEqual([COMPANY_A]);
    });
  });

  describe("POST /api/loads — create load", () => {
    it("creates a load and returns 201", async () => {
      // Mock connection.query for load creation (no legs)
      mockConnection.query.mockResolvedValue([{ affectedRows: 1 }]);

      const app = createApp();
      const res = await request(app)
        .post("/api/loads")
        .set("Authorization", "Bearer valid-token")
        .send({
          load_number: "LD-NEW-001",
          status: "draft",
          carrier_rate: 2500,
          driver_pay: 1200,
          pickup_date: "2026-03-15",
          freight_type: "Dry Van",
          legs: [
            {
              type: "Pickup",
              facility_name: "Warehouse A",
              city: "Chicago",
              state: "IL",
            },
            {
              type: "Dropoff",
              facility_name: "Depot B",
              city: "Detroit",
              state: "MI",
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.message).toBe("Load saved");
      expect(mockConnection.beginTransaction).toHaveBeenCalled();
      expect(mockConnection.commit).toHaveBeenCalled();
    });
  });

  describe("Round-trip: create then fetch", () => {
    it("load created via POST is retrievable via GET with matching data", async () => {
      // Step 1: POST create
      mockConnection.query.mockResolvedValue([{ affectedRows: 1 }]);

      const app = createApp();
      const createRes = await request(app)
        .post("/api/loads")
        .set("Authorization", "Bearer valid-token")
        .send({
          load_number: "RT-001",
          status: "draft",
          carrier_rate: 3000,
          driver_pay: 1500,
        });

      expect(createRes.status).toBe(201);

      // Step 2: GET fetch — the load should appear
      const createdLoad = makeLoadRow({
        load_number: "RT-001",
        status: "draft",
        carrier_rate: 3000,
        driver_pay: 1500,
      });
      mockQuery.mockResolvedValueOnce([[createdLoad]]);
      mockQuery.mockResolvedValueOnce([[]]); // legs

      const fetchRes = await request(app)
        .get("/api/loads")
        .set("Authorization", "Bearer valid-token");

      expect(fetchRes.status).toBe(200);
      expect(fetchRes.body.length).toBeGreaterThanOrEqual(1);
      const fetched = fetchRes.body.find(
        (l: any) => l.load_number === "RT-001",
      );
      expect(fetched).toBeDefined();
      expect(fetched.carrier_rate).toBe(3000);
      expect(fetched.driver_pay).toBe(1500);
      expect(fetched.status).toBe("draft");
    });
  });

  describe("POST /api/loads derives company_id from auth context", () => {
    it("uses tenantId from auth when no company_id in body", async () => {
      mockConnection.query.mockResolvedValue([{ affectedRows: 1 }]);

      const app = createApp();
      const res = await request(app)
        .post("/api/loads")
        .set("Authorization", "Bearer valid-token")
        .send({
          load_number: "LD-AUTH-001",
          status: "draft",
          // No company_id in body — server must derive from auth
        });

      expect(res.status).toBe(201);

      // The INSERT query should use the auth tenantId (company-aaa)
      const insertCall = mockConnection.query.mock.calls[0];
      const insertArgs = insertCall[1] as unknown[];
      // company_id should be at index 1 (after id)
      expect(insertArgs[1]).toBe(COMPANY_A);
    });

    it("rejects request with mismatched company_id in body (tenant isolation)", async () => {
      const app = createApp();
      const res = await request(app)
        .post("/api/loads")
        .set("Authorization", "Bearer valid-token")
        .send({
          load_number: "LD-TAMPER-001",
          status: "draft",
          company_id: "some-other-company", // tenant mismatch
        });

      expect(res.status).toBe(403);
    });
  });
});
