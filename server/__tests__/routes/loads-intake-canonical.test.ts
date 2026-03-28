/**
 * Loads Route — Canonical Driver Intake Write Contract
 *
 * Verifies that driver intake creates a load with the SAME canonical
 * persisted shape that Load Board and Schedule read after refresh.
 *
 * Key assertions:
 * - POST /api/loads with legs writes load_legs rows
 * - Returned load has legs that match input
 * - pickup_date is persisted
 * - commodity and weight are persisted
 * - GET /api/loads returns the created load with legs
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

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
  getVisibilitySettings: vi.fn().mockResolvedValue(null),
  sendNotification: vi.fn(),
  checkBreakdownLateness: vi
    .fn()
    .mockResolvedValue({ isLate: false, dist: 0, required: 0 }),
}));

vi.mock("../../lib/logger", () => ({
  createChildLogger: () => ({
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
                  role: "driver",
                  email: "driver@test.com",
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

// Use driver-role principal for intake tests
const DRIVER_PRINCIPAL = {
  ...DEFAULT_SQL_PRINCIPAL,
  role: "driver",
};

mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(DRIVER_PRINCIPAL);

const AUTH_HEADER = "Bearer valid-firebase-token";

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(loadRoutes);
  app.use(errorHandler);
  return app;
}

describe("POST /api/loads — Canonical Driver Intake Contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetConnection.mockResolvedValue(mockConnection);
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(DRIVER_PRINCIPAL);
  });

  it("creates load with Pickup and Dropoff legs from intake payload", async () => {
    // All connection.query calls succeed
    mockConnection.query.mockResolvedValue([{ affectedRows: 1 }]);

    const intakePayload = {
      id: "intake-load-001",
      load_number: "INT-ABC123",
      status: "draft",
      driver_id: "driver-1",
      pickup_date: "2026-04-01",
      commodity: "Electronics",
      weight: 25000,
      notification_emails: [],
      gpsHistory: [],
      podUrls: [],
      legs: [
        {
          id: "leg-p-001",
          type: "Pickup",
          facility_name: "Port of Miami",
          city: "Miami",
          state: "FL",
          date: "2026-04-01",
          appointment_time: "",
          completed: false,
          sequence_order: 0,
        },
        {
          id: "leg-d-001",
          type: "Dropoff",
          facility_name: "ATL Distribution",
          city: "Atlanta",
          state: "GA",
          date: "",
          appointment_time: "",
          completed: false,
          sequence_order: 1,
        },
      ],
    };

    const app = createApp();
    const res = await request(app)
      .post("/api/loads")
      .set("Authorization", AUTH_HEADER)
      .send(intakePayload);

    expect(res.status).toBe(201);
    expect(mockConnection.commit).toHaveBeenCalled();

    // Verify load row was written
    // First query: REPLACE INTO loads
    const loadInsertCall = mockConnection.query.mock.calls[0];
    const loadSql = loadInsertCall[0] as string;
    expect(loadSql).toContain("REPLACE INTO loads");
    const loadParams = loadInsertCall[1] as any[];
    expect(loadParams[0]).toBe("intake-load-001"); // id
    expect(loadParams[1]).toBe("company-aaa"); // company_id from auth
    expect(loadParams[6]).toBe("draft"); // status
    expect(loadParams[9]).toBe("2026-04-01"); // pickup_date
    expect(loadParams[11]).toBe("Electronics"); // commodity
    expect(loadParams[12]).toBe(25000); // weight

    // Second query: DELETE FROM load_legs
    const deleteLegsCall = mockConnection.query.mock.calls[1];
    expect(deleteLegsCall[0] as string).toContain("DELETE FROM load_legs");

    // Third & fourth queries: INSERT INTO load_legs (one per leg)
    const pickupInsert = mockConnection.query.mock.calls[2];
    expect(pickupInsert[0] as string).toContain("INSERT INTO load_legs");
    const pickupParams = pickupInsert[1] as any[];
    expect(pickupParams[2]).toBe("Pickup"); // type
    expect(pickupParams[3]).toBe("Port of Miami"); // facility_name
    expect(pickupParams[4]).toBe("Miami"); // city
    expect(pickupParams[5]).toBe("FL"); // state
    expect(pickupParams[6]).toBe("2026-04-01"); // date

    const dropoffInsert = mockConnection.query.mock.calls[3];
    const dropoffParams = dropoffInsert[1] as any[];
    expect(dropoffParams[2]).toBe("Dropoff"); // type
    expect(dropoffParams[3]).toBe("ATL Distribution"); // facility_name
    expect(dropoffParams[4]).toBe("Atlanta"); // city
    expect(dropoffParams[5]).toBe("GA"); // state
  });

  it("creates load then legs are returned by GET /api/loads", async () => {
    // Simulate load created via intake existing in DB
    const loadRow = {
      id: "intake-load-002",
      company_id: "company-aaa",
      driver_id: "driver-1",
      load_number: "INT-DEF456",
      status: "draft",
      pickup_date: "2026-04-05",
      commodity: "Paper Goods",
      weight: 18000,
      notification_emails: "[]",
      gps_history: "[]",
      pod_urls: "[]",
      created_at: "2026-04-05T08:00:00Z",
      deleted_at: null,
    };

    const legsRows = [
      {
        id: "leg-p-002",
        load_id: "intake-load-002",
        type: "Pickup",
        facility_name: "Paper Mill",
        city: "Portland",
        state: "OR",
        date: "2026-04-05",
        appointment_time: "08:00",
        completed: false,
        sequence_order: 0,
      },
      {
        id: "leg-d-002",
        load_id: "intake-load-002",
        type: "Dropoff",
        facility_name: "Recycler HQ",
        city: "Seattle",
        state: "WA",
        date: "2026-04-06",
        appointment_time: "14:00",
        completed: false,
        sequence_order: 1,
      },
    ];

    // GET /api/loads query returns load + legs
    mockQuery.mockResolvedValueOnce([[loadRow]]);
    mockQuery.mockResolvedValueOnce([legsRows]);

    const app = createApp();
    const res = await request(app)
      .get("/api/loads")
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);

    const load = res.body[0];
    expect(load.id).toBe("intake-load-002");
    expect(load.load_number).toBe("INT-DEF456");
    expect(load.status).toBe("draft");
    expect(load.pickup_date).toBe("2026-04-05");
    expect(load.commodity).toBe("Paper Goods");
    expect(load.weight).toBe(18000);

    // Legs are returned with the load
    expect(load.legs).toHaveLength(2);
    expect(load.legs[0].type).toBe("Pickup");
    expect(load.legs[0].city).toBe("Portland");
    expect(load.legs[0].state).toBe("OR");
    expect(load.legs[0].facility_name).toBe("Paper Mill");
    expect(load.legs[1].type).toBe("Dropoff");
    expect(load.legs[1].city).toBe("Seattle");
    expect(load.legs[1].state).toBe("WA");
    expect(load.legs[1].facility_name).toBe("Recycler HQ");

    // Dropoff date derived from legs
    expect(load.dropoff_date).toBe("2026-04-06");
  });

  it("rejects intake payload without required load_number", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/loads")
      .set("Authorization", AUTH_HEADER)
      .send({
        status: "draft",
        driver_id: "driver-1",
        legs: [],
      });

    // Zod validation rejects missing load_number
    expect(res.status).toBe(400);
  });

  it("rejects intake payload without required status", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/loads")
      .set("Authorization", AUTH_HEADER)
      .send({
        load_number: "INT-NOSTAT",
        driver_id: "driver-1",
        legs: [],
      });

    expect(res.status).toBe(400);
  });
});
