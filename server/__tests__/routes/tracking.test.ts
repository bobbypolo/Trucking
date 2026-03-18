import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// Tests R-P3-02-AC2: tracking endpoint returns DB-backed load positions
// Tests R-P3-02-AC3: graceful missing-key/fallback behavior

const { mockQuery, mockResolveSqlPrincipalByFirebaseUid } = vi.hoisted(() => {
  const mockQuery = vi.fn();
  return { mockQuery, mockResolveSqlPrincipalByFirebaseUid: vi.fn() };
});

vi.mock("../../db", () => ({
  default: {
    query: mockQuery,
  },
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
                  role: "admin",
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

import trackingRouter from "../../routes/tracking";
import { DEFAULT_SQL_PRINCIPAL } from "../helpers/mock-sql-auth";

mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(DEFAULT_SQL_PRINCIPAL);

const AUTH_HEADER = "Bearer valid-firebase-token";

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(trackingRouter);
  return app;
}

describe("R-P3-02: Tracking Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(DEFAULT_SQL_PRINCIPAL);
  });

  describe("AC2: GET /api/loads/tracking — returns DB-backed positions", () => {
    it("returns load positions with lat/lng from database", async () => {
      const mockLoads = [
        {
          id: "load-001",
          load_number: "L-001",
          status: "Active",
          driver_id: "driver-001",
        },
      ];
      const mockLegs = [
        {
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
        },
        {
          id: "leg-002",
          load_id: "load-001",
          type: "Dropoff",
          facility_name: "Depot B",
          city: "Milwaukee",
          state: "WI",
          latitude: 43.0389,
          longitude: -87.9065,
          completed: false,
          sequence_order: 1,
        },
      ];

      // First query: loads
      mockQuery.mockResolvedValueOnce([mockLoads, []]);
      // Second query: legs for load-001
      mockQuery.mockResolvedValueOnce([mockLegs, []]);

      const app = createApp();
      const res = await request(app).get("/api/loads/tracking").set("Authorization", AUTH_HEADER);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].id).toBe("load-001");
      expect(res.body[0].legs).toHaveLength(2);

      // Verify coordinates come from DB, not hardcoded
      expect(res.body[0].legs[0].latitude).toBe(41.8781);
      expect(res.body[0].legs[0].longitude).toBe(-87.6298);
      expect(res.body[0].legs[1].latitude).toBe(43.0389);
      expect(res.body[0].legs[1].longitude).toBe(-87.9065);
    });

    it("returns empty array when no active loads exist", async () => {
      mockQuery.mockResolvedValueOnce([[], []]);

      const app = createApp();
      const res = await request(app).get("/api/loads/tracking").set("Authorization", AUTH_HEADER);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it("includes currentPosition derived from last completed stop", async () => {
      const mockLoads = [
        {
          id: "load-002",
          load_number: "L-002",
          status: "Active",
          driver_id: "driver-002",
        },
      ];
      const mockLegs = [
        {
          id: "leg-a",
          load_id: "load-002",
          type: "Pickup",
          city: "Dallas",
          state: "TX",
          latitude: 32.7767,
          longitude: -96.797,
          completed: true,
          sequence_order: 0,
        },
        {
          id: "leg-b",
          load_id: "load-002",
          type: "Dropoff",
          city: "Houston",
          state: "TX",
          latitude: 29.7604,
          longitude: -95.3698,
          completed: false,
          sequence_order: 1,
        },
      ];

      mockQuery.mockResolvedValueOnce([mockLoads, []]);
      mockQuery.mockResolvedValueOnce([mockLegs, []]);

      const app = createApp();
      const res = await request(app).get("/api/loads/tracking").set("Authorization", AUTH_HEADER);

      expect(res.status).toBe(200);
      // currentPosition should be the last completed stop
      expect(res.body[0].currentPosition).toEqual({
        latitude: 32.7767,
        longitude: -96.797,
      });
    });

    it("returns null currentPosition when no stops have coordinates", async () => {
      const mockLoads = [
        {
          id: "load-003",
          load_number: "L-003",
          status: "Active",
          driver_id: "d-3",
        },
      ];
      const mockLegs = [
        {
          id: "leg-c",
          load_id: "load-003",
          type: "Pickup",
          city: "Denver",
          state: "CO",
          latitude: null,
          longitude: null,
          completed: true,
          sequence_order: 0,
        },
      ];

      mockQuery.mockResolvedValueOnce([mockLoads, []]);
      mockQuery.mockResolvedValueOnce([mockLegs, []]);

      const app = createApp();
      const res = await request(app).get("/api/loads/tracking").set("Authorization", AUTH_HEADER);

      expect(res.body[0].currentPosition).toBeNull();
    });
  });

  describe("AC2: GET /api/loads/:id/tracking — single load", () => {
    it("returns tracking data for specific load", async () => {
      const mockLoad = [
        {
          id: "load-100",
          load_number: "L-100",
          status: "Active",
          driver_id: "driver-100",
          company_id: "company-aaa",
        },
      ];
      const mockLegs = [
        {
          id: "leg-100",
          load_id: "load-100",
          type: "Pickup",
          latitude: 34.0522,
          longitude: -118.2437,
          completed: false,
          sequence_order: 0,
        },
      ];

      mockQuery.mockResolvedValueOnce([mockLoad, []]);
      mockQuery.mockResolvedValueOnce([mockLegs, []]);

      const app = createApp();
      const res = await request(app).get("/api/loads/load-100/tracking").set("Authorization", AUTH_HEADER);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe("load-100");
      expect(res.body.legs[0].latitude).toBe(34.0522);
    });

    it("returns 404 for non-existent load", async () => {
      mockQuery.mockResolvedValueOnce([[], []]);

      const app = createApp();
      const res = await request(app).get("/api/loads/nonexistent/tracking").set("Authorization", AUTH_HEADER);

      expect(res.status).toBe(404);
    });
  });
});
