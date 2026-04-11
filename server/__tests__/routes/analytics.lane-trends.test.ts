/**
 * Tests R-P11-01, R-P11-02: /api/analytics/lane-trends route
 *
 * Covers:
 *  - GET /api/analytics/lane-trends?months=6 -> 200 with array of
 *    { lane, month, avgRate, volume, trend } (R-P11-01)
 *  - Trend direction calculation:
 *      > 5% increase vs previous month -> "up"
 *      < -5% decrease vs previous month -> "down"
 *      within +/-5% -> "flat"  (R-P11-02)
 *  - Response shape + 400 on invalid months param (R-P11-01 guard)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoisted mocks for pool.query and sql-auth
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

vi.mock("../../lib/token-revocation", () => ({
  isTokenRevoked: vi.fn().mockResolvedValue(false),
}));

import express from "express";
import request from "supertest";
import analyticsRouter from "../../routes/analytics";
import { errorHandler } from "../../middleware/errorHandler";
import { DEFAULT_SQL_PRINCIPAL } from "../helpers/mock-sql-auth";

mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(DEFAULT_SQL_PRINCIPAL);

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(analyticsRouter);
  app.use(errorHandler);
  return app;
}

// Aggregated rows returned by the SQL aggregate: one row per lane per month
function row(
  lane: string,
  month: string,
  avg_rate: number,
  volume: number,
): Record<string, unknown> {
  return { lane, month, avg_rate, volume };
}

describe("GET /api/analytics/lane-trends", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
  });

  // Tests R-P11-01 — 200 with { lane, month, avgRate, volume, trend }
  it("returns 200 with array of { lane, month, avgRate, volume, trend }", async () => {
    // Two lanes, two months each. Last month > prev by > 5% for both.
    mockQuery.mockResolvedValueOnce([
      [
        row("IL -> TX", "2026-02", 2000, 5),
        row("IL -> TX", "2026-03", 2200, 6),
        row("CA -> NY", "2026-02", 3000, 3),
        row("CA -> NY", "2026-03", 3500, 4),
      ],
      [],
    ]);

    const app = buildApp();
    const res = await request(app)
      .get("/api/analytics/lane-trends?months=6")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    const first = res.body[0];
    expect(first).toHaveProperty("lane");
    expect(first).toHaveProperty("month");
    expect(first).toHaveProperty("avgRate");
    expect(first).toHaveProperty("volume");
    expect(first).toHaveProperty("trend");
    expect(["up", "down", "flat"]).toContain(first.trend);
  });

  // Tests R-P11-01 — select query filters by tenant and groups by lane / month
  it("select query filters by company_id and groups by lane / month", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);

    const app = buildApp();
    await request(app)
      .get("/api/analytics/lane-trends?months=6")
      .set("Authorization", "Bearer valid-token");

    expect(mockQuery).toHaveBeenCalledTimes(1);
    const [sql, params] = mockQuery.mock.calls[0];
    const sqlLower = String(sql).toLowerCase();
    expect(sqlLower).toContain("select");
    expect(sqlLower).toContain("from loads");
    expect(sqlLower).toContain("company_id");
    expect(sqlLower).toContain("group by");
    expect(params).toContain("company-aaa");
  });

  // Tests R-P11-01 — defaults to months=6 when omitted
  it("defaults to months=6 when query param omitted", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);

    const app = buildApp();
    const res = await request(app)
      .get("/api/analytics/lane-trends")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  // Tests R-P11-01 — invalid months param rejected
  it("rejects with 400 when months=abc", async () => {
    const app = buildApp();
    const res = await request(app)
      .get("/api/analytics/lane-trends?months=abc")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
    expect(mockQuery).not.toHaveBeenCalled();
  });

  // Tests R-P11-01 — months out of range rejected
  it("rejects with 400 when months=0", async () => {
    const app = buildApp();
    const res = await request(app)
      .get("/api/analytics/lane-trends?months=0")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(400);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  // Tests R-P11-01 — months too large rejected
  it("rejects with 400 when months=500", async () => {
    const app = buildApp();
    const res = await request(app)
      .get("/api/analytics/lane-trends?months=500")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(400);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  // Tests R-P11-01 — empty array when no loads
  it("returns 200 with empty array when no loads exist", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);

    const app = buildApp();
    const res = await request(app)
      .get("/api/analytics/lane-trends?months=6")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  // Tests R-P11-02 — trend "up" when current > prev by > 5%
  it('computes trend="up" when current month avgRate > prev by > 5%', async () => {
    mockQuery.mockResolvedValueOnce([
      [
        row("IL -> TX", "2026-02", 2000, 10),
        row("IL -> TX", "2026-03", 2200, 12), // +10% (> 5%)
      ],
      [],
    ]);

    const app = buildApp();
    const res = await request(app)
      .get("/api/analytics/lane-trends?months=6")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    // The latest-month row for this lane should carry trend = "up"
    const latest = res.body.find(
      (r: { lane: string; month: string }) =>
        r.lane === "IL -> TX" && r.month === "2026-03",
    );
    expect(latest).toBeDefined();
    expect(latest.trend).toBe("up");
    expect(latest.avgRate).toBe(2200);
  });

  // Tests R-P11-02 — trend "down" when current < prev by > 5%
  it('computes trend="down" when current month avgRate < prev by > 5%', async () => {
    mockQuery.mockResolvedValueOnce([
      [
        row("CA -> NY", "2026-02", 3000, 4),
        row("CA -> NY", "2026-03", 2700, 3), // -10% (< -5%)
      ],
      [],
    ]);

    const app = buildApp();
    const res = await request(app)
      .get("/api/analytics/lane-trends?months=6")
      .set("Authorization", "Bearer valid-token");

    const latest = res.body.find(
      (r: { lane: string; month: string }) =>
        r.lane === "CA -> NY" && r.month === "2026-03",
    );
    expect(latest).toBeDefined();
    expect(latest.trend).toBe("down");
    expect(latest.avgRate).toBe(2700);
  });

  // Tests R-P11-02 — trend "flat" when within +/- 5%
  it('computes trend="flat" when current within +/- 5% of prev', async () => {
    mockQuery.mockResolvedValueOnce([
      [
        row("TX -> GA", "2026-02", 2000, 5),
        row("TX -> GA", "2026-03", 2050, 6), // +2.5% (within 5%)
      ],
      [],
    ]);

    const app = buildApp();
    const res = await request(app)
      .get("/api/analytics/lane-trends?months=6")
      .set("Authorization", "Bearer valid-token");

    const latest = res.body.find(
      (r: { lane: string; month: string }) =>
        r.lane === "TX -> GA" && r.month === "2026-03",
    );
    expect(latest).toBeDefined();
    expect(latest.trend).toBe("flat");
  });

  // Tests R-P11-02 — boundary exactly at 5% treated as flat
  it('computes trend="flat" when current is exactly +5% over prev', async () => {
    mockQuery.mockResolvedValueOnce([
      [
        row("FL -> OH", "2026-02", 2000, 4),
        row("FL -> OH", "2026-03", 2100, 4), // +5.0% exactly
      ],
      [],
    ]);

    const app = buildApp();
    const res = await request(app)
      .get("/api/analytics/lane-trends?months=6")
      .set("Authorization", "Bearer valid-token");

    const latest = res.body.find(
      (r: { lane: string; month: string }) =>
        r.lane === "FL -> OH" && r.month === "2026-03",
    );
    expect(latest).toBeDefined();
    // At exactly 5% the criterion says "> 5%" is "up" — so 5% exact -> "flat"
    expect(latest.trend).toBe("flat");
  });

  // Tests R-P11-02 — single month has no prior so trend is "flat"
  it('returns trend="flat" for lane with only one month of history', async () => {
    mockQuery.mockResolvedValueOnce([
      [row("AZ -> WA", "2026-03", 1800, 2)],
      [],
    ]);

    const app = buildApp();
    const res = await request(app)
      .get("/api/analytics/lane-trends?months=6")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].trend).toBe("flat");
    expect(res.body[0].lane).toBe("AZ -> WA");
  });

  // Tests R-P11-01 — 500 bubbles through error handler when DB fails
  it("returns 500 when db query throws", async () => {
    mockQuery.mockRejectedValueOnce(new Error("db down"));

    const app = buildApp();
    const res = await request(app)
      .get("/api/analytics/lane-trends?months=6")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(500);
  });
});
