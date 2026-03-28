import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Regression test: POST /api/safety/maintenance auto-creates a linked exception.
 *
 * This file proves that "maintenance is owned by the canonical exception queue":
 * every maintenance record insertion triggers a corresponding INSERT into the
 * exceptions table whose `links` JSON column contains the maintenanceRecordId.
 *
 * Tests R-MAINT-EXCEPT-01, R-MAINT-EXCEPT-02, R-MAINT-EXCEPT-03
 */

// Hoisted mocks — must be declared before vi.mock calls
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
  createChildLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    child: function () {
      return this;
    },
  },
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

vi.mock("../../services/cert-expiry-checker", () => ({
  checkExpiring: vi.fn().mockResolvedValue([]),
}));

import express from "express";
import request from "supertest";
import safetyRouter from "../../routes/safety";
import { errorHandler } from "../../middleware/errorHandler";
import { DEFAULT_SQL_PRINCIPAL } from "../helpers/mock-sql-auth";

mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(DEFAULT_SQL_PRINCIPAL);

const AUTH_HEADER = "Bearer valid-firebase-token";
const TENANT_A = "company-aaa";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(safetyRouter);
  app.use(errorHandler);
  return app;
}

// ── R-MAINT-EXCEPT-01 — Maintenance create triggers exception INSERT ──────────

describe("POST /api/safety/maintenance — exception auto-link — R-MAINT-EXCEPT-01", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    app = buildApp();
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
  });

  it("calls pool.query three times: maintenance INSERT, exception INSERT, exception_event INSERT", async () => {
    /**
     * Tests R-MAINT-EXCEPT-01
     * The route executes exactly 3 SQL writes in sequence:
     *   1. INSERT INTO safety_maintenance
     *   2. INSERT INTO exceptions  (cross-link)
     *   3. INSERT INTO exception_events  (audit trail)
     */
    mockQuery
      .mockResolvedValueOnce([{ insertId: 1 }, []]) // safety_maintenance INSERT
      .mockResolvedValueOnce([{ insertId: 2 }, []]) // exceptions INSERT
      .mockResolvedValueOnce([{ insertId: 3 }, []]); // exception_events INSERT

    const res = await request(app)
      .post("/api/safety/maintenance")
      .set("Authorization", AUTH_HEADER)
      .send({
        vehicle_id: "truck-01",
        type: "Oil Change",
        description: "Full synthetic oil change",
        status: "Scheduled",
        scheduled_date: "2026-05-01",
      });

    expect(res.status).toBe(201);
    expect(mockQuery).toHaveBeenCalledTimes(3);
  });

  it("second pool.query call targets the exceptions table", async () => {
    /**
     * Tests R-MAINT-EXCEPT-01
     * Verifies that the second SQL call is an INSERT into `exceptions`,
     * not some other table.
     */
    mockQuery
      .mockResolvedValueOnce([{ insertId: 1 }, []])
      .mockResolvedValueOnce([{ insertId: 2 }, []])
      .mockResolvedValueOnce([{ insertId: 3 }, []]);

    await request(app)
      .post("/api/safety/maintenance")
      .set("Authorization", AUTH_HEADER)
      .send({ vehicle_id: "truck-02", type: "Brake Inspection" });

    const [exceptionSql] = mockQuery.mock.calls[1] as [string, unknown[]];
    expect(exceptionSql).toMatch(/INSERT\s+INTO\s+exceptions/i);
  });

  it("third pool.query call targets the exception_events table", async () => {
    /**
     * Tests R-MAINT-EXCEPT-01
     * Verifies the audit-trail entry is written to exception_events.
     */
    mockQuery
      .mockResolvedValueOnce([{ insertId: 1 }, []])
      .mockResolvedValueOnce([{ insertId: 2 }, []])
      .mockResolvedValueOnce([{ insertId: 3 }, []]);

    await request(app)
      .post("/api/safety/maintenance")
      .set("Authorization", AUTH_HEADER)
      .send({ vehicle_id: "truck-03", type: "Tire Rotation" });

    const [eventSql] = mockQuery.mock.calls[2] as [string, unknown[]];
    expect(eventSql).toMatch(/INSERT\s+INTO\s+exception_events/i);
  });
});

// ── R-MAINT-EXCEPT-02 — links JSON contains maintenanceRecordId ──────────────

describe("POST /api/safety/maintenance — links JSON — R-MAINT-EXCEPT-02", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    app = buildApp();
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
  });

  it("exceptions INSERT links column contains maintenanceRecordId matching the created record id", async () => {
    /**
     * Tests R-MAINT-EXCEPT-02
     * The `links` parameter (last column in the exceptions INSERT) must be a
     * JSON string whose `maintenanceRecordId` key holds the UUID that was
     * assigned to the newly created safety_maintenance row.
     *
     * This is the canonical proof that "maintenance is owned by the exception queue".
     */
    mockQuery
      .mockResolvedValueOnce([{ insertId: 1 }, []])
      .mockResolvedValueOnce([{ insertId: 2 }, []])
      .mockResolvedValueOnce([{ insertId: 3 }, []]);

    const res = await request(app)
      .post("/api/safety/maintenance")
      .set("Authorization", AUTH_HEADER)
      .send({
        vehicle_id: "truck-04",
        type: "Engine Diagnostic",
        description: "Check engine light investigation",
      });

    expect(res.status).toBe(201);

    // The maintenance record UUID is returned in the response body
    const { id: maintenanceRecordId } = res.body as { id: string };
    expect(typeof maintenanceRecordId).toBe("string");
    expect(maintenanceRecordId.length).toBeGreaterThan(0);

    // Inspect the exceptions INSERT call (call index 1)
    const [, exceptionParams] = mockQuery.mock.calls[1] as [string, unknown[]];
    const paramList = exceptionParams as unknown[];

    // The exceptions INSERT params array has 6 elements (literal SQL values are
    // embedded directly in the query string, not passed as params):
    //   [0] exceptionId
    //   [1] companyId  (tenant_id)
    //   [2] vehicle_id  (entity_id)
    //   [3] slaDueAt
    //   [4] description
    //   [5] JSON.stringify({ maintenanceRecordId })  ← links
    const linksJson = paramList[5] as string;
    expect(typeof linksJson).toBe("string");

    const links = JSON.parse(linksJson) as Record<string, string>;
    expect(links.maintenanceRecordId).toBe(maintenanceRecordId);
  });

  it("exceptions INSERT links JSON uses the exact id generated by the route, not a placeholder", async () => {
    /**
     * Tests R-MAINT-EXCEPT-02
     * Makes two separate requests and verifies that each produces a distinct
     * maintenanceRecordId in the links column — ruling out any hardcoded UUID.
     */
    mockQuery
      .mockResolvedValueOnce([{ insertId: 1 }, []])
      .mockResolvedValueOnce([{ insertId: 2 }, []])
      .mockResolvedValueOnce([{ insertId: 3 }, []]);

    const resA = await request(app)
      .post("/api/safety/maintenance")
      .set("Authorization", AUTH_HEADER)
      .send({ vehicle_id: "truck-05", type: "Transmission Service" });

    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
    mockQuery
      .mockResolvedValueOnce([{ insertId: 4 }, []])
      .mockResolvedValueOnce([{ insertId: 5 }, []])
      .mockResolvedValueOnce([{ insertId: 6 }, []]);

    const resB = await request(app)
      .post("/api/safety/maintenance")
      .set("Authorization", AUTH_HEADER)
      .send({ vehicle_id: "truck-06", type: "Coolant Flush" });

    const idA = (resA.body as { id: string }).id;
    const idB = (resB.body as { id: string }).id;

    // Two distinct maintenance records must have two distinct UUIDs
    expect(idA).not.toBe(idB);

    // Verify links for the second call — links is at index 5 (see param layout above)
    const [, exceptionParamsB] = mockQuery.mock.calls[1] as [string, unknown[]];
    const linksJsonB = (exceptionParamsB as unknown[])[5] as string;
    const linksB = JSON.parse(linksJsonB) as Record<string, string>;
    expect(linksB.maintenanceRecordId).toBe(idB);
  });
});

// ── R-MAINT-EXCEPT-03 — exception INSERT carries correct field values ─────────

describe("POST /api/safety/maintenance — exception field values — R-MAINT-EXCEPT-03", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    app = buildApp();
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
  });

  it("exception INSERT uses type MAINTENANCE_REQUEST and status OPEN", async () => {
    /**
     * Tests R-MAINT-EXCEPT-03
     * Verifies the exception classification: MAINTENANCE_REQUEST / OPEN.
     * These values are required for the exception queue to triage correctly.
     */
    mockQuery
      .mockResolvedValueOnce([{ insertId: 1 }, []])
      .mockResolvedValueOnce([{ insertId: 2 }, []])
      .mockResolvedValueOnce([{ insertId: 3 }, []]);

    await request(app)
      .post("/api/safety/maintenance")
      .set("Authorization", AUTH_HEADER)
      .send({ vehicle_id: "truck-07", type: "Wheel Alignment" });

    const [exceptionSql, exceptionParams] = mockQuery.mock.calls[1] as [
      string,
      unknown[],
    ];

    // SQL must embed the literal strings MAINTENANCE_REQUEST and OPEN
    expect(exceptionSql).toContain("MAINTENANCE_REQUEST");
    expect(exceptionSql).toContain("OPEN");

    // tenant_id (index 1) must equal the authenticated tenant
    const paramList = exceptionParams as unknown[];
    expect(paramList[1]).toBe(TENANT_A);
  });

  it("exception INSERT entity_id matches vehicle_id from the request", async () => {
    /**
     * Tests R-MAINT-EXCEPT-03
     * The exception references the vehicle (entity_type = TRUCK, entity_id = vehicle_id),
     * allowing the exception console to link back to the truck record.
     */
    mockQuery
      .mockResolvedValueOnce([{ insertId: 1 }, []])
      .mockResolvedValueOnce([{ insertId: 2 }, []])
      .mockResolvedValueOnce([{ insertId: 3 }, []]);

    const vehicleId = "truck-42";

    await request(app)
      .post("/api/safety/maintenance")
      .set("Authorization", AUTH_HEADER)
      .send({ vehicle_id: vehicleId, type: "Air Filter Replacement" });

    const [, exceptionParams] = mockQuery.mock.calls[1] as [string, unknown[]];
    const paramList = exceptionParams as unknown[];

    // entity_id is index 2 in the exceptions INSERT params:
    //   (id[0], tenant_id[1], entity_id[2], sla_due_at[3],
    //    description[4], links[5]) — per the VALUES placeholder order in safety.ts
    expect(paramList[2]).toBe(vehicleId);
  });

  it("exception INSERT description falls back to 'Maintenance: <type>' when no description provided", async () => {
    /**
     * Tests R-MAINT-EXCEPT-03
     * When no `description` is sent, the route synthesises a description
     * as "Maintenance: <type>" so the exception console shows readable text.
     */
    mockQuery
      .mockResolvedValueOnce([{ insertId: 1 }, []])
      .mockResolvedValueOnce([{ insertId: 2 }, []])
      .mockResolvedValueOnce([{ insertId: 3 }, []]);

    await request(app)
      .post("/api/safety/maintenance")
      .set("Authorization", AUTH_HEADER)
      .send({ vehicle_id: "truck-08", type: "Fuel Filter" });

    const [, exceptionParams] = mockQuery.mock.calls[1] as [string, unknown[]];
    const paramList = exceptionParams as unknown[];

    // description is index 4 in the exceptions INSERT params
    expect(paramList[4]).toBe("Maintenance: Fuel Filter");
  });

  it("exception INSERT description uses provided description when present", async () => {
    /**
     * Tests R-MAINT-EXCEPT-03
     * When a description is supplied, it must flow through to the exception
     * rather than being replaced by the synthesised fallback.
     */
    mockQuery
      .mockResolvedValueOnce([{ insertId: 1 }, []])
      .mockResolvedValueOnce([{ insertId: 2 }, []])
      .mockResolvedValueOnce([{ insertId: 3 }, []]);

    const customDescription = "Driver reported grinding noise on braking";

    await request(app)
      .post("/api/safety/maintenance")
      .set("Authorization", AUTH_HEADER)
      .send({
        vehicle_id: "truck-09",
        type: "Brake Pad Replacement",
        description: customDescription,
      });

    const [, exceptionParams] = mockQuery.mock.calls[1] as [string, unknown[]];
    const paramList = exceptionParams as unknown[];

    // description is index 4
    expect(paramList[4]).toBe(customDescription);
  });

  it("exception INSERT failure is non-blocking — returns 201 even if exception INSERT throws", async () => {
    /**
     * Tests R-MAINT-EXCEPT-03
     * The exception cross-link is wrapped in its own try/catch. A failure
     * there must NOT roll back the maintenance record or return 500 to the
     * caller — the primary write always wins.
     */
    mockQuery
      .mockResolvedValueOnce([{ insertId: 1 }, []]) // safety_maintenance INSERT succeeds
      .mockRejectedValueOnce(new Error("exceptions table locked")); // exceptions INSERT fails

    const res = await request(app)
      .post("/api/safety/maintenance")
      .set("Authorization", AUTH_HEADER)
      .send({ vehicle_id: "truck-10", type: "Suspension Check" });

    // Primary write succeeded — client gets 201
    expect(res.status).toBe(201);
    const body = res.body as { message: string; id: string };
    expect(body.message).toBe("Maintenance record created");
    expect(typeof body.id).toBe("string");
  });
});
