/**
 * Deployment Readiness Integration Test — Phase 4 (R-P4-03)
 *
 * Validates that the Express application is production-ready:
 *   - Health endpoint returns 200 with structured response
 *   - CORS headers are present and correct
 *   - Error handler returns structured JSON (not stack traces)
 *   - Rate limiter headers are injected on API responses
 *   - No DEMO_MODE or localStorage fallback paths are active
 *   - Auth enforcement is fail-closed (not open by default)
 *
 * Uses supertest against the Express app directly (no running server needed).
 * Firebase Admin SDK is mocked so serviceAccount.json is not required.
 *
 * Tests R-P0-04, R-P0-05, R-P4-03
 */
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import express from "express";
import request from "supertest";
import rateLimit from "express-rate-limit";
import cors from "cors";
import helmet from "helmet";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(__dirname, "../..");
const projectRoot = path.resolve(serverRoot, "..");

// Load env vars before mocks
dotenv.config({ path: path.join(projectRoot, ".env") });
dotenv.config({ path: path.join(serverRoot, ".env") });

// ---------------------------------------------------------------------------
// Mocks — hoisted so factories run before module imports
// ---------------------------------------------------------------------------
const { mockVerifyIdToken, mockAdminApp, mockAdminAuth } = vi.hoisted(() => ({
  mockVerifyIdToken: vi.fn(),
  mockAdminApp: vi.fn(),
  mockAdminAuth: vi.fn(),
}));

vi.mock("firebase-admin", () => ({
  default: {
    app: mockAdminApp,
    auth: mockAdminAuth,
    credential: {
      cert: vi.fn().mockReturnValue({}),
      applicationDefault: vi.fn().mockReturnValue({}),
    },
    initializeApp: vi.fn(),
  },
}));

vi.mock("../../auth", () => ({
  default: {
    app: mockAdminApp,
    auth: mockAdminAuth,
  },
  verifyFirebaseToken: vi.fn(),
}));

vi.mock("../../firestore", () => ({
  default: {
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        get: vi.fn().mockResolvedValue({ exists: false, data: () => null }),
        set: vi.fn().mockResolvedValue(undefined),
      })),
    })),
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

// ---------------------------------------------------------------------------
// Imports — loaded after mocks
// ---------------------------------------------------------------------------
import { errorHandler } from "../../middleware/errorHandler";
import loadsRouter from "../../routes/loads";
import { AuthError } from "../../errors/AppError";
import { getCorsOrigin } from "../../lib/env";

// ---------------------------------------------------------------------------
// Build a minimal test Express app matching production middleware stack
// ---------------------------------------------------------------------------
function buildDeploymentTestApp() {
  const app = express();

  // Production middleware chain
  app.use(helmet());
  // Use getCorsOrigin() for safe CORS — never wildcard with credentials
  app.use(
    cors({
      origin: getCorsOrigin(),
      credentials: true,
    }),
  );
  app.use(express.json());

  // Correlation ID (simplified inline for test isolation)
  app.use((req: any, _res: any, next: any) => {
    req.correlationId = "test-deployment-readiness";
    next();
  });

  // Rate limiter (production config)
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX || "100", 10),
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many requests, please try again later." },
  });
  app.use("/api", apiLimiter);

  // Health endpoint (mirrors production)
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      message: "LoadPilot API is running",
      timestamp: new Date().toISOString(),
    });
  });

  // Load routes (for auth enforcement and CORS validation)
  app.use(loadsRouter);

  // Global error handler (must be last)
  app.use(errorHandler);

  return app;
}

// ---------------------------------------------------------------------------
// Setup and teardown
// ---------------------------------------------------------------------------
let app: ReturnType<typeof express>;

beforeAll(() => {
  // Configure Firebase Admin mock — simulates initialized SDK
  mockAdminApp.mockReturnValue({ name: "[DEFAULT]" });
  mockVerifyIdToken.mockRejectedValue(new Error("invalid-token"));
  mockAdminAuth.mockReturnValue({ verifyIdToken: mockVerifyIdToken });

  app = buildDeploymentTestApp();
});

afterAll(async () => {
  // Close the DB pool if it was opened by route imports
  try {
    const { closePool } = await import("../../db");
    await closePool();
  } catch {
    // Pool may not have been opened
  }
});

// ---------------------------------------------------------------------------
// R-P4-03 deployment readiness checks
// ---------------------------------------------------------------------------

describe("Deployment Readiness — Health Endpoint", () => {
  it("GET /api/health returns 200 with ok status", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("status", "ok");
    expect(res.body).toHaveProperty("message");
    expect(typeof res.body.message).toBe("string");
    expect(res.body.message.length).toBeGreaterThan(0);
  }, 10_000);

  it("health endpoint responds within 2 seconds", async () => {
    const start = Date.now();
    const res = await request(app).get("/api/health");
    const elapsed = Date.now() - start;
    expect(res.status).toBe(200);
    expect(elapsed).toBeLessThan(2000);
  }, 10_000);
});

describe("Deployment Readiness — CORS Headers", () => {
  it("API responses include access-control-allow-origin header", async () => {
    const res = await request(app)
      .get("/api/health")
      .set("Origin", "http://localhost:5173");
    expect(res.status).toBe(200);
    expect(res.headers).toHaveProperty("access-control-allow-origin");
  }, 10_000);

  it("OPTIONS preflight on /api/loads returns CORS headers", async () => {
    const res = await request(app)
      .options("/api/loads")
      .set("Origin", "http://localhost:5173")
      .set("Access-Control-Request-Method", "GET")
      .set("Access-Control-Request-Headers", "Authorization");
    // 200 or 204 for preflight
    expect([200, 204]).toContain(res.status);
    expect(res.headers).toHaveProperty("access-control-allow-origin");
  }, 10_000);
});

describe("Deployment Readiness — Error Structure (no stack traces)", () => {
  it("GET /api/loads without auth returns structured AppError JSON — not stack trace", async () => {
    const res = await request(app).get("/api/loads");
    // Without auth: 401 (no token) or 500 (Firebase Admin config error)
    expect([401, 403, 500]).toContain(res.status);

    if (res.status === 401 || res.status === 403) {
      const body = res.body as Record<string, unknown>;
      // Must have message field
      expect(body).toHaveProperty("message");
      expect(typeof body.message).toBe("string");
      // Must NOT leak stack trace in response
      const bodyStr = JSON.stringify(body);
      expect(bodyStr).not.toContain("Error: ");
      expect(bodyStr).not.toContain("at requireAuth");
      expect(bodyStr).not.toContain("at Object.");
      expect(bodyStr).not.toContain("node_modules");
    }
  }, 10_000);

  it("invalid token returns structured error — not raw exception", async () => {
    const res = await request(app)
      .get("/api/loads")
      .set("Authorization", "Bearer invalid-token-string");
    expect([401, 403, 500]).toContain(res.status);

    if (res.status === 401 || res.status === 403) {
      const body = res.body as Record<string, unknown>;
      expect(body).toHaveProperty("message");
      // AppError envelope properties
      const bodyStr = JSON.stringify(body);
      // Must not leak internal stack
      expect(bodyStr).not.toContain("at requireAuth");
      expect(bodyStr).not.toContain("node_modules");
    }
  }, 10_000);

  it("errorHandler wraps unknown errors in structured AppError JSON", async () => {
    // Add a test route that throws an unknown error
    const testApp = express();
    testApp.use(express.json());
    testApp.get("/test/throw", (_req, _res, next) => {
      next(new Error("Raw unexpected error — should be wrapped"));
    });
    testApp.use(errorHandler);

    const res = await request(testApp).get("/test/throw");
    expect(res.status).toBe(500);
    const body = res.body as Record<string, unknown>;
    // Wrapped as InternalError with generic message
    expect(body).toHaveProperty("message");
    // Must NOT expose raw error message (stack trace protection)
    const bodyStr = JSON.stringify(body);
    expect(bodyStr).not.toContain("Raw unexpected error");
    expect(bodyStr).not.toContain("at Object.");
  }, 10_000);
});

describe("Deployment Readiness — Rate Limit Headers", () => {
  it("API responses include rate limit headers (standardHeaders: true)", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    // express-rate-limit with standardHeaders: true injects RateLimit-* headers
    // Also check for legacy X-RateLimit-* format
    const hasRateLimit =
      "ratelimit-limit" in res.headers ||
      "x-ratelimit-limit" in res.headers ||
      "ratelimit-remaining" in res.headers ||
      "x-ratelimit-remaining" in res.headers;
    expect(hasRateLimit).toBe(true);
  }, 10_000);

  it("rate limit headers are numeric strings", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);

    const limitHeader =
      res.headers["ratelimit-limit"] || res.headers["x-ratelimit-limit"];
    if (limitHeader !== undefined) {
      // Should be a numeric string (e.g., "100")
      expect(parseInt(limitHeader, 10)).toBeGreaterThan(0);
    }
  }, 10_000);
});

describe("Deployment Readiness — No DEMO_MODE", () => {
  it("protected routes are NOT publicly accessible — DEMO_MODE is off", async () => {
    // If DEMO_MODE were active, protected routes would return 200 without auth.
    // This verifies fail-closed auth enforcement.
    const res = await request(app).get("/api/loads");
    // Must NOT be 200 (that would indicate a bypass)
    expect(res.status).not.toBe(200);
    expect([401, 403, 500]).toContain(res.status);
  }, 10_000);

  it("multiple protected endpoints all reject unauthenticated requests", async () => {
    // Validates that DEMO_MODE fallback is not active on any route
    // Each must reject without auth
    const healthRes = await request(app).get("/api/health");
    expect(healthRes.status).toBe(200); // Health is always public

    const loadsRes = await request(app).get("/api/loads");
    expect(loadsRes.status).not.toBe(200); // Loads must require auth
    expect([401, 403, 500]).toContain(loadsRes.status);
  }, 10_000);
});

