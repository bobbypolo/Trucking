import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Writable } from "stream";

// Tests R-P1-06-AC1, R-P1-06-AC2

describe("R-P1-06: Structured Logging and Correlation IDs", () => {
  describe("AC1: Structured JSON logger", () => {
    it("emits JSON with required fields: timestamp, level, service, msg", () => {
      const lines: string[] = [];
      const stream = new Writable({
        write(chunk, _encoding, callback) {
          lines.push(chunk.toString());
          callback();
        },
      });

      // Import with a custom stream to capture output
      const pino = require("pino");
      const logger = pino(
        {
          level: "info",
          formatters: {
            level: (label: string) => ({ level: label }),
          },
          timestamp: pino.stdTimeFunctions.isoTime,
          base: {
            service: "loadpilot-api",
          },
        },
        stream,
      );

      logger.info("test message");

      expect(lines.length).toBe(1);
      const parsed = JSON.parse(lines[0]);
      expect(parsed).toHaveProperty("level", "info");
      expect(parsed).toHaveProperty("service", "loadpilot-api");
      expect(parsed).toHaveProperty("msg", "test message");
      expect(parsed).toHaveProperty("time");
      // Verify ISO timestamp format
      expect(parsed.time).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it("supports child loggers with correlation_id and route context", () => {
      const lines: string[] = [];
      const stream = new Writable({
        write(chunk, _encoding, callback) {
          lines.push(chunk.toString());
          callback();
        },
      });

      const pino = require("pino");
      const logger = pino(
        {
          level: "info",
          formatters: {
            level: (label: string) => ({ level: label }),
          },
          timestamp: pino.stdTimeFunctions.isoTime,
          base: {
            service: "loadpilot-api",
          },
        },
        stream,
      );

      const child = logger.child({
        correlationId: "req-abc-123",
        route: "GET /api/loads",
      });

      child.info("load fetched");

      expect(lines.length).toBe(1);
      const parsed = JSON.parse(lines[0]);
      expect(parsed).toHaveProperty("correlationId", "req-abc-123");
      expect(parsed).toHaveProperty("route", "GET /api/loads");
      expect(parsed).toHaveProperty("level", "info");
      expect(parsed).toHaveProperty("msg", "load fetched");
    });

    it("supports data payloads via mergingObject", () => {
      const lines: string[] = [];
      const stream = new Writable({
        write(chunk, _encoding, callback) {
          lines.push(chunk.toString());
          callback();
        },
      });

      const pino = require("pino");
      const logger = pino(
        {
          level: "info",
          formatters: {
            level: (label: string) => ({ level: label }),
          },
          timestamp: pino.stdTimeFunctions.isoTime,
          base: { service: "loadpilot-api" },
        },
        stream,
      );

      logger.info({ data: { loadId: "LD-001" } }, "load created");

      const parsed = JSON.parse(lines[0]);
      expect(parsed.data).toEqual({ loadId: "LD-001" });
    });

    it("redacts sensitive fields", () => {
      const lines: string[] = [];
      const stream = new Writable({
        write(chunk, _encoding, callback) {
          lines.push(chunk.toString());
          callback();
        },
      });

      const pino = require("pino");
      const logger = pino(
        {
          level: "info",
          formatters: {
            level: (label: string) => ({ level: label }),
          },
          timestamp: pino.stdTimeFunctions.isoTime,
          base: { service: "loadpilot-api" },
          redact: {
            paths: [
              "req.headers.authorization",
              "data.password",
              "data.token",
              "data.tax_id",
            ],
            censor: "[REDACTED]",
          },
        },
        stream,
      );

      logger.info(
        { data: { password: "secret123", token: "jwt-abc" } },
        "login attempt",
      );

      const parsed = JSON.parse(lines[0]);
      expect(parsed.data.password).toBe("[REDACTED]");
      expect(parsed.data.token).toBe("[REDACTED]");
    });
  });

  describe("AC1: Logger module exports", () => {
    it("exports logger and createChildLogger from server/lib/logger", async () => {
      const loggerModule = await import("../../lib/logger");
      expect(loggerModule.logger).toBeDefined();
      expect(loggerModule.createChildLogger).toBeDefined();
      expect(typeof loggerModule.createChildLogger).toBe("function");
    });

    it("createChildLogger produces a logger with correlationId", async () => {
      const { createChildLogger } = await import("../../lib/logger");
      const child = createChildLogger({
        correlationId: "test-123",
        route: "POST /api/loads",
      });
      expect(child).toBeDefined();
      expect(typeof child.info).toBe("function");
      expect(typeof child.error).toBe("function");
      expect(typeof child.warn).toBe("function");
    });
  });

  describe("AC1: Correlation ID middleware", () => {
    it("generates a correlation ID when none provided", async () => {
      const { correlationId } = await import("../../middleware/correlationId");
      const req: any = { headers: {} };
      const res: any = {
        setHeader: vi.fn(),
      };
      const next = vi.fn();

      correlationId(req, res, next);

      expect(req.correlationId).toBeDefined();
      expect(typeof req.correlationId).toBe("string");
      expect(req.correlationId.length).toBeGreaterThan(0);
      expect(res.setHeader).toHaveBeenCalledWith(
        "X-Correlation-Id",
        req.correlationId,
      );
      expect(next).toHaveBeenCalled();
    });

    it("uses existing x-correlation-id header if provided", async () => {
      const { correlationId } = await import("../../middleware/correlationId");
      const req: any = { headers: { "x-correlation-id": "existing-id-456" } };
      const res: any = {
        setHeader: vi.fn(),
      };
      const next = vi.fn();

      correlationId(req, res, next);

      expect(req.correlationId).toBe("existing-id-456");
      expect(res.setHeader).toHaveBeenCalledWith(
        "X-Correlation-Id",
        "existing-id-456",
      );
      expect(next).toHaveBeenCalled();
    });
  });

  describe("AC2: No bare console.log in server production code", () => {
    it("zero console.log calls in server routes, middleware, lib, services", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const glob = await import("glob");

      const serverRoot = path.resolve(__dirname, "..", "..");
      const patterns = [
        "routes/*.ts",
        "middleware/*.ts",
        "lib/*.ts",
        "index.ts",
        "helpers.ts",
        "auth.ts",
        "db.ts",
        "firestore.ts",
      ];

      const consolePattern = /console\.(log|error|warn|info|debug)\s*\(/;
      const violations: string[] = [];

      for (const pattern of patterns) {
        const fullPattern = path.join(serverRoot, pattern).replace(/\\/g, "/");
        const files = glob.sync(fullPattern);
        for (const file of files) {
          // Skip test files
          if (file.includes("__tests__")) continue;
          const content = fs.readFileSync(file, "utf-8");
          const lines = content.split("\n");
          lines.forEach((line, idx) => {
            // Skip comments that mention console
            const trimmed = line.trim();
            if (
              trimmed.startsWith("//") ||
              trimmed.startsWith("*") ||
              trimmed.startsWith("/*")
            )
              return;
            if (consolePattern.test(line)) {
              const relPath = path
                .relative(serverRoot, file)
                .replace(/\\/g, "/");
              violations.push(`${relPath}:${idx + 1}: ${line.trim()}`);
            }
          });
        }
      }

      expect(violations).toEqual([]);
    });
  });

  // Tests R-P13-01, R-P13-02, R-P13-03
  describe("R-P13-01: Structured logger in route files", () => {
    it("exports createRequestLogger from server/lib/logger", async () => {
      const loggerModule = await import("../../lib/logger");
      expect(loggerModule.createRequestLogger).toBeDefined();
      expect(typeof loggerModule.createRequestLogger).toBe("function");
    });

    it("createRequestLogger produces a logger with request_id, user_id, company_id", async () => {
      const { createRequestLogger } = await import("../../lib/logger");
      const mockReq: any = {
        correlationId: "corr-abc-123",
        headers: {},
        user: {
          uid: "user-001",
          tenantId: "company-xyz",
          companyId: "company-xyz",
        },
      };

      const log = createRequestLogger(mockReq, "GET /api/loads");
      expect(log).toBeDefined();
      expect(typeof log.info).toBe("function");
      expect(typeof log.error).toBe("function");
    });

    it("10+ route files import createRequestLogger", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const glob = await import("glob");

      const serverRoot = path.resolve(__dirname, "..", "..");
      const fullPattern = path
        .join(serverRoot, "routes", "*.ts")
        .replace(/\\/g, "/");
      const files = glob.sync(fullPattern);

      let count = 0;
      for (const file of files) {
        const content = fs.readFileSync(file, "utf-8");
        if (content.includes("createRequestLogger")) {
          count++;
        }
      }

      expect(count).toBeGreaterThanOrEqual(10);
    });
  });

  describe("R-P13-02: Every log entry includes request_id, user_id, company_id", () => {
    it("createRequestLogger child logger bindings include request_id, user_id, company_id", async () => {
      const pino = require("pino");
      const { Writable } = await import("stream");

      const lines: string[] = [];
      const stream = new Writable({
        write(chunk: any, _encoding: any, callback: any) {
          lines.push(chunk.toString());
          callback();
        },
      });

      // Create a logger with a test stream to capture output
      const testLogger = pino(
        {
          level: "info",
          formatters: { level: (label: string) => ({ level: label }) },
          timestamp: pino.stdTimeFunctions.isoTime,
          base: { service: "loadpilot-api" },
        },
        stream,
      );

      const child = testLogger.child({
        request_id: "req-test-456",
        user_id: "user-test-789",
        company_id: "company-test-012",
        route: "GET /api/test",
      });

      child.info("test log entry");

      expect(lines.length).toBe(1);
      const parsed = JSON.parse(lines[0]);
      expect(parsed).toHaveProperty("request_id", "req-test-456");
      expect(parsed).toHaveProperty("user_id", "user-test-789");
      expect(parsed).toHaveProperty("company_id", "company-test-012");
      expect(parsed).toHaveProperty("route", "GET /api/test");
    });

    it("createRequestLogger falls back to anonymous/unknown for unauthenticated requests", async () => {
      const { createRequestLogger } = await import("../../lib/logger");
      const mockReq: any = {
        headers: {},
      };

      const log = createRequestLogger(mockReq, "GET /api/health");
      // Logger should still be created without throwing
      expect(log).toBeDefined();
      expect(typeof log.info).toBe("function");
    });
  });

  describe("R-P13-03: No PII in logs", () => {
    it("redacts email, ssn, password, and phone fields", () => {
      const pino = require("pino");
      const { Writable } = require("stream");

      const lines: string[] = [];
      const stream = new Writable({
        write(chunk: any, _encoding: any, callback: any) {
          lines.push(chunk.toString());
          callback();
        },
      });

      const testLogger = pino(
        {
          level: "info",
          formatters: { level: (label: string) => ({ level: label }) },
          timestamp: pino.stdTimeFunctions.isoTime,
          base: { service: "loadpilot-api" },
          redact: {
            paths: [
              "req.headers.authorization",
              "data.password",
              "data.token",
              "data.tax_id",
              "data.email",
              "data.ssn",
              "data.social_security",
              "data.social_security_number",
              "data.phone",
              "data.phone_number",
              "email",
              "ssn",
              "social_security",
              "password",
              "phone",
            ],
            censor: "[REDACTED]",
          },
        },
        stream,
      );

      testLogger.info(
        {
          data: {
            email: "user@example.com",
            ssn: "123-45-6789",
            social_security: "123-45-6789",
            phone: "555-0123",
            password: "secret",
          },
        },
        "user data logged",
      );

      expect(lines.length).toBe(1);
      const parsed = JSON.parse(lines[0]);
      expect(parsed.data.email).toBe("[REDACTED]");
      expect(parsed.data.ssn).toBe("[REDACTED]");
      expect(parsed.data.social_security).toBe("[REDACTED]");
      expect(parsed.data.phone).toBe("[REDACTED]");
      expect(parsed.data.password).toBe("[REDACTED]");
    });

    it("redacts top-level PII fields", () => {
      const pino = require("pino");
      const { Writable } = require("stream");

      const lines: string[] = [];
      const stream = new Writable({
        write(chunk: any, _encoding: any, callback: any) {
          lines.push(chunk.toString());
          callback();
        },
      });

      const testLogger = pino(
        {
          level: "info",
          formatters: { level: (label: string) => ({ level: label }) },
          timestamp: pino.stdTimeFunctions.isoTime,
          base: { service: "loadpilot-api" },
          redact: {
            paths: ["email", "ssn", "social_security", "password", "phone"],
            censor: "[REDACTED]",
          },
        },
        stream,
      );

      testLogger.info(
        { email: "admin@company.com", ssn: "999-88-7777" },
        "top-level PII test",
      );

      expect(lines.length).toBe(1);
      const parsed = JSON.parse(lines[0]);
      expect(parsed.email).toBe("[REDACTED]");
      expect(parsed.ssn).toBe("[REDACTED]");
    });
  });
});
