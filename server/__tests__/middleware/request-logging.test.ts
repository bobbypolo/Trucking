import { describe, it, expect, beforeEach, vi } from "vitest";
import { Request, Response, NextFunction } from "express";
import { metricsMiddleware, resetMetrics } from "../../middleware/metrics";

// Tests R-P13-05, R-P13-06, R-P13-07, R-P13-08

const {
  mockLoggerInfo,
  mockLoggerError,
  mockLoggerWarn,
  mockLoggerDebug,
} = vi.hoisted(() => ({
  mockLoggerInfo: vi.fn(),
  mockLoggerError: vi.fn(),
  mockLoggerWarn: vi.fn(),
  mockLoggerDebug: vi.fn(),
}));

vi.mock("../../lib/logger", () => ({
  logger: {
    info: mockLoggerInfo,
    error: mockLoggerError,
    warn: mockLoggerWarn,
    debug: mockLoggerDebug,
    child() {
      return this;
    },
  },
  createChildLogger: () => ({
    info: mockLoggerInfo,
    error: mockLoggerError,
    warn: mockLoggerWarn,
    debug: mockLoggerDebug,
  }),
  createRequestLogger: () => ({
    info: mockLoggerInfo,
    error: mockLoggerError,
    warn: mockLoggerWarn,
    debug: mockLoggerDebug,
  }),
}));

/**
 * Helper: create a mock Express request/response pair and trigger
 * the metricsMiddleware finish handler. Returns the log call args.
 */
function simulateRequest(options: {
  method: string;
  path: string;
  statusCode: number;
  correlationId?: string;
  user?: { companyId?: string; uid?: string };
}): Promise<unknown[]> {
  return new Promise((resolve) => {
    const req = {
      method: options.method,
      path: options.path,
      correlationId: options.correlationId || "test-corr-id-001",
      headers: {},
    } as unknown as Request;

    if (options.user) {
      (req as any).user = options.user;
    }

    let finishCallback: (() => void) | null = null;
    const res = {
      on: (event: string, cb: () => void) => {
        if (event === "finish") finishCallback = cb;
      },
      statusCode: options.statusCode,
    } as unknown as Response;

    const next: NextFunction = () => {
      if (finishCallback) finishCallback();
      // Get the most recent logger.info call
      const calls = mockLoggerInfo.mock.calls;
      const lastCall = calls[calls.length - 1];
      resolve(lastCall || []);
    };

    metricsMiddleware(req, res, next);
  });
}

describe("S-13.2: Structured request logging with correlation IDs", () => {
  beforeEach(() => {
    resetMetrics();
    mockLoggerInfo.mockClear();
  });

  describe("R-P13-05: Every request produces structured log: {method, path, statusCode, duration_ms}", () => {
    it("emits structured log with method, path, statusCode, and duration_ms on GET 200", async () => {
      const logArgs = await simulateRequest({
        method: "GET",
        path: "/api/loads",
        statusCode: 200,
      });

      expect(logArgs.length).toBe(2);
      const logEntry = logArgs[0] as Record<string, unknown>;
      const message = logArgs[1] as string;

      expect(logEntry.method).toBe("GET");
      expect(logEntry.path).toBe("/api/loads");
      expect(logEntry.statusCode).toBe(200);
      expect(typeof logEntry.duration_ms).toBe("number");
      expect(logEntry.duration_ms).toBeGreaterThanOrEqual(0);
      expect(message).toBe("request completed");
    });

    it("emits structured log with correct status on POST 201", async () => {
      const logArgs = await simulateRequest({
        method: "POST",
        path: "/api/loads",
        statusCode: 201,
      });

      const logEntry = logArgs[0] as Record<string, unknown>;
      expect(logEntry.method).toBe("POST");
      expect(logEntry.path).toBe("/api/loads");
      expect(logEntry.statusCode).toBe(201);
      expect(typeof logEntry.duration_ms).toBe("number");
    });

    it("emits structured log on error responses (500)", async () => {
      const logArgs = await simulateRequest({
        method: "GET",
        path: "/api/health",
        statusCode: 500,
      });

      const logEntry = logArgs[0] as Record<string, unknown>;
      expect(logEntry.method).toBe("GET");
      expect(logEntry.statusCode).toBe(500);
      expect(typeof logEntry.duration_ms).toBe("number");
    });

    it("logs are emitted for every request (multiple calls produce multiple logs)", async () => {
      await simulateRequest({
        method: "GET",
        path: "/api/first",
        statusCode: 200,
      });
      await simulateRequest({
        method: "POST",
        path: "/api/second",
        statusCode: 201,
      });

      expect(mockLoggerInfo).toHaveBeenCalledTimes(2);

      const firstEntry = mockLoggerInfo.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      const secondEntry = mockLoggerInfo.mock.calls[1][0] as Record<
        string,
        unknown
      >;

      expect(firstEntry.path).toBe("/api/first");
      expect(secondEntry.path).toBe("/api/second");
    });
  });

  describe("R-P13-06: Correlation ID appears in every request log", () => {
    it("includes correlationId from req.correlationId in log entry", async () => {
      const logArgs = await simulateRequest({
        method: "GET",
        path: "/api/loads",
        statusCode: 200,
        correlationId: "corr-abc-123-def",
      });

      const logEntry = logArgs[0] as Record<string, unknown>;
      expect(logEntry.correlationId).toBe("corr-abc-123-def");
    });

    it("includes different correlationId values for different requests", async () => {
      await simulateRequest({
        method: "GET",
        path: "/api/a",
        statusCode: 200,
        correlationId: "id-alpha",
      });
      await simulateRequest({
        method: "GET",
        path: "/api/b",
        statusCode: 200,
        correlationId: "id-beta",
      });

      const firstEntry = mockLoggerInfo.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      const secondEntry = mockLoggerInfo.mock.calls[1][0] as Record<
        string,
        unknown
      >;

      expect(firstEntry.correlationId).toBe("id-alpha");
      expect(secondEntry.correlationId).toBe("id-beta");
    });
  });

  describe("R-P13-07: Authenticated requests include companyId in log", () => {
    it("includes companyId when req.user has companyId", async () => {
      const logArgs = await simulateRequest({
        method: "GET",
        path: "/api/loads",
        statusCode: 200,
        user: { companyId: "company-xyz-789", uid: "user-1" },
      });

      const logEntry = logArgs[0] as Record<string, unknown>;
      expect(logEntry.companyId).toBe("company-xyz-789");
    });

    it("omits companyId when request is unauthenticated (no user)", async () => {
      const logArgs = await simulateRequest({
        method: "GET",
        path: "/api/health",
        statusCode: 200,
      });

      const logEntry = logArgs[0] as Record<string, unknown>;
      expect(logEntry.companyId).toBeUndefined();
    });

    it("omits companyId when user exists but has no companyId", async () => {
      const logArgs = await simulateRequest({
        method: "GET",
        path: "/api/profile",
        statusCode: 200,
        user: { uid: "user-2" },
      });

      const logEntry = logArgs[0] as Record<string, unknown>;
      expect(logEntry.companyId).toBeUndefined();
    });
  });

  describe("R-P13-08: Code comment documents production export path", () => {
    it("metrics.ts contains production export path documentation comment", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const metricsPath = path.resolve(
        __dirname,
        "../../middleware/metrics.ts",
      );
      const content = fs.readFileSync(metricsPath, "utf-8");

      // Must contain the production export path documentation
      // Verify the production export documentation exists
      expect(content.includes("Prometheus")).toBe(true);
      const hasExportDoc = content.includes("prom-client");
      expect(hasExportDoc).toBe(true);
      expect(content).toContain("Prometheus");
      expect(content).toContain("prom-client");
    });
  });
});
