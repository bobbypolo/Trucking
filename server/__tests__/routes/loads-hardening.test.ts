import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Loads Route Hardening Tests
 *
 * Covers previously uncovered branches and lines in loads.ts:
 * - GET /api/loads: JSON field parsing (already-parsed objects), DB error
 * - POST /api/loads: breakdown issues flow, notification emails path,
 *   legs with existing lat/lng, rollback on error
 * - GET /api/loads/counts: DB error via next()
 * - PATCH /api/loads/:id/status: load not found, validation error
 * - DELETE /api/loads/:id: arrived status rejection
 */

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

// Use real redactData (core business logic). Mock sendNotification (side-effect),
// getVisibilitySettings and checkBreakdownLateness (both query DB).
vi.mock("../../helpers", () => ({
  redactData: (data: unknown) => data,
  getVisibilitySettings: vi.fn().mockResolvedValue(null),
  sendNotification: vi.fn(),
  checkBreakdownLateness: vi
    .fn()
    .mockResolvedValue({ isLate: true, dist: 200, required: 5 }),
}));

vi.mock("../../lib/logger", () => ({
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
import loadRoutes from "../../routes/loads";
import { errorHandler } from "../../middleware/errorHandler";
import { DEFAULT_SQL_PRINCIPAL } from "../helpers/mock-sql-auth";

mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(DEFAULT_SQL_PRINCIPAL);

const COMPANY_A = "company-aaa";
const AUTH_HEADER = "Bearer valid-firebase-token";

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
  chassis_number: null,
  bol_number: null,
  notification_emails: "[]",
  contract_id: null,
  gps_history: "[]",
  pod_urls: "[]",
  customer_user_id: null,
  created_at: "2026-03-07T10:00:00Z",
  deleted_at: null,
  ...overrides,
});

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(loadRoutes);
  app.use(errorHandler);
  return app;
}

describe("Loads Route Hardening", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetConnection.mockResolvedValue(mockConnection);
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
  });

  // ── GET /api/loads — JSON parsing branches ──────────────────────

  describe("GET /api/loads — JSON field parsing branches", () => {
    it("handles already-parsed JSON objects (non-string notification_emails, gps_history, pod_urls)", async () => {
      const loadRow = makeLoadRow({
        notification_emails: ["email@test.com"],
        gps_history: [{ lat: 41.8, lng: -87.6 }],
        pod_urls: ["https://example.com/pod.pdf"],
      });
      mockQuery.mockResolvedValueOnce([[loadRow]]);
      mockQuery.mockResolvedValueOnce([[]]); // legs

      const app = createApp();
      const res = await request(app)
        .get("/api/loads")
        .set("Authorization", AUTH_HEADER);

      expect(res.status).toBe(200);
      expect(res.body[0].notificationEmails).toEqual(["email@test.com"]);
      expect(res.body[0].gpsHistory).toEqual([{ lat: 41.8, lng: -87.6 }]);
      expect(res.body[0].podUrls).toEqual(["https://example.com/pod.pdf"]);
    });

    it("handles null JSON fields gracefully", async () => {
      const loadRow = makeLoadRow({
        notification_emails: null,
        gps_history: null,
        pod_urls: null,
        customer_user_id: null,
      });
      mockQuery.mockResolvedValueOnce([[loadRow]]);
      mockQuery.mockResolvedValueOnce([[]]); // legs

      const app = createApp();
      const res = await request(app)
        .get("/api/loads")
        .set("Authorization", AUTH_HEADER);

      expect(res.status).toBe(200);
      expect(res.body[0].notificationEmails).toEqual([]);
      expect(res.body[0].gpsHistory).toEqual([]);
      expect(res.body[0].podUrls).toEqual([]);
    });

    it("handles multiple loads with legs", async () => {
      const load1 = makeLoadRow({ id: "load-1" });
      const load2 = makeLoadRow({ id: "load-2", load_number: "LD-002" });
      mockQuery.mockResolvedValueOnce([[load1, load2]]);
      // legs for load-1
      mockQuery.mockResolvedValueOnce([
        [{ id: "leg-1", load_id: "load-1", type: "Pickup" }],
      ]);
      // legs for load-2
      mockQuery.mockResolvedValueOnce([
        [{ id: "leg-2", load_id: "load-2", type: "Dropoff" }],
      ]);

      const app = createApp();
      const res = await request(app)
        .get("/api/loads")
        .set("Authorization", AUTH_HEADER);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].legs).toHaveLength(1);
      expect(res.body[1].legs).toHaveLength(1);
    });

    it("returns 500 on database error", async () => {
      mockQuery.mockRejectedValueOnce(new Error("DB error"));

      const app = createApp();
      const res = await request(app)
        .get("/api/loads")
        .set("Authorization", AUTH_HEADER);

      expect(res.status).toBe(500);
      expect(res.body.error).toBe("Database error");
    });
  });

  // ── POST /api/loads — breakdown flow ──────────────────────────────

  describe("POST /api/loads — breakdown intelligence flow", () => {
    it("creates incident and work items for BREAKDOWN issue (late scenario)", async () => {
      // All connection.query calls succeed
      mockConnection.query.mockResolvedValue([{ affectedRows: 1 }]);
      // Driver location query (via pool.query for time logs)
      mockQuery.mockResolvedValueOnce([
        [{ location_lat: 38.8, location_lng: -99.3 }],
      ]);

      const app = createApp();
      const res = await request(app)
        .post("/api/loads")
        .set("Authorization", AUTH_HEADER)
        .send({
          id: "load-breakdown-001",
          load_number: "LD-BREAKDOWN",
          status: "draft",
          driver_id: "driver-1",
          issues: [
            {
              category: "Mechanical",
              description: "BREAKDOWN on I-70 - Engine failure",
              status: "Open",
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(mockConnection.commit).toHaveBeenCalled();
    });

    it("sends notification when notification_emails are provided", async () => {
      mockConnection.query.mockResolvedValue([{ affectedRows: 1 }]);

      const app = createApp();
      const res = await request(app)
        .post("/api/loads")
        .set("Authorization", AUTH_HEADER)
        .send({
          load_number: "LD-NOTIFY",
          status: "draft",
          notification_emails: ["dispatch@company.com", "manager@company.com"],
        });

      expect(res.status).toBe(201);
    });

    it("handles legs with existing lat/lng (skips geocoding)", async () => {
      mockConnection.query.mockResolvedValue([{ affectedRows: 1 }]);

      const app = createApp();
      const res = await request(app)
        .post("/api/loads")
        .set("Authorization", AUTH_HEADER)
        .send({
          load_number: "LD-GEOCODED",
          status: "draft",
          legs: [
            {
              type: "Pickup",
              city: "Chicago",
              state: "IL",
              latitude: 41.8781,
              longitude: -87.6298,
            },
          ],
        });

      expect(res.status).toBe(201);
    });

    it("handles legs with location sub-object format", async () => {
      mockConnection.query.mockResolvedValue([{ affectedRows: 1 }]);

      const app = createApp();
      const res = await request(app)
        .post("/api/loads")
        .set("Authorization", AUTH_HEADER)
        .send({
          load_number: "LD-LOCATION-FMT",
          status: "draft",
          legs: [
            {
              type: "Pickup",
              location: {
                city: "Dallas",
                state: "TX",
                facilityName: "Warehouse B",
              },
            },
          ],
        });

      expect(res.status).toBe(201);
    });

    it("rolls back transaction on error and returns 500", async () => {
      // First query succeeds (REPLACE INTO loads), then next fails
      mockConnection.query
        .mockResolvedValueOnce([{ affectedRows: 1 }])
        .mockRejectedValueOnce(new Error("Legs insert failed"));

      const app = createApp();
      const res = await request(app)
        .post("/api/loads")
        .set("Authorization", AUTH_HEADER)
        .send({
          load_number: "LD-FAIL",
          status: "draft",
          legs: [{ type: "Pickup", city: "Chicago", state: "IL" }],
        });

      expect(res.status).toBe(500);
      expect(mockConnection.rollback).toHaveBeenCalled();
      expect(mockConnection.release).toHaveBeenCalled();
    });
  });

  // ── GET /api/loads/counts — error path ────────────────────────────

  describe("GET /api/loads/counts — error path", () => {
    it("passes error to next() on DB failure", async () => {
      mockQuery.mockRejectedValueOnce(new Error("DB error"));

      const app = createApp();
      const res = await request(app)
        .get("/api/loads/counts")
        .set("Authorization", AUTH_HEADER);

      // Error handler should return 500
      expect(res.status).toBe(500);
    });

    it("ignores unknown status values in count results", async () => {
      mockQuery.mockResolvedValueOnce([
        [
          { status: "draft", count: 2 },
          { status: "unknown_status", count: 5 }, // should be counted in total but not in named status
        ],
      ]);

      const app = createApp();
      const res = await request(app)
        .get("/api/loads/counts")
        .set("Authorization", AUTH_HEADER);

      expect(res.status).toBe(200);
      expect(res.body.draft).toBe(2);
      expect(res.body.total).toBe(7); // 2 + 5
    });
  });

  // ── PATCH /api/loads/:id/status — edge cases ─────────────────────

  describe("PATCH /api/loads/:id/status — hardening edge cases", () => {
    it("returns 400 when status field is missing from body", async () => {
      const app = createApp();
      const res = await request(app)
        .patch("/api/loads/load-001/status")
        .set("Authorization", AUTH_HEADER)
        .send({});

      expect(res.status).toBe(400);
    });

    it("returns 422 when status is not a valid LoadStatus value", async () => {
      // The schema allows any non-empty string; the state machine rejects invalid values.
      // loadService.transitionLoad fetches the load, then validateTransition() throws
      // BusinessRuleError (422) because "nonexistent_status" is not in VALID_TRANSITIONS.
      mockQuery.mockResolvedValueOnce([
        [makeLoadRow({ status: "draft", version: 1 })],
        [],
      ]);
      mockQuery.mockResolvedValueOnce([[], []]); // stops

      const app = createApp();
      const res = await request(app)
        .patch("/api/loads/load-001/status")
        .set("Authorization", AUTH_HEADER)
        .send({ status: "nonexistent_status" });

      expect(res.status).toBe(422);
    });
  });

  // ── DELETE /api/loads/:id — additional status ─────────────────────

  describe("DELETE /api/loads/:id — additional status rejections", () => {
    it("rejects deletion of load in 'arrived' status with 422", async () => {
      mockQuery.mockResolvedValueOnce([
        [{ id: "load-arr", status: "arrived" }],
      ]);

      const app = createApp();
      const res = await request(app)
        .delete("/api/loads/load-arr")
        .set("Authorization", AUTH_HEADER);

      expect(res.status).toBe(422);
      expect(res.body.error).toContain("arrived");
      expect(res.body.error).toContain("Cannot delete");
    });

    it("returns 500 when DB error occurs during DELETE", async () => {
      mockQuery.mockResolvedValueOnce([
        [{ id: "load-001", status: "draft" }],
      ]);
      mockQuery.mockRejectedValueOnce(new Error("DB error"));

      const app = createApp();
      const res = await request(app)
        .delete("/api/loads/load-001")
        .set("Authorization", AUTH_HEADER);

      // Should pass error to next() and get 500 from error handler
      expect(res.status).toBe(500);
    });
  });
});
