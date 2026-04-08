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
    getConnection: vi.fn(),
  },
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
import accountingRouter from "../../routes/accounting";
import { errorHandler } from "../../middleware/errorHandler";
import { DEFAULT_SQL_PRINCIPAL } from "../helpers/mock-sql-auth";

mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(DEFAULT_SQL_PRINCIPAL);

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(accountingRouter);
  app.use(errorHandler);
  return app;
}

const AUTH_HEADER = { Authorization: "Bearer valid-token" };

describe("GET /api/accounting/ifta-summary — real tax rates from DB", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
  });

  it("returns CA rate 0.6810 from DB instead of 0.2 fallback", async () => {
    // 1. ifta_tax_rates query
    mockQuery.mockResolvedValueOnce([
      [{ state_code: "CA", rate_per_gallon: 0.681 }],
    ]);
    // 2. mileage_jurisdiction query
    mockQuery.mockResolvedValueOnce([
      [{ state_code: "CA", total_miles: 1000 }],
    ]);
    // 3. fuel_ledger query
    mockQuery.mockResolvedValueOnce([
      [{ state_code: "CA", total_gallons: 150, total_cost: 750 }],
    ]);

    const app = buildApp();
    const res = await request(app)
      .get("/api/accounting/ifta-summary?quarter=4&year=2025")
      .set(AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.rows).toHaveLength(1);
    expect(res.body.rows[0].stateCode).toBe("CA");
    expect(res.body.rows[0].taxRate).toBe(0.681);
    expect(res.body.rows[0].taxRateSource).toBe("IRP");
  });

  it("returns PA rate 0.5760 from DB instead of 0.2 fallback", async () => {
    mockQuery.mockResolvedValueOnce([
      [{ state_code: "PA", rate_per_gallon: 0.576 }],
    ]);
    mockQuery.mockResolvedValueOnce([
      [{ state_code: "PA", total_miles: 500 }],
    ]);
    mockQuery.mockResolvedValueOnce([
      [{ state_code: "PA", total_gallons: 80, total_cost: 400 }],
    ]);

    const app = buildApp();
    const res = await request(app)
      .get("/api/accounting/ifta-summary?quarter=4&year=2025")
      .set(AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.rows[0].stateCode).toBe("PA");
    expect(res.body.rows[0].taxRate).toBe(0.576);
  });

  it("falls back to 0.20 for unknown state not in DB", async () => {
    // Rate query returns no rate for ZZ
    mockQuery.mockResolvedValueOnce([[]]);
    // Mileage includes a state not in DB
    mockQuery.mockResolvedValueOnce([
      [{ state_code: "ZZ", total_miles: 200 }],
    ]);
    mockQuery.mockResolvedValueOnce([
      [{ state_code: "ZZ", total_gallons: 30, total_cost: 100 }],
    ]);

    const app = buildApp();
    const res = await request(app)
      .get("/api/accounting/ifta-summary?quarter=4&year=2025")
      .set(AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.rows[0].stateCode).toBe("ZZ");
    expect(res.body.rows[0].taxRate).toBe(0.2);
  });

  it("calculates IFTA using fleet average MPG instead of hardcoded /6", async () => {
    // TX rate from DB
    mockQuery.mockResolvedValueOnce([
      [{ state_code: "TX", rate_per_gallon: 0.2 }],
    ]);
    // 1000 miles in TX
    mockQuery.mockResolvedValueOnce([
      [{ state_code: "TX", total_miles: 1000 }],
    ]);
    // 200 gallons purchased in TX
    mockQuery.mockResolvedValueOnce([
      [{ state_code: "TX", total_gallons: 200, total_cost: 800 }],
    ]);

    const app = buildApp();
    const res = await request(app)
      .get("/api/accounting/ifta-summary?quarter=4&year=2025")
      .set(AUTH_HEADER);

    expect(res.status).toBe(200);
    // Fleet avg MPG = 1000 / 200 = 5.0
    expect(res.body.fleetAvgMpg).toBe(5);
    // Taxable gallons = 1000 / 5 = 200
    expect(res.body.rows[0].taxableGallons).toBe(200);
    // Tax due = 200 * 0.2 = 40
    expect(res.body.rows[0].taxDue).toBe(40);
    // Tax paid at pump = 200 * 0.2 = 40
    expect(res.body.rows[0].taxPaidAtPump).toBe(40);
    // Net = 40 - 40 = 0
    expect(res.body.rows[0].netTax).toBe(0);
    expect(res.body.netTaxDue).toBe(0);
  });

  it("includes taxRate and taxRateSource in each row", async () => {
    mockQuery.mockResolvedValueOnce([
      [
        { state_code: "TX", rate_per_gallon: 0.2 },
        { state_code: "OK", rate_per_gallon: 0.19 },
      ],
    ]);
    mockQuery.mockResolvedValueOnce([
      [
        { state_code: "TX", total_miles: 500 },
        { state_code: "OK", total_miles: 300 },
      ],
    ]);
    mockQuery.mockResolvedValueOnce([
      [
        { state_code: "TX", total_gallons: 80, total_cost: 320 },
        { state_code: "OK", total_gallons: 50, total_cost: 200 },
      ],
    ]);

    const app = buildApp();
    const res = await request(app)
      .get("/api/accounting/ifta-summary?quarter=4&year=2025")
      .set(AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.rows).toHaveLength(2);
    for (const row of res.body.rows) {
      expect(row.taxRate).toBeDefined();
      expect(row.taxRate).toBeGreaterThan(0);
      expect(row.taxRateSource).toBe("IRP");
    }
  });

  it("returns 401 without auth", async () => {
    const app = buildApp();
    const res = await request(app).get(
      "/api/accounting/ifta-summary?quarter=4&year=2025",
    );
    expect(res.status).toBe(401);
  });
});

