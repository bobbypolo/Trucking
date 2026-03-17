import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// Tests R-S35-01: GET /api/health returns dependency status for DB, Firebase, Storage

/**
 * Health Route Unit Tests — STORY-035 (R-S35-01)
 *
 * Verifies:
 *   - GET /api/health returns 200 with status, uptime, and dependencies
 *   - DB dependency: connected when pool.query("SELECT 1") resolves
 *   - DB dependency: disconnected when pool.query("SELECT 1") rejects
 *   - Firebase dependency: available when admin.auth() is non-null
 *   - Firebase dependency: unavailable when admin.auth() throws
 *   - Endpoint is unauthenticated (no auth header required)
 *   - Response includes uptime as a number
 */

// --- Pool mock ---
const { mockPoolQuery } = vi.hoisted(() => {
  const mockPoolQuery = vi.fn();
  return { mockPoolQuery };
});

vi.mock("../../db", () => ({
  default: {
    query: mockPoolQuery,
  },
}));

// --- Firebase admin mock ---
const { mockAdminAuth } = vi.hoisted(() => {
  const mockAdminAuth = vi.fn();
  return { mockAdminAuth };
});

vi.mock("../../auth", () => ({
  default: {
    auth: mockAdminAuth,
  },
}));

vi.mock("../../lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import healthRouter from "../../routes/health";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(healthRouter);
  return app;
}

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with DB connected when pool.query resolves", async () => {
    mockPoolQuery.mockResolvedValueOnce([[{ "1": 1 }], []]);
    mockAdminAuth.mockReturnValueOnce({ app: {} });

    const res = await request(buildApp()).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.uptime).toBeTypeOf("number");
    expect(res.body.dependencies.db.status).toBe("connected");
    expect(res.body.dependencies.firebase.status).toBe("available");
  });

  it("returns 200 with DB disconnected when pool.query rejects", async () => {
    mockPoolQuery.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    mockAdminAuth.mockReturnValueOnce({ app: {} });

    const res = await request(buildApp()).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("degraded");
    expect(res.body.dependencies.db.status).toBe("disconnected");
    expect(res.body.dependencies.db.error).toContain("ECONNREFUSED");
  });

  it("returns 200 with Firebase unavailable when admin.auth() throws", async () => {
    mockPoolQuery.mockResolvedValueOnce([[{ "1": 1 }], []]);
    mockAdminAuth.mockImplementationOnce(() => {
      throw new Error("Firebase not initialized");
    });

    const res = await request(buildApp()).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.body.dependencies.firebase.status).toBe("unavailable");
    expect(res.body.dependencies.firebase.error).toContain("Firebase not initialized");
  });

  it("does not require authentication", async () => {
    mockPoolQuery.mockResolvedValueOnce([[{ "1": 1 }], []]);
    mockAdminAuth.mockReturnValueOnce({ app: {} });

    // No Authorization header — should still return 200
    const res = await request(buildApp()).get("/api/health");
    expect(res.status).toBe(200);
  });

  it("includes uptime as a positive number", async () => {
    mockPoolQuery.mockResolvedValueOnce([[{ "1": 1 }], []]);
    mockAdminAuth.mockReturnValueOnce({ app: {} });

    const res = await request(buildApp()).get("/api/health");

    expect(res.body.uptime).toBeGreaterThan(0);
  });

  it("overall status is degraded when DB is disconnected", async () => {
    mockPoolQuery.mockRejectedValueOnce(new Error("timeout"));
    mockAdminAuth.mockReturnValueOnce({ app: {} });

    const res = await request(buildApp()).get("/api/health");

    expect(res.body.status).toBe("degraded");
  });

  it("overall status is degraded when Firebase is unavailable", async () => {
    mockPoolQuery.mockResolvedValueOnce([[{ "1": 1 }], []]);
    mockAdminAuth.mockImplementationOnce(() => {
      throw new Error("app not initialized");
    });

    const res = await request(buildApp()).get("/api/health");

    expect(res.body.status).toBe("degraded");
  });

  it("overall status is ok when all dependencies are healthy", async () => {
    mockPoolQuery.mockResolvedValueOnce([[{ "1": 1 }], []]);
    mockAdminAuth.mockReturnValueOnce({ app: {} });

    const res = await request(buildApp()).get("/api/health");

    expect(res.body.status).toBe("ok");
  });
});
