import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// Tests R-P3-09, R-P3-10, R-P3-11

const { mockQuery, mockResolveSqlPrincipalByFirebaseUid } = vi.hoisted(() => {
  const mockQuery = vi.fn();
  return { mockQuery, mockResolveSqlPrincipalByFirebaseUid: vi.fn() };
});

const { mockGetVehicleLocations } = vi.hoisted(() => ({
  mockGetVehicleLocations: vi.fn(),
}));

vi.mock("../../db", () => ({
  default: {
    query: mockQuery,
  },
}));

vi.mock("../../services/gps", () => ({
  getGpsProvider: () => ({
    getVehicleLocations: mockGetVehicleLocations,
  }),
  getGpsProviderForTenant: vi.fn().mockResolvedValue({
    provider: { getVehicleLocations: mockGetVehicleLocations },
    state: "configured-live",
    providerName: "samsara",
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

// Mock requireTier to pass-through (these tests focus on GPS functionality, not tier gating)
vi.mock("../../middleware/requireTier", () => ({
  requireTier: () => (_req: any, _res: any, next: any) => next(),
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

describe("S-303: GPS Live Tracking Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
    // Default mock: return empty result for any unmatched DB query
    mockQuery.mockResolvedValue([[], []]);
    // Reset env
    delete process.env.GPS_WEBHOOK_SECRET;
  });

  describe("R-P3-09: GET /api/tracking/live", () => {
    it("returns positions from GPS provider with auth", async () => {
      const mockPositions = [
        {
          vehicleId: "truck-1",
          latitude: 41.8781,
          longitude: -87.6298,
          speed: 55,
          heading: 180,
          recordedAt: new Date("2026-03-22T10:00:00Z"),
          provider: "samsara",
          providerVehicleId: "truck-1",
        },
      ];
      mockGetVehicleLocations.mockResolvedValueOnce(mockPositions);
      // Mock the DB insert (gps_positions)
      mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

      const app = createApp();
      const res = await request(app)
        .get("/api/tracking/live")
        .set("Authorization", AUTH_HEADER);

      expect(res.status).toBe(200);
      expect(res.body.positions).toHaveLength(1);
      expect(res.body.positions[0]).toMatchObject({
        vehicleId: "truck-1",
        latitude: 41.8781,
        longitude: -87.6298,
        speed: 55,
        heading: 180,
      });
    });

    it("stores received positions in gps_positions table", async () => {
      const mockPositions = [
        {
          vehicleId: "truck-1",
          latitude: 40.7128,
          longitude: -74.006,
          speed: 45,
          heading: 90,
          recordedAt: new Date("2026-03-22T12:00:00Z"),
          provider: "samsara",
          providerVehicleId: "sv-1",
        },
      ];
      mockGetVehicleLocations.mockResolvedValueOnce(mockPositions);
      mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

      const app = createApp();
      await request(app)
        .get("/api/tracking/live")
        .set("Authorization", AUTH_HEADER);

      // Verify DB insert was called for position storage
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO gps_positions"),
        expect.arrayContaining(["company-aaa", "truck-1", 40.7128, -74.006]),
      );
    });

    it("returns 401 without auth", async () => {
      const app = createApp();
      const res = await request(app).get("/api/tracking/live");

      expect(res.status).toBe(401);
    });

    it("returns empty positions array when provider returns none", async () => {
      mockGetVehicleLocations.mockResolvedValueOnce([]);

      const app = createApp();
      const res = await request(app)
        .get("/api/tracking/live")
        .set("Authorization", AUTH_HEADER);

      expect(res.status).toBe(200);
      expect(res.body.positions).toEqual([]);
    });
  });

  describe("R-P3-10: POST /api/tracking/webhook", () => {
    it("accepts valid GPS ping with correct API key", async () => {
      process.env.GPS_WEBHOOK_SECRET = "test-gps-secret-key";
      mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

      const app = createApp();
      const res = await request(app)
        .post("/api/tracking/webhook")
        .set("X-GPS-API-Key", "test-gps-secret-key")
        .send({
          vehicleId: "truck-1",
          latitude: 40.7128,
          longitude: -74.006,
          speed: 55,
          heading: 180,
        });

      expect(res.status).toBe(201);
      expect(res.body.stored).toBe(true);
    });

    it("rejects request with missing X-GPS-API-Key header", async () => {
      process.env.GPS_WEBHOOK_SECRET = "test-gps-secret-key";

      const app = createApp();
      const res = await request(app).post("/api/tracking/webhook").send({
        vehicleId: "truck-1",
        latitude: 40.7128,
        longitude: -74.006,
      });

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/API key/i);
    });

    it("rejects request with invalid X-GPS-API-Key header", async () => {
      process.env.GPS_WEBHOOK_SECRET = "test-gps-secret-key";

      const app = createApp();
      const res = await request(app)
        .post("/api/tracking/webhook")
        .set("X-GPS-API-Key", "wrong-key")
        .send({
          vehicleId: "truck-1",
          latitude: 40.7128,
          longitude: -74.006,
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/Invalid API key/i);
    });

    it("validates required fields — rejects missing latitude", async () => {
      process.env.GPS_WEBHOOK_SECRET = "test-gps-secret-key";

      const app = createApp();
      const res = await request(app)
        .post("/api/tracking/webhook")
        .set("X-GPS-API-Key", "test-gps-secret-key")
        .send({
          vehicleId: "truck-1",
          longitude: -74.006,
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/latitude/i);
    });

    it("validates required fields — rejects missing vehicleId", async () => {
      process.env.GPS_WEBHOOK_SECRET = "test-gps-secret-key";

      const app = createApp();
      const res = await request(app)
        .post("/api/tracking/webhook")
        .set("X-GPS-API-Key", "test-gps-secret-key")
        .send({
          latitude: 40.7128,
          longitude: -74.006,
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/vehicleId/i);
    });

    it("stores webhook position in gps_positions table", async () => {
      process.env.GPS_WEBHOOK_SECRET = "test-gps-secret-key";
      mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

      const app = createApp();
      await request(app)
        .post("/api/tracking/webhook")
        .set("X-GPS-API-Key", "test-gps-secret-key")
        .send({
          vehicleId: "truck-1",
          latitude: 40.7128,
          longitude: -74.006,
          speed: 55,
          heading: 180,
        });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO gps_positions"),
        expect.arrayContaining(["truck-1", 40.7128, -74.006]),
      );
    });
  });

  describe("R-P3-11: Backward compatibility", () => {
    it("GET /api/loads/tracking still works unchanged", async () => {
      const mockLoads = [
        {
          id: "load-001",
          load_number: "L-001",
          status: "in_transit",
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
      ];

      mockQuery.mockResolvedValueOnce([mockLoads, []]);
      mockQuery.mockResolvedValueOnce([mockLegs, []]);

      const app = createApp();
      const res = await request(app)
        .get("/api/loads/tracking")
        .set("Authorization", AUTH_HEADER);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].id).toBe("load-001");
      expect(res.body[0].legs).toHaveLength(1);
      expect(res.body[0].currentPosition).toEqual({
        latitude: 41.8781,
        longitude: -87.6298,
      });
    });

    it("GET /api/loads/:id/tracking still works unchanged", async () => {
      const mockLoad = [
        {
          id: "load-100",
          load_number: "L-100",
          status: "dispatched",
          driver_id: "driver-100",
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
      const res = await request(app)
        .get("/api/loads/load-100/tracking")
        .set("Authorization", AUTH_HEADER);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe("load-100");
    });
  });
});
