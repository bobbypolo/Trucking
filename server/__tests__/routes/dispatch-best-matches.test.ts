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
import dispatchRouter from "../../routes/dispatch";
import { errorHandler } from "../../middleware/errorHandler";
import { DEFAULT_SQL_PRINCIPAL } from "../helpers/mock-sql-auth";

mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(DEFAULT_SQL_PRINCIPAL);

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(dispatchRouter);
  app.use(errorHandler);
  return app;
}

const AUTH_HEADER = { Authorization: "Bearer valid-token" };

describe("POST /api/dispatch/best-matches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
  });

  it("returns 400 when loadId is missing", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/dispatch/best-matches")
      .set(AUTH_HEADER)
      .send({});
    expect(res.status).toBe(400);
    // Zod validation returns structured error via errorHandler
    expect(res.body.message).toBe("Validation failed");
  });

  it("returns 400 when load has no pickup coordinates", async () => {
    // tenant check — load belongs to user's company
    mockQuery.mockResolvedValueOnce([[{ company_id: "company-aaa" }]]);
    // load_legs query returns no rows
    mockQuery.mockResolvedValueOnce([[]]);

    const app = buildApp();
    const res = await request(app)
      .post("/api/dispatch/best-matches")
      .set(AUTH_HEADER)
      .send({ loadId: "load-1" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Load has no pickup coordinates");
  });

  it("returns matched drivers sorted by score descending", async () => {
    // 0. tenant check
    mockQuery.mockResolvedValueOnce([[{ company_id: "company-aaa" }]]);
    // 1. load_legs — pickup coords (Dallas, TX)
    mockQuery.mockResolvedValueOnce([
      [{ latitude: 32.7767, longitude: -96.797 }],
    ]);
    // 2. drivers query
    mockQuery.mockResolvedValueOnce([
      [
        {
          id: "drv-1",
          name: "Alice Smith",
          role: "driver",
          safety_score: 98,
          home_terminal_lat: 32.78,
          home_terminal_lng: -96.8,
        },
        {
          id: "drv-2",
          name: "Bob Jones",
          role: "owner_operator",
          safety_score: 80,
          home_terminal_lat: 35.0,
          home_terminal_lng: -97.0,
        },
      ],
    ]);
    // 3. Per-driver GPS queries (one per driver in the for loop)
    const recentGps = new Date(Date.now() - 2 * 3600000).toISOString();
    // drv-1: recent GPS position
    mockQuery.mockResolvedValueOnce([
      [{ latitude: 32.78, longitude: -96.8, recorded_at: recentGps }],
    ]);
    // drv-2: no GPS data (falls back to home terminal)
    mockQuery.mockResolvedValueOnce([[]]);

    const app = buildApp();
    const res = await request(app)
      .post("/api/dispatch/best-matches")
      .set(AUTH_HEADER)
      .send({ loadId: "load-1" });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(2);

    // Alice should score higher (closer + higher safety + recent GPS)
    expect(res.body[0].driverName).toBe("Alice Smith");
    expect(res.body[0].score).toBeGreaterThan(res.body[1].score);
    expect(res.body[0].distanceMiles).toBeLessThan(5);
    expect(res.body[0].safetyScore).toBe(98);
  });

  it("falls back to home terminal when no GPS data", async () => {
    // tenant check
    mockQuery.mockResolvedValueOnce([[{ company_id: "company-aaa" }]]);
    // load_legs
    mockQuery.mockResolvedValueOnce([
      [{ latitude: 33.749, longitude: -84.388 }],
    ]);
    // drivers — one driver with home terminal, no GPS
    mockQuery.mockResolvedValueOnce([
      [
        {
          id: "drv-3",
          name: "Charlie Brown",
          role: "driver",
          safety_score: 90,
          home_terminal_lat: 33.75,
          home_terminal_lng: -84.39,
        },
      ],
    ]);
    // Per-driver GPS query: drv-3 has no GPS data
    mockQuery.mockResolvedValueOnce([[]]);

    const app = buildApp();
    const res = await request(app)
      .post("/api/dispatch/best-matches")
      .set(AUTH_HEADER)
      .send({ loadId: "load-1" });

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].driverName).toBe("Charlie Brown");
    expect(res.body[0].distanceMiles).toBeLessThan(5);
  });

  it("excludes drivers with no location data at all", async () => {
    // tenant check
    mockQuery.mockResolvedValueOnce([[{ company_id: "company-aaa" }]]);
    // load_legs
    mockQuery.mockResolvedValueOnce([[{ latitude: 40.0, longitude: -74.0 }]]);
    // driver with null home terminal
    mockQuery.mockResolvedValueOnce([
      [
        {
          id: "drv-ghost",
          name: "Ghost Driver",
          role: "driver",
          safety_score: 85,
          home_terminal_lat: null,
          home_terminal_lng: null,
        },
      ],
    ]);
    // Per-driver GPS query: drv-ghost has no GPS data
    mockQuery.mockResolvedValueOnce([[]]);

    const app = buildApp();
    const res = await request(app)
      .post("/api/dispatch/best-matches")
      .set(AUTH_HEADER)
      .send({ loadId: "load-1" });

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  it("respects maxCandidates limit", async () => {
    // tenant check
    mockQuery.mockResolvedValueOnce([[{ company_id: "company-aaa" }]]);
    // load_legs
    mockQuery.mockResolvedValueOnce([[{ latitude: 32.0, longitude: -96.0 }]]);
    // 3 drivers
    mockQuery.mockResolvedValueOnce([
      [
        {
          id: "d1",
          name: "D1",
          role: "driver",
          safety_score: 90,
          home_terminal_lat: 32.0,
          home_terminal_lng: -96.0,
        },
        {
          id: "d2",
          name: "D2",
          role: "driver",
          safety_score: 85,
          home_terminal_lat: 33.0,
          home_terminal_lng: -97.0,
        },
        {
          id: "d3",
          name: "D3",
          role: "driver",
          safety_score: 80,
          home_terminal_lat: 34.0,
          home_terminal_lng: -98.0,
        },
      ],
    ]);
    // Per-driver GPS queries — no GPS for any driver (all fall back to home terminal)
    mockQuery.mockResolvedValueOnce([[]]); // d1
    mockQuery.mockResolvedValueOnce([[]]); // d2
    mockQuery.mockResolvedValueOnce([[]]); // d3

    const app = buildApp();
    const res = await request(app)
      .post("/api/dispatch/best-matches")
      .set(AUTH_HEADER)
      .send({ loadId: "load-1", maxCandidates: 2 });

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it("returns 401 when no auth token", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/dispatch/best-matches")
      .send({ loadId: "load-1" });
    expect(res.status).toBe(401);
  });

  it("gives safety bonus for score > 95", async () => {
    // tenant check
    mockQuery.mockResolvedValueOnce([[{ company_id: "company-aaa" }]]);
    // load_legs
    mockQuery.mockResolvedValueOnce([[{ latitude: 32.0, longitude: -96.0 }]]);
    // Two drivers at same location, different safety
    mockQuery.mockResolvedValueOnce([
      [
        {
          id: "safe",
          name: "Safe Driver",
          role: "driver",
          safety_score: 98,
          home_terminal_lat: 32.0,
          home_terminal_lng: -96.0,
        },
        {
          id: "avg",
          name: "Avg Driver",
          role: "driver",
          safety_score: 70,
          home_terminal_lat: 32.0,
          home_terminal_lng: -96.0,
        },
      ],
    ]);
    // Per-driver GPS queries — no GPS data for either driver
    mockQuery.mockResolvedValueOnce([[]]); // safe
    mockQuery.mockResolvedValueOnce([[]]); // avg

    const app = buildApp();
    const res = await request(app)
      .post("/api/dispatch/best-matches")
      .set(AUTH_HEADER)
      .send({ loadId: "load-1" });

    expect(res.status).toBe(200);
    const safeDriver = res.body.find(
      (d: { driverName: string }) => d.driverName === "Safe Driver",
    );
    const avgDriver = res.body.find(
      (d: { driverName: string }) => d.driverName === "Avg Driver",
    );
    // Safe driver gets +10 safety bonus, avg gets 0
    expect(safeDriver.score).toBeGreaterThan(avgDriver.score);
    expect(safeDriver.score - avgDriver.score).toBe(10);
  });
});

