import { describe, it, expect, vi, beforeEach } from "vitest";
import express, { Request, Response, NextFunction } from "express";
import request from "supertest";

// Tests R-P5-03-AC1: /api/metrics endpoint is admin-only, returns request counts, error rates, latency by route

// Hoisted mocks
const { mockResolveSqlPrincipalByFirebaseUid } = vi.hoisted(() => ({
  mockResolveSqlPrincipalByFirebaseUid: vi.fn(),
}));

// Mock firebase-admin for requireAuth
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
                  role: "admin",
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

import metricsRouter from "../../routes/metrics";
import {
  metricsMiddleware,
  resetMetrics,
  getMetricsSnapshot,
} from "../../middleware/metrics";
import { DEFAULT_SQL_PRINCIPAL } from "../helpers/mock-sql-auth";

mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(DEFAULT_SQL_PRINCIPAL);

const AUTH_HEADER = "Bearer valid-firebase-token";

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(metricsMiddleware);

  // A sample route to generate metrics data
  app.get("/api/loads", (_req: Request, res: Response) => {
    res.json({ loads: [] });
  });

  app.post("/api/loads", (_req: Request, res: Response) => {
    res.status(201).json({ id: "new-load" });
  });

  // An error route for testing error counting
  app.get(
    "/api/error-route",
    (_req: Request, _res: Response, next: NextFunction) => {
      const err = new Error("Simulated error");
      (err as any).statusCode = 500;
      next(err);
    },
  );

  // Mount metrics router
  app.use(metricsRouter);

  // Error handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    res.status(err.statusCode || 500).json({ error: err.message });
  });

  return app;
}

describe("R-P5-03: SLO Measurement and Alert Configuration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMetrics();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(DEFAULT_SQL_PRINCIPAL);
  });

  describe("AC1: /api/metrics endpoint is admin-only", () => {
    it("returns 200 for admin users", async () => {
      mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue({
        ...DEFAULT_SQL_PRINCIPAL,
        role: "admin",
      });
      const app = createApp();

      const res = await request(app).get("/api/metrics").set("Authorization", AUTH_HEADER);
      expect(res.status).toBe(200);
    });

    it("returns 200 for ORG_OWNER_SUPER_ADMIN users", async () => {
      mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue({
        ...DEFAULT_SQL_PRINCIPAL,
        role: "ORG_OWNER_SUPER_ADMIN",
      });
      const app = createApp();

      const res = await request(app).get("/api/metrics").set("Authorization", AUTH_HEADER);
      expect(res.status).toBe(200);
    });

    it("returns 403 for non-admin users (driver)", async () => {
      mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue({
        ...DEFAULT_SQL_PRINCIPAL,
        role: "driver",
      });
      const app = createApp();

      const res = await request(app).get("/api/metrics").set("Authorization", AUTH_HEADER);
      expect(res.status).toBe(403);
    });

    it("returns 403 for non-admin users (dispatcher)", async () => {
      mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue({
        ...DEFAULT_SQL_PRINCIPAL,
        role: "dispatcher",
      });
      const app = createApp();

      const res = await request(app).get("/api/metrics").set("Authorization", AUTH_HEADER);
      expect(res.status).toBe(403);
    });

    it("returns 403 for non-admin users (owner_operator)", async () => {
      mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue({
        ...DEFAULT_SQL_PRINCIPAL,
        role: "owner_operator",
      });
      const app = createApp();

      const res = await request(app).get("/api/metrics").set("Authorization", AUTH_HEADER);
      expect(res.status).toBe(403);
    });
  });

  describe("AC1: Returns request counts, error rates, latency by route", () => {
    it("returns structured metrics with routes array", async () => {
      mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue({
        ...DEFAULT_SQL_PRINCIPAL,
        role: "admin",
      });
      const app = createApp();

      // Generate some traffic
      await request(app).get("/api/loads").set("Authorization", AUTH_HEADER);
      await request(app).get("/api/loads").set("Authorization", AUTH_HEADER);
      await request(app).post("/api/loads").set("Authorization", AUTH_HEADER).send({ name: "test" });

      const res = await request(app).get("/api/metrics").set("Authorization", AUTH_HEADER);
      expect(res.status).toBe(200);

      const body = res.body;
      expect(body).toHaveProperty("routes");
      expect(body).toHaveProperty("uptime_seconds");
      expect(body).toHaveProperty("collected_since");
      expect(body).toHaveProperty("slo_baselines");

      // Should have route entries
      expect(Array.isArray(body.routes)).toBe(true);
    });

    it("tracks request counts per route", async () => {
      mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue({
        ...DEFAULT_SQL_PRINCIPAL,
        role: "admin",
      });
      const app = createApp();

      // Generate traffic
      await request(app).get("/api/loads").set("Authorization", AUTH_HEADER);
      await request(app).get("/api/loads").set("Authorization", AUTH_HEADER);
      await request(app).get("/api/loads").set("Authorization", AUTH_HEADER);

      const res = await request(app).get("/api/metrics").set("Authorization", AUTH_HEADER);
      const getLoadsRoute = res.body.routes.find(
        (r: any) => r.method === "GET" && r.path === "/api/loads",
      );

      expect(getLoadsRoute).toBeDefined();
      expect(getLoadsRoute.request_count).toBe(3);
    });

    it("tracks error counts and error rate", async () => {
      mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue({
        ...DEFAULT_SQL_PRINCIPAL,
        role: "admin",
      });
      const app = createApp();

      // Generate error traffic
      await request(app).get("/api/error-route").set("Authorization", AUTH_HEADER);
      await request(app).get("/api/error-route").set("Authorization", AUTH_HEADER);

      const res = await request(app).get("/api/metrics").set("Authorization", AUTH_HEADER);
      const errorRoute = res.body.routes.find(
        (r: any) => r.method === "GET" && r.path === "/api/error-route",
      );

      expect(errorRoute).toBeDefined();
      expect(errorRoute.error_count).toBe(2);
      expect(errorRoute.error_rate).toBe(1.0); // 2/2 = 100%
    });

    it("computes latency percentiles (p50, p95, p99)", async () => {
      mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue({
        ...DEFAULT_SQL_PRINCIPAL,
        role: "admin",
      });
      const app = createApp();

      // Generate enough traffic for meaningful percentiles
      for (let i = 0; i < 10; i++) {
        await request(app).get("/api/loads").set("Authorization", AUTH_HEADER);
      }

      const res = await request(app).get("/api/metrics").set("Authorization", AUTH_HEADER);
      const getLoadsRoute = res.body.routes.find(
        (r: any) => r.method === "GET" && r.path === "/api/loads",
      );

      expect(getLoadsRoute).toBeDefined();
      expect(getLoadsRoute.latency_ms).toHaveProperty("p50");
      expect(getLoadsRoute.latency_ms).toHaveProperty("p95");
      expect(getLoadsRoute.latency_ms).toHaveProperty("p99");
      expect(typeof getLoadsRoute.latency_ms.p50).toBe("number");
      expect(typeof getLoadsRoute.latency_ms.p95).toBe("number");
      expect(typeof getLoadsRoute.latency_ms.p99).toBe("number");
      // Latencies should be non-negative
      expect(getLoadsRoute.latency_ms.p50).toBeGreaterThanOrEqual(0);
      expect(getLoadsRoute.latency_ms.p95).toBeGreaterThanOrEqual(0);
      expect(getLoadsRoute.latency_ms.p99).toBeGreaterThanOrEqual(0);
    });

    it("includes SLO baseline documentation in response", async () => {
      mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue({
        ...DEFAULT_SQL_PRINCIPAL,
        role: "admin",
      });
      const app = createApp();

      const res = await request(app).get("/api/metrics").set("Authorization", AUTH_HEADER);
      const slos = res.body.slo_baselines;

      expect(slos).toBeDefined();
      expect(slos).toHaveProperty("read_p99_ms");
      expect(slos).toHaveProperty("write_p99_ms");
      expect(slos).toHaveProperty("error_rate_threshold");
      expect(slos.read_p99_ms).toBe(500);
      expect(slos.write_p99_ms).toBe(1000);
      expect(slos.error_rate_threshold).toBe(0.01);
    });

    it("includes production note about restricting access", async () => {
      mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue({
        ...DEFAULT_SQL_PRINCIPAL,
        role: "admin",
      });
      const app = createApp();

      const res = await request(app).get("/api/metrics").set("Authorization", AUTH_HEADER);
      expect(res.body).toHaveProperty("production_note");
      expect(res.body.production_note).toContain("internal network");
    });
  });

  describe("AC1: Metrics middleware does not interfere with normal traffic", () => {
    it("passes requests through without modification", async () => {
      mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(DEFAULT_SQL_PRINCIPAL);
      const app = createApp();

      const res = await request(app).get("/api/loads").set("Authorization", AUTH_HEADER);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ loads: [] });
    });

    it("does not add headers or modify response body", async () => {
      mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(DEFAULT_SQL_PRINCIPAL);
      const app = createApp();

      const res = await request(app).post("/api/loads").set("Authorization", AUTH_HEADER).send({ name: "test" });
      expect(res.status).toBe(201);
      expect(res.body).toEqual({ id: "new-load" });
    });
  });

  describe("AC1: getMetricsSnapshot utility", () => {
    it("returns current snapshot without resetting", async () => {
      mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(DEFAULT_SQL_PRINCIPAL);
      const app = createApp();
      await request(app).get("/api/loads").set("Authorization", AUTH_HEADER);

      const snapshot = getMetricsSnapshot();
      expect(snapshot.routes.length).toBeGreaterThan(0);

      // Calling again should return same data (not reset)
      const snapshot2 = getMetricsSnapshot();
      expect(snapshot2.routes.length).toBe(snapshot.routes.length);
    });

    it("resetMetrics clears all data", async () => {
      mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(DEFAULT_SQL_PRINCIPAL);
      const app = createApp();
      await request(app).get("/api/loads").set("Authorization", AUTH_HEADER);

      resetMetrics();
      const snapshot = getMetricsSnapshot();
      expect(snapshot.routes).toHaveLength(0);
    });
  });
});
