import { describe, it, expect, vi, beforeEach } from "vitest";

// Tests R-W7-03c, R-W7-VPC-802

const { mockQuery, mockResolveSqlPrincipalByFirebaseUid, mockCheckExpiring } =
  vi.hoisted(() => {
    const mockQuery = vi.fn();
    const mockResolveSqlPrincipalByFirebaseUid = vi.fn();
    const mockCheckExpiring = vi.fn();
    return {
      mockQuery,
      mockResolveSqlPrincipalByFirebaseUid,
      mockCheckExpiring,
    };
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

vi.mock("../../services/cert-expiry-checker", () => ({
  checkExpiring: mockCheckExpiring,
}));

import express from "express";
import request from "supertest";
import safetyRouter from "../../routes/safety";
import { errorHandler } from "../../middleware/errorHandler";
import { DEFAULT_SQL_PRINCIPAL } from "../helpers/mock-sql-auth";

mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(DEFAULT_SQL_PRINCIPAL);

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(safetyRouter);
  app.use(errorHandler);
  return app;
}

const AUTH_HEADER = "Bearer valid-token";

describe("GET /api/safety/expiring-certs — R-W7-03c", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
    app = buildApp();
  });

  it("returns 401 without auth header", async () => {
    const res = await request(app).get("/api/safety/expiring-certs");
    expect(res.status).toBe(401);
  });

  it("returns expiring certs array with 200", async () => {
    const expiringCerts = [
      {
        driverId: "driver-1",
        certType: "CDL",
        expiryDate: new Date("2026-04-01"),
        daysRemaining: 11,
      },
      {
        driverId: "driver-2",
        certType: "Medical_Card",
        expiryDate: new Date("2026-03-25"),
        daysRemaining: 4,
      },
    ];
    mockCheckExpiring.mockResolvedValueOnce(expiringCerts);

    const res = await request(app)
      .get("/api/safety/expiring-certs")
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toHaveProperty("driverId", "driver-1");
    expect(res.body[0]).toHaveProperty("certType", "CDL");
    expect(res.body[0]).toHaveProperty("daysRemaining", 11);
    expect(res.body[1]).toHaveProperty("driverId", "driver-2");
    expect(res.body[1]).toHaveProperty("certType", "Medical_Card");
  });

  it("accepts custom days query parameter", async () => {
    mockCheckExpiring.mockResolvedValueOnce([]);

    const res = await request(app)
      .get("/api/safety/expiring-certs?days=14")
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(mockCheckExpiring).toHaveBeenCalledWith("company-aaa", 14);
  });

  it("defaults to 30 days when no query param", async () => {
    mockCheckExpiring.mockResolvedValueOnce([]);

    const res = await request(app)
      .get("/api/safety/expiring-certs")
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(mockCheckExpiring).toHaveBeenCalledWith("company-aaa", 30);
  });

  it("returns 500 on service error", async () => {
    mockCheckExpiring.mockRejectedValueOnce(new Error("DB error"));

    const res = await request(app)
      .get("/api/safety/expiring-certs")
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty("message");
  });
});

