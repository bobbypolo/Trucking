import { describe, it, expect, vi, beforeEach } from "vitest";

// Tests R-P7-03, R-P7-04
//
// Verifies that after a successful BOL scan at POST /api/loads/:id/bol-scan,
// deliverNotification is called with channel "email" and a subject containing
// "BOL". Also verifies fire-and-forget — a rejecting deliverNotification does
// not cause the route to return an error status.

// Hoisted mocks — must be declared before any imports that touch these modules
const {
  mockQuery,
  mockResolveSqlPrincipalByFirebaseUid,
  mockDeliverNotification,
  mockRecordBOLScan,
  mockRecordGeofenceEntry,
  mockCompareWeights,
  mockRecordLoadCompletion,
  mockExportLoadToBigQuery,
} = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockResolveSqlPrincipalByFirebaseUid: vi.fn(),
  mockDeliverNotification: vi.fn(),
  mockRecordBOLScan: vi.fn(),
  mockRecordGeofenceEntry: vi.fn(),
  mockCompareWeights: vi.fn(),
  mockRecordLoadCompletion: vi.fn(),
  mockExportLoadToBigQuery: vi.fn(),
}));

vi.mock("../../db", () => ({
  default: { query: mockQuery },
}));

vi.mock("../../services/notification-delivery.service", () => ({
  deliverNotification: mockDeliverNotification,
}));

vi.mock("../../services/detentionPipeline", () => ({
  recordBOLScan: mockRecordBOLScan,
  recordGeofenceEntry: mockRecordGeofenceEntry,
}));

vi.mock("../../services/discrepancyPipeline", () => ({
  compareWeights: mockCompareWeights,
  recordLoadCompletion: mockRecordLoadCompletion,
}));

vi.mock("../../services/bigqueryPipeline", () => ({
  exportLoadToBigQuery: mockExportLoadToBigQuery,
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
import loadsRouter from "../../routes/loads";
import { errorHandler } from "../../middleware/errorHandler";
import { DEFAULT_SQL_PRINCIPAL } from "../helpers/mock-sql-auth";

mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(DEFAULT_SQL_PRINCIPAL);

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(loadsRouter);
  app.use(errorHandler);
  return app;
}

function setupDefaultQueries(opts: { brokerEmail?: string | null } = {}) {
  const brokerEmail =
    opts.brokerEmail === undefined ? "broker@example.com" : opts.brokerEmail;
  mockQuery.mockImplementation(async (sql: string) => {
    const normalized = sql.replace(/\s+/g, " ").trim();
    if (normalized.startsWith("SELECT customer_id, quoted_weight")) {
      return [
        [
          {
            customer_id: "customer-1",
            quoted_weight: 40_000,
            quoted_commodity: "Steel Coils",
          },
        ],
        undefined,
      ];
    }
    if (normalized.includes("FROM loads") && normalized.includes("customers")) {
      return [[{ email: brokerEmail, load_number: "L-42" }], undefined];
    }
    return [[], undefined];
  });
}

describe("R-P7-03: POST /api/loads/:id/bol-scan sends BOL email notification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
    mockDeliverNotification.mockResolvedValue({ status: "SENT" });
    mockRecordBOLScan.mockResolvedValue({
      isBillable: false,
      totalAmount: 0,
      detentionRequest: null,
    });
    mockCompareWeights.mockResolvedValue({ flagged: false, discrepancyPct: 0 });
    setupDefaultQueries();
  });

  // Tests R-P7-03
  it("calls deliverNotification with channel 'email' and subject containing 'BOL' on successful scan", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/loads/load-1/bol-scan")
      .set("Authorization", "Bearer valid-token")
      .send({
        load_leg_id: "leg-1",
        load_number: "L-42",
        driver_lat: 40.0,
        driver_lng: -74.0,
        scanned_weight: 40_500,
        scanned_commodity: "Steel Coils",
        occurred_at: new Date().toISOString(),
      });

    expect(res.status).toBe(200);

    // Verify deliverNotification was called exactly once with the required shape
    expect(mockDeliverNotification).toHaveBeenCalledTimes(1);
    const callArg = mockDeliverNotification.mock.calls[0][0];
    expect(callArg.channel).toBe("email");
    expect(typeof callArg.subject).toBe("string");
    expect(callArg.subject).toContain("BOL");
  });

  // Tests R-P7-03
  it("returns 200 and the detention/discrepancy results when BOL scan succeeds", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/loads/load-1/bol-scan")
      .set("Authorization", "Bearer valid-token")
      .send({
        load_leg_id: "leg-1",
        load_number: "L-42",
      });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        detention: expect.objectContaining({ isBillable: false }),
        discrepancy: expect.objectContaining({ flagged: false }),
      }),
    );
  });
});

describe("R-P7-04: Fire-and-forget — BOL notification failure does not break route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
    mockRecordBOLScan.mockResolvedValue({
      isBillable: false,
      totalAmount: 0,
      detentionRequest: null,
    });
    mockCompareWeights.mockResolvedValue({ flagged: false, discrepancyPct: 0 });
    setupDefaultQueries();
  });

  // Tests R-P7-04
  it("still returns 200 when deliverNotification rejects (fire-and-forget)", async () => {
    mockDeliverNotification.mockRejectedValue(
      new Error("SMTP down — simulated failure"),
    );

    const app = buildApp();
    const res = await request(app)
      .post("/api/loads/load-1/bol-scan")
      .set("Authorization", "Bearer valid-token")
      .send({
        load_leg_id: "leg-1",
        load_number: "L-42",
      });

    // Pipeline still returns success — the notification failure is swallowed
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        detention: expect.anything(),
        discrepancy: expect.anything(),
      }),
    );
    expect(mockDeliverNotification).toHaveBeenCalledTimes(1);
  });

  // Tests R-P7-04
  it("still returns 200 when broker email is missing (no recipients, no deliverNotification call)", async () => {
    setupDefaultQueries({ brokerEmail: null });

    const app = buildApp();
    const res = await request(app)
      .post("/api/loads/load-1/bol-scan")
      .set("Authorization", "Bearer valid-token")
      .send({
        load_leg_id: "leg-1",
        load_number: "L-42",
      });

    expect(res.status).toBe(200);
    // With no broker email, deliverNotification is not called
    expect(mockDeliverNotification).not.toHaveBeenCalled();
  });
});

describe("POST /api/loads/:id/bol-scan — preconditions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
  });

  it("returns 400 when load_leg_id is missing", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/loads/load-1/bol-scan")
      .set("Authorization", "Bearer valid-token")
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toEqual(
      expect.objectContaining({
        error: expect.stringContaining("load_leg_id"),
      }),
    );
  });

  it("returns 404 when load is not found", async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      const normalized = sql.replace(/\s+/g, " ").trim();
      if (normalized.startsWith("SELECT customer_id, quoted_weight")) {
        return [[], undefined];
      }
      return [[], undefined];
    });

    const app = buildApp();
    const res = await request(app)
      .post("/api/loads/load-missing/bol-scan")
      .set("Authorization", "Bearer valid-token")
      .send({ load_leg_id: "leg-1" });

    expect(res.status).toBe(404);
  });
});
