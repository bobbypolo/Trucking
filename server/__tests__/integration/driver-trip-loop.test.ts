import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import type { RowDataPacket } from "mysql2/promise";

/**
 * Tests R-P9-05
 *
 * Server integration test: create load with stops, GET stops,
 * PATCH arrive, POST exception, verify escalation message created,
 * verify push notification dispatched.
 *
 * Mocks at the pool.query boundary to verify the full server-side
 * driver trip loop without requiring a real database.
 */

const mockQuery = vi.fn();

// Mock the db pool
vi.mock("../../db", () => ({
  default: {
    query: (...args: unknown[]) => mockQuery(...args),
    execute: vi.fn().mockResolvedValue([[], []]),
    getConnection: vi.fn().mockResolvedValue({
      query: vi.fn().mockResolvedValue([[], []]),
      execute: vi.fn().mockResolvedValue([[], []]),
      beginTransaction: vi.fn().mockResolvedValue(undefined),
      commit: vi.fn().mockResolvedValue(undefined),
      rollback: vi.fn().mockResolvedValue(undefined),
      release: vi.fn(),
    }),
  },
}));

// Mock token revocation
vi.mock("../../lib/token-revocation", () => ({
  isTokenRevoked: vi.fn().mockResolvedValue(false),
  revokeUserTokens: vi.fn().mockResolvedValue(undefined),
}));

// Mock requireAuth to inject test user without Firebase
vi.mock("../../middleware/requireAuth", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("../../middleware/requireAuth")>();
  return {
    ...original,
    requireAuth: (req: any, _res: any, next: any) => {
      req.user = {
        id: "user-1",
        uid: "user-1",
        tenantId: "tenant-1",
        companyId: "tenant-1",
        role: "driver",
        email: "driver@test.com",
        firebaseUid: "firebase-uid-1",
      };
      next();
    },
  };
});

// Mock requireTenant to pass through
vi.mock("../../middleware/requireTenant", () => ({
  requireTenant: (_req: any, _res: any, next: any) => {
    next();
  },
}));

// Track notification delivery calls
const mockDeliverNotification = vi.fn().mockResolvedValue({
  status: "SENT",
  sent_at: "2026-04-10T08:10:00Z",
});

vi.mock("../../services/notification-delivery.service", () => ({
  deliverNotification: (...args: unknown[]) => mockDeliverNotification(...args),
}));

// Track message repository calls
const mockMessageCreate = vi.fn().mockResolvedValue({
  id: "msg-1",
  company_id: "tenant-1",
  load_id: "load-100",
  text: "[Exception] Driver reported: DELAY_REPORTED - Waiting for dock",
});

vi.mock("../../repositories/message.repository", () => ({
  messageRepository: {
    create: (...args: unknown[]) => mockMessageCreate(...args),
  },
}));

// Mock logger
vi.mock("../../lib/logger", () => ({
  createChildLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }),
  },
}));

// Mock expo-push
vi.mock("../../lib/expo-push", () => ({
  sendPush: vi.fn().mockResolvedValue({ sent: 1, errors: [] }),
}));

// Build a minimal express app with the routes under test
async function createTestApp() {
  const app = express();
  app.use(express.json());

  const driverStopsModule = await import("../../routes/driver-stops");
  const driverExceptionsModule = await import("../../routes/driver-exceptions");

  app.use(driverStopsModule.default);
  app.use(driverExceptionsModule.default);

  // Error handler
  app.use(
    (
      err: any,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      res.status(err.statusCode || 500).json({ message: err.message });
    },
  );

  return app;
}

describe("R-P9-05: Server driver trip loop integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock: return empty results
    mockQuery.mockResolvedValue([[] as RowDataPacket[], []]);
  });

  // # Tests R-P9-05
  it("full loop: GET stops, PATCH arrive, POST exception, verify escalation message + push notification", async () => {
    const app = await createTestApp();

    // ---- Step 1: GET /api/loads/:loadId/stops ----
    mockQuery
      // Load exists check
      .mockResolvedValueOnce([[{ id: "load-100" }] as RowDataPacket[], []])
      // Stops for the load
      .mockResolvedValueOnce([
        [
          {
            id: "stop-1",
            load_id: "load-100",
            type: "Pickup",
            facility_name: "Warehouse A",
            city: "Dallas",
            state: "TX",
            date: "2026-04-10",
            appointment_time: "08:00 AM",
            completed: false,
            sequence_order: 1,
            status: "pending",
            arrived_at: null,
            departed_at: null,
          },
          {
            id: "stop-2",
            load_id: "load-100",
            type: "Dropoff",
            facility_name: "Distribution Center B",
            city: "Houston",
            state: "TX",
            date: "2026-04-11",
            appointment_time: "02:00 PM",
            completed: false,
            sequence_order: 2,
            status: "pending",
            arrived_at: null,
            departed_at: null,
          },
        ] as RowDataPacket[],
        [],
      ]);

    const stopsRes = await request(app)
      .get("/api/loads/load-100/stops")
      .set("Authorization", "Bearer test-token")
      .expect(200);

    expect(stopsRes.body.stops).toHaveLength(2);
    expect(stopsRes.body.stops[0].facility_name).toBe("Warehouse A");
    expect(stopsRes.body.stops[0].status).toBe("pending");
    expect(stopsRes.body.stops[1].facility_name).toBe("Distribution Center B");

    // ---- Step 2: PATCH /api/loads/:loadId/stops/:stopId (arrive) ----
    mockQuery
      // Verify stop exists
      .mockResolvedValueOnce([[{ id: "stop-1" }] as RowDataPacket[], []])
      // UPDATE result
      .mockResolvedValueOnce([{ affectedRows: 1 }, []])
      // Fetch updated stop
      .mockResolvedValueOnce([
        [
          {
            id: "stop-1",
            load_id: "load-100",
            type: "Pickup",
            facility_name: "Warehouse A",
            city: "Dallas",
            state: "TX",
            date: "2026-04-10",
            appointment_time: "08:00 AM",
            completed: false,
            sequence_order: 1,
            status: "arrived",
            arrived_at: "2026-04-10T08:05:00Z",
            departed_at: null,
          },
        ] as RowDataPacket[],
        [],
      ]);

    const patchRes = await request(app)
      .patch("/api/loads/load-100/stops/stop-1")
      .set("Authorization", "Bearer test-token")
      .send({ status: "arrived", arrived_at: "2026-04-10T08:05:00Z" })
      .expect(200);

    expect(patchRes.body.stop.status).toBe("arrived");
    expect(patchRes.body.stop.arrived_at).toBe("2026-04-10T08:05:00Z");

    // ---- Step 3: POST /api/driver/exceptions ----
    mockQuery
      // Verify load exists and get dispatcher_id
      .mockResolvedValueOnce([
        [{ id: "load-100", dispatcher_id: "dispatcher-1" }] as RowDataPacket[],
        [],
      ])
      // INSERT exception
      .mockResolvedValueOnce([{ affectedRows: 1 }, []])
      // INSERT exception_event
      .mockResolvedValueOnce([{ affectedRows: 1 }, []]);

    const exceptionRes = await request(app)
      .post("/api/driver/exceptions")
      .set("Authorization", "Bearer test-token")
      .send({
        issue_type: "DELAY_REPORTED",
        load_id: "load-100",
        description: "Waiting for dock assignment",
      })
      .expect(201);

    expect(exceptionRes.body.id).toBeTruthy();
    expect(typeof exceptionRes.body.id).toBe("string");
    expect(exceptionRes.body.id.length).toBeGreaterThan(0);

    // ---- Step 4: Verify escalation message was created ----
    expect(mockMessageCreate).toHaveBeenCalledTimes(1);
    const messageCall = mockMessageCreate.mock.calls[0];
    expect(messageCall[0].load_id).toBe("load-100");
    expect(messageCall[0].text).toContain("DELAY_REPORTED");
    expect(messageCall[0].text).toContain("Waiting for dock assignment");
    expect(messageCall[1]).toBe("tenant-1");

    // ---- Step 5: Verify push notification was dispatched ----
    expect(mockDeliverNotification).toHaveBeenCalledTimes(1);
    const notifyCall = mockDeliverNotification.mock.calls[0][0];
    expect(notifyCall.channel).toBe("push");
    expect(notifyCall.message).toContain("DELAY_REPORTED");
    expect(notifyCall.message).toContain("load-100");
    expect(notifyCall.recipients).toEqual([{ id: "dispatcher-1" }]);
  });
});
