import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock weather service — the external API call is to a paid Azure service
const { mockGetWeatherForLocation, mockResolveSqlPrincipalByFirebaseUid } = vi.hoisted(() => ({
  mockGetWeatherForLocation: vi.fn(),
  mockResolveSqlPrincipalByFirebaseUid: vi.fn(),
}));

vi.mock("../../services/weather.service", () => ({
  getWeatherForLocation: mockGetWeatherForLocation,
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
  const mockAuth = { verifyIdToken: vi.fn().mockResolvedValue({ uid: "firebase-uid-1" }) };
  return { default: { app: vi.fn(), auth: () => mockAuth } };
});

vi.mock("../../lib/sql-auth", () => ({
  resolveSqlPrincipalByFirebaseUid: mockResolveSqlPrincipalByFirebaseUid,
}));

import express from "express";
import request from "supertest";
import weatherRouter from "../../routes/weather";
import { errorHandler } from "../../middleware/errorHandler";
import { DEFAULT_SQL_PRINCIPAL } from "../helpers/mock-sql-auth";

mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(DEFAULT_SQL_PRINCIPAL);

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(weatherRouter);
  app.use(errorHandler);
  return app;
}

// ── Auth enforcement ────────────────────────────────────────────────

describe("GET /api/weather — auth enforcement", () => {
  it("returns 401 without auth", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/weather?lat=40.7&lng=-74.0");
    expect(res.status).toBe(401);
  });
});

// ── Validation ──────────────────────────────────────────────────────

describe("GET /api/weather — validation", () => {
  let app: ReturnType<typeof buildApp>;
  beforeEach(() => { vi.clearAllMocks(); mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(DEFAULT_SQL_PRINCIPAL); app = buildApp(); });

  it("returns 400 when lat is missing", async () => {
    const res = await request(app).get("/api/weather?lng=-74.0").set("Authorization", "Bearer valid-token");
    expect(res.status).toBe(400);
    expect(res.body.error_code).toBe("VALIDATION_001");
    expect(res.body.error_class).toBe("VALIDATION");
    expect(res.body.retryable).toBe(false);
  });

  it("returns 400 when lng is missing", async () => {
    const res = await request(app).get("/api/weather?lat=40.7").set("Authorization", "Bearer valid-token");
    expect(res.status).toBe(400);
    expect(res.body.error_code).toBe("VALIDATION_001");
  });

  it("returns 400 when both lat and lng are missing", async () => {
    const res = await request(app).get("/api/weather").set("Authorization", "Bearer valid-token");
    expect(res.status).toBe(400);
    expect(res.body.error_code).toBe("VALIDATION_001");
  });

  it("returns 400 when lat is not a number", async () => {
    const res = await request(app).get("/api/weather?lat=abc&lng=-74.0").set("Authorization", "Bearer valid-token");
    expect(res.status).toBe(400);
    expect(res.body.error_code).toBe("VALIDATION_001");
  });

  it("returns 400 when lng is not a number", async () => {
    const res = await request(app).get("/api/weather?lat=40.7&lng=xyz").set("Authorization", "Bearer valid-token");
    expect(res.status).toBe(400);
    expect(res.body.error_code).toBe("VALIDATION_001");
  });

  it("returns 400 when lat is out of range (> 90)", async () => {
    const res = await request(app).get("/api/weather?lat=91&lng=-74.0").set("Authorization", "Bearer valid-token");
    expect(res.status).toBe(400);
    expect(res.body.error_code).toBe("VALIDATION_002");
    expect(res.body.error_class).toBe("VALIDATION");
    expect(res.body.retryable).toBe(false);
  });

  it("returns 400 when lat is out of range (< -90)", async () => {
    const res = await request(app).get("/api/weather?lat=-91&lng=-74.0").set("Authorization", "Bearer valid-token");
    expect(res.status).toBe(400);
    expect(res.body.error_code).toBe("VALIDATION_002");
  });

  it("returns 400 when lng is out of range (> 180)", async () => {
    const res = await request(app).get("/api/weather?lat=40.7&lng=181").set("Authorization", "Bearer valid-token");
    expect(res.status).toBe(400);
    expect(res.body.error_code).toBe("VALIDATION_002");
  });

  it("returns 400 when lng is out of range (< -180)", async () => {
    const res = await request(app).get("/api/weather?lat=40.7&lng=-181").set("Authorization", "Bearer valid-token");
    expect(res.status).toBe(400);
    expect(res.body.error_code).toBe("VALIDATION_002");
  });
});

// ── Success paths ───────────────────────────────────────────────────

describe("GET /api/weather — success", () => {
  let app: ReturnType<typeof buildApp>;
  beforeEach(() => { vi.clearAllMocks(); mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(DEFAULT_SQL_PRINCIPAL); app = buildApp(); });

  it("returns 200 with weather data when service returns available=true", async () => {
    mockGetWeatherForLocation.mockResolvedValueOnce({ available: true, data: { temperature: 72, description: "Partly Cloudy", windSpeed: 12, hasPrecipitation: false } });
    const res = await request(app).get("/api/weather?lat=40.7128&lng=-74.006").set("Authorization", "Bearer valid-token");
    expect(res.status).toBe(200);
    expect(res.body.available).toBe(true);
    expect(res.body.data.temperature).toBe(72);
    expect(res.body.data.description).toBe("Partly Cloudy");
    expect(res.body.data.windSpeed).toBe(12);
    expect(res.body.data.hasPrecipitation).toBe(false);
    expect(mockGetWeatherForLocation).toHaveBeenCalledWith(40.7128, -74.006);
  });

  it("returns 200 with degraded response when weather is disabled", async () => {
    mockGetWeatherForLocation.mockResolvedValueOnce({ available: false, reason: "disabled" });
    const res = await request(app).get("/api/weather?lat=40.7128&lng=-74.006").set("Authorization", "Bearer valid-token");
    expect(res.status).toBe(200);
    expect(res.body.available).toBe(false);
    expect(res.body.reason).toBe("disabled");
  });

  it("returns 200 with degraded response when API key is missing", async () => {
    mockGetWeatherForLocation.mockResolvedValueOnce({ available: false, reason: "no_api_key" });
    const res = await request(app).get("/api/weather?lat=40.7128&lng=-74.006").set("Authorization", "Bearer valid-token");
    expect(res.status).toBe(200);
    expect(res.body.available).toBe(false);
    expect(res.body.reason).toBe("no_api_key");
  });

  it("returns 200 with degraded response on timeout", async () => {
    mockGetWeatherForLocation.mockResolvedValueOnce({ available: false, reason: "timeout" });
    const res = await request(app).get("/api/weather?lat=40.7128&lng=-74.006").set("Authorization", "Bearer valid-token");
    expect(res.status).toBe(200);
    expect(res.body.available).toBe(false);
    expect(res.body.reason).toBe("timeout");
  });

  it("returns 200 with degraded response on API error", async () => {
    mockGetWeatherForLocation.mockResolvedValueOnce({ available: false, reason: "api_error" });
    const res = await request(app).get("/api/weather?lat=40.7128&lng=-74.006").set("Authorization", "Bearer valid-token");
    expect(res.status).toBe(200);
    expect(res.body.available).toBe(false);
    expect(res.body.reason).toBe("api_error");
  });

  it("returns 200 with degraded response when no data available", async () => {
    mockGetWeatherForLocation.mockResolvedValueOnce({ available: false, reason: "no_data" });
    const res = await request(app).get("/api/weather?lat=40.7128&lng=-74.006").set("Authorization", "Bearer valid-token");
    expect(res.status).toBe(200);
    expect(res.body.available).toBe(false);
    expect(res.body.reason).toBe("no_data");
  });

  it("accepts boundary lat/lng values (exact limits)", async () => {
    mockGetWeatherForLocation.mockResolvedValueOnce({ available: false, reason: "disabled" });
    const res = await request(app).get("/api/weather?lat=90&lng=180").set("Authorization", "Bearer valid-token");
    expect(res.status).toBe(200);
    expect(mockGetWeatherForLocation).toHaveBeenCalledWith(90, 180);
  });

  it("accepts negative boundary lat/lng values", async () => {
    mockGetWeatherForLocation.mockResolvedValueOnce({ available: false, reason: "disabled" });
    const res = await request(app).get("/api/weather?lat=-90&lng=-180").set("Authorization", "Bearer valid-token");
    expect(res.status).toBe(200);
    expect(mockGetWeatherForLocation).toHaveBeenCalledWith(-90, -180);
  });

  it("accepts zero lat/lng values", async () => {
    mockGetWeatherForLocation.mockResolvedValueOnce({ available: false, reason: "disabled" });
    const res = await request(app).get("/api/weather?lat=0&lng=0").set("Authorization", "Bearer valid-token");
    expect(res.status).toBe(200);
    expect(mockGetWeatherForLocation).toHaveBeenCalledWith(0, 0);
  });
});
