import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoisted mocks
const { mockQuery, mockResolveSqlPrincipalByFirebaseUid } = vi.hoisted(() => {
  const mockQuery = vi.fn();
  const mockResolveSqlPrincipalByFirebaseUid = vi.fn();
  return { mockQuery, mockResolveSqlPrincipalByFirebaseUid };
});

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
    child: vi.fn().mockReturnThis(),
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

vi.mock("firebase-admin", () => {
  const mockAuth = {
    verifyIdToken: vi.fn().mockResolvedValue({ uid: "firebase-uid-1" }),
  };
  return {
    default: {
      app: vi.fn(),
      auth: () => mockAuth,
    },
  };
});

vi.mock("../../lib/sql-auth", () => ({
  resolveSqlPrincipalByFirebaseUid: mockResolveSqlPrincipalByFirebaseUid,
}));

import express from "express";
import request from "supertest";
import geofenceRouter from "../../routes/geofence";
import { errorHandler } from "../../middleware/errorHandler";
import { DEFAULT_SQL_PRINCIPAL } from "../helpers/mock-sql-auth";

mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(DEFAULT_SQL_PRINCIPAL);

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(geofenceRouter);
  app.use(errorHandler);
  return app;
}

const AUTH_HEADER = { Authorization: "Bearer valid-token" };

describe("Geofence Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
  });

  // ── POST /api/geofence-events ──────────────────────────────────────────

  describe("POST /api/geofence-events", () => {
    it("returns 400 when loadId is missing", async () => {
      const app = buildApp();
      const res = await request(app)
        .post("/api/geofence-events")
        .set(AUTH_HEADER)
        .send({ eventType: "ENTRY", facilityLat: 33.0, facilityLng: -97.0 });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Validation failed");
      expect(res.body.details.fields).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: "loadId" }),
        ]),
      );
    });

    it("returns 400 when eventType is invalid", async () => {
      const app = buildApp();
      const res = await request(app)
        .post("/api/geofence-events")
        .set(AUTH_HEADER)
        .send({
          loadId: "load-1",
          eventType: "HOVER",
          facilityLat: 33.0,
          facilityLng: -97.0,
        });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Validation failed");
      expect(res.body.details.fields).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: "eventType" }),
        ]),
      );
    });

    it("returns 400 when facilityLat/Lng missing", async () => {
      const app = buildApp();
      const res = await request(app)
        .post("/api/geofence-events")
        .set(AUTH_HEADER)
        .send({ loadId: "load-1", eventType: "ENTRY" });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Validation failed");
      expect(res.body.details.fields).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: "facilityLat" }),
          expect.objectContaining({ field: "facilityLng" }),
        ]),
      );
    });

    it("returns 404 when load does not belong to tenant", async () => {
      mockQuery.mockResolvedValueOnce([[{ company_id: "other-company" }]]);
      const app = buildApp();
      const res = await request(app)
        .post("/api/geofence-events")
        .set(AUTH_HEADER)
        .send({
          loadId: "load-1",
          eventType: "ENTRY",
          facilityLat: 33.0,
          facilityLng: -97.0,
        });
      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Load not found");
    });

    it("creates geofence event and returns 201", async () => {
      // First query: load lookup
      mockQuery.mockResolvedValueOnce([
        [{ company_id: DEFAULT_SQL_PRINCIPAL.tenantId }],
      ]);
      // Second query: INSERT
      mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }]);

      const app = buildApp();
      const res = await request(app)
        .post("/api/geofence-events")
        .set(AUTH_HEADER)
        .send({
          loadId: "load-1",
          eventType: "ENTRY",
          facilityLat: 33.1234,
          facilityLng: -97.5678,
          facilityName: "Warehouse A",
        });
      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.message).toBe("Geofence event recorded");
    });

    it("returns 401 when no auth token", async () => {
      const app = buildApp();
      const res = await request(app)
        .post("/api/geofence-events")
        .send({ loadId: "load-1", eventType: "ENTRY", facilityLat: 33, facilityLng: -97 });
      expect(res.status).toBe(401);
    });
  });

  // ── GET /api/geofence-events ───────────────────────────────────────────

  describe("GET /api/geofence-events", () => {
    it("returns 400 when loadId query is missing", async () => {
      const app = buildApp();
      const res = await request(app)
        .get("/api/geofence-events")
        .set(AUTH_HEADER);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("loadId query parameter is required");
    });

    it("returns events for a given loadId", async () => {
      const mockEvents = [
        {
          id: "ev-1",
          load_id: "load-1",
          event_type: "ENTRY",
          event_timestamp: "2026-03-20T10:00:00",
        },
        {
          id: "ev-2",
          load_id: "load-1",
          event_type: "EXIT",
          event_timestamp: "2026-03-20T14:00:00",
        },
      ];
      mockQuery.mockResolvedValueOnce([mockEvents]);

      const app = buildApp();
      const res = await request(app)
        .get("/api/geofence-events?loadId=load-1")
        .set(AUTH_HEADER);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].event_type).toBe("ENTRY");
      expect(res.body[1].event_type).toBe("EXIT");
    });
  });

  // ── POST /api/detention/calculate ──────────────────────────────────────

  describe("POST /api/detention/calculate", () => {
    it("returns 400 when loadId is missing", async () => {
      const app = buildApp();
      const res = await request(app)
        .post("/api/detention/calculate")
        .set(AUTH_HEADER)
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Validation failed");
      expect(res.body.details.fields).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: "loadId" }),
        ]),
      );
    });

    it("calculates zero detention for 0h dwell (no events)", async () => {
      // geofence events query
      mockQuery.mockResolvedValueOnce([[]]);
      // detention rules query
      mockQuery.mockResolvedValueOnce([[]]);

      const app = buildApp();
      const res = await request(app)
        .post("/api/detention/calculate")
        .set(AUTH_HEADER)
        .send({ loadId: "load-1" });
      expect(res.status).toBe(200);
      expect(res.body.records).toHaveLength(0);
      expect(res.body.totalCharge).toBe(0);
    });

    it("calculates zero detention for 1h dwell (under free time)", async () => {
      const entry = "2026-03-20T10:00:00";
      const exit = "2026-03-20T11:00:00"; // 1 hour dwell
      mockQuery.mockResolvedValueOnce([
        [
          {
            id: "ev-1",
            facility_name: "WH-A",
            facility_lat: 33.0,
            facility_lng: -97.0,
            event_type: "ENTRY",
            event_timestamp: entry,
          },
          {
            id: "ev-2",
            facility_name: "WH-A",
            facility_lat: 33.0,
            facility_lng: -97.0,
            event_type: "EXIT",
            event_timestamp: exit,
          },
        ],
      ]);
      // No custom rules — use defaults (2h free, $75/hr)
      mockQuery.mockResolvedValueOnce([[]]);

      const app = buildApp();
      const res = await request(app)
        .post("/api/detention/calculate")
        .set(AUTH_HEADER)
        .send({ loadId: "load-1" });
      expect(res.status).toBe(200);
      expect(res.body.records).toHaveLength(1);
      expect(res.body.records[0].dwellHours).toBe(1);
      expect(res.body.records[0].billableHours).toBe(0);
      expect(res.body.records[0].charge).toBe(0);
      expect(res.body.totalCharge).toBe(0);
    });

    it("calculates detention for 2h dwell (at free time boundary)", async () => {
      const entry = "2026-03-20T10:00:00";
      const exit = "2026-03-20T12:00:00"; // exactly 2 hours
      mockQuery.mockResolvedValueOnce([
        [
          {
            id: "ev-1",
            facility_name: "WH-A",
            facility_lat: 33.0,
            facility_lng: -97.0,
            event_type: "ENTRY",
            event_timestamp: entry,
          },
          {
            id: "ev-2",
            facility_name: "WH-A",
            facility_lat: 33.0,
            facility_lng: -97.0,
            event_type: "EXIT",
            event_timestamp: exit,
          },
        ],
      ]);
      mockQuery.mockResolvedValueOnce([[]]);

      const app = buildApp();
      const res = await request(app)
        .post("/api/detention/calculate")
        .set(AUTH_HEADER)
        .send({ loadId: "load-1" });
      expect(res.status).toBe(200);
      expect(res.body.records[0].dwellHours).toBe(2);
      expect(res.body.records[0].billableHours).toBe(0);
      expect(res.body.records[0].charge).toBe(0);
    });

    it("calculates detention for 5h dwell (3h billable)", async () => {
      const entry = "2026-03-20T08:00:00";
      const exit = "2026-03-20T13:00:00"; // 5 hours
      mockQuery.mockResolvedValueOnce([
        [
          {
            id: "ev-1",
            facility_name: "WH-B",
            facility_lat: 34.0,
            facility_lng: -98.0,
            event_type: "ENTRY",
            event_timestamp: entry,
          },
          {
            id: "ev-2",
            facility_name: "WH-B",
            facility_lat: 34.0,
            facility_lng: -98.0,
            event_type: "EXIT",
            event_timestamp: exit,
          },
        ],
      ]);
      mockQuery.mockResolvedValueOnce([[]]);

      const app = buildApp();
      const res = await request(app)
        .post("/api/detention/calculate")
        .set(AUTH_HEADER)
        .send({ loadId: "load-1" });
      expect(res.status).toBe(200);
      expect(res.body.records[0].dwellHours).toBe(5);
      expect(res.body.records[0].billableHours).toBe(3);
      expect(res.body.records[0].charge).toBe(225); // 3 * $75
      expect(res.body.totalCharge).toBe(225);
    });

    it("caps billable hours at maxBillableHours for 26h dwell", async () => {
      const entry = "2026-03-20T00:00:00";
      const exit = "2026-03-21T02:00:00"; // 26 hours
      mockQuery.mockResolvedValueOnce([
        [
          {
            id: "ev-1",
            facility_name: "WH-C",
            facility_lat: 35.0,
            facility_lng: -99.0,
            event_type: "ENTRY",
            event_timestamp: entry,
          },
          {
            id: "ev-2",
            facility_name: "WH-C",
            facility_lat: 35.0,
            facility_lng: -99.0,
            event_type: "EXIT",
            event_timestamp: exit,
          },
        ],
      ]);
      // Default rules: 2h free, $75/hr, 24h max
      mockQuery.mockResolvedValueOnce([[]]);

      const app = buildApp();
      const res = await request(app)
        .post("/api/detention/calculate")
        .set(AUTH_HEADER)
        .send({ loadId: "load-1" });
      expect(res.status).toBe(200);
      expect(res.body.records[0].dwellHours).toBe(26);
      // billable = min(26 - 2, 24) = 24
      expect(res.body.records[0].billableHours).toBe(24);
      expect(res.body.records[0].charge).toBe(1800); // 24 * $75
    });

    it("ignores EXIT without prior ENTRY", async () => {
      mockQuery.mockResolvedValueOnce([
        [
          {
            id: "ev-orphan",
            facility_name: "WH-X",
            facility_lat: 36.0,
            facility_lng: -100.0,
            event_type: "EXIT",
            event_timestamp: "2026-03-20T14:00:00",
          },
        ],
      ]);
      mockQuery.mockResolvedValueOnce([[]]);

      const app = buildApp();
      const res = await request(app)
        .post("/api/detention/calculate")
        .set(AUTH_HEADER)
        .send({ loadId: "load-1" });
      expect(res.status).toBe(200);
      expect(res.body.records).toHaveLength(0);
      expect(res.body.totalCharge).toBe(0);
    });

    it("uses custom detention rules when available", async () => {
      const entry = "2026-03-20T08:00:00";
      const exit = "2026-03-20T13:00:00"; // 5 hours
      mockQuery.mockResolvedValueOnce([
        [
          {
            id: "ev-1",
            facility_name: "WH-D",
            facility_lat: 33.0,
            facility_lng: -97.0,
            event_type: "ENTRY",
            event_timestamp: entry,
          },
          {
            id: "ev-2",
            facility_name: "WH-D",
            facility_lat: 33.0,
            facility_lng: -97.0,
            event_type: "EXIT",
            event_timestamp: exit,
          },
        ],
      ]);
      // Custom rules: 1h free, $100/hr, 12h max
      mockQuery.mockResolvedValueOnce([
        [{ free_hours: 1.0, hourly_rate: 100.0, max_billable_hours: 12.0 }],
      ]);

      const app = buildApp();
      const res = await request(app)
        .post("/api/detention/calculate")
        .set(AUTH_HEADER)
        .send({ loadId: "load-1" });
      expect(res.status).toBe(200);
      // billable = 5 - 1 = 4h, charge = 4 * $100 = $400
      expect(res.body.records[0].billableHours).toBe(4);
      expect(res.body.records[0].charge).toBe(400);
      expect(res.body.rules.freeHours).toBe(1);
      expect(res.body.rules.hourlyRate).toBe(100);
    });
  });
});
