import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";

const INDEX_PATH = path.resolve(__dirname, "../index.ts");

/**
 * STORY-B1-04 — Sentry server-side init (gated on SENTRY_DSN)
 *
 * R-B1-08: Static analysis — source code contains import + conditional call
 * R-B1-09: Runtime — initSentry called when SENTRY_DSN is set
 * R-B1-10: Runtime — server loads without throwing when SENTRY_DSN is unset
 */

// Tests R-B1-08
describe("R-B1-08: static source analysis of server/index.ts", () => {
  const source = fs.readFileSync(INDEX_PATH, "utf-8");

  it("imports initSentry from ./lib/sentry", () => {
    const importPattern =
      /import\s+\{[^}]*initSentry[^}]*\}\s+from\s+["']\.\/lib\/sentry["']/;
    expect(importPattern.test(source)).toBe(true);
  });

  it("calls initSentry() conditionally on SENTRY_DSN", () => {
    const conditionalCallPattern =
      /if\s*\(\s*process\.env\.SENTRY_DSN\s*\)\s*\{?\s*initSentry\s*\(\s*\)/;
    expect(conditionalCallPattern.test(source)).toBe(true);
  });
});

// ---- Mocks for runtime integration tests (R-B1-09, R-B1-10) ----
// We mock all heavy dependencies so importing server/index.ts
// does not start a real HTTP server or load database connections.

// vi.hoisted runs before vi.mock factories, making counter available
const { sentryTracker } = vi.hoisted(() => ({
  sentryTracker: { callCount: 0 },
}));

vi.mock("../lib/sentry", () => ({
  initSentry: () => {
    sentryTracker.callCount++;
  },
}));

vi.mock("express", () => {
  const mockApp = {
    use: vi.fn().mockReturnThis(),
    get: vi.fn().mockReturnThis(),
    post: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    listen: vi.fn((_port: unknown, cb?: () => void) => {
      if (cb) cb();
      return { close: vi.fn(), address: vi.fn(() => ({ port: 5000 })) };
    }),
  };
  const expressFn = Object.assign(
    vi.fn(() => mockApp),
    {
      json: vi.fn(() => vi.fn()),
      urlencoded: vi.fn(() => vi.fn()),
      Router: vi.fn(() => ({
        get: vi.fn().mockReturnThis(),
        post: vi.fn().mockReturnThis(),
        put: vi.fn().mockReturnThis(),
        patch: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        use: vi.fn().mockReturnThis(),
      })),
      static: vi.fn(() => vi.fn()),
    },
  );
  return { default: expressFn };
});

vi.mock("cors", () => ({ default: vi.fn(() => vi.fn()) }));
vi.mock("helmet", () => ({ default: vi.fn(() => vi.fn()) }));
vi.mock("express-rate-limit", () => ({ default: vi.fn(() => vi.fn()) }));
vi.mock("compression", () => ({ default: vi.fn(() => vi.fn()) }));
vi.mock("dotenv", () => ({ default: { config: vi.fn() } }));
vi.mock("../lib/env", () => ({
  validateEnv: vi.fn(),
  getCorsOrigin: vi.fn(() => "*"),
}));
vi.mock("../middleware/errorHandler", () => ({ errorHandler: vi.fn() }));
vi.mock("../middleware/correlationId", () => ({ correlationId: vi.fn() }));
vi.mock("../middleware/metrics", () => ({ metricsMiddleware: vi.fn() }));
vi.mock("../lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("../lib/graceful-shutdown", () => ({
  registerShutdownHandlers: vi.fn(),
}));

// Mock all route modules individually (vi.mock is hoisted — no variable refs)
vi.mock("../routes/users", () => ({ default: vi.fn() }));
vi.mock("../routes/loads", () => ({ default: vi.fn() }));
vi.mock("../routes/equipment", () => ({ default: vi.fn() }));
vi.mock("../routes/clients", () => ({ default: vi.fn() }));
vi.mock("../routes/contracts", () => ({ default: vi.fn() }));
vi.mock("../routes/dispatch", () => ({ default: vi.fn() }));
vi.mock("../routes/compliance", () => ({ default: vi.fn() }));
vi.mock("../routes/incidents", () => ({ default: vi.fn() }));
vi.mock("../routes/accounting", () => ({ default: vi.fn() }));
vi.mock("../routes/exceptions", () => ({ default: vi.fn() }));
vi.mock("../routes/tracking", () => ({ default: vi.fn() }));
vi.mock("../routes/weather", () => ({ default: vi.fn() }));
vi.mock("../routes/metrics", () => ({ default: vi.fn() }));
vi.mock("../routes/ai", () => ({ default: vi.fn() }));
vi.mock("../routes/messages", () => ({ default: vi.fn() }));
vi.mock("../routes/call-sessions", () => ({ default: vi.fn() }));
vi.mock("../routes/quotes", () => ({ default: vi.fn() }));
vi.mock("../routes/leads", () => ({ default: vi.fn() }));
vi.mock("../routes/bookings", () => ({ default: vi.fn() }));
vi.mock("../routes/contacts", () => ({ default: vi.fn() }));
vi.mock("../routes/providers", () => ({ default: vi.fn() }));
vi.mock("../routes/tasks", () => ({ default: vi.fn() }));
vi.mock("../routes/kci-requests", () => ({ default: vi.fn() }));
vi.mock("../routes/crisis-actions", () => ({ default: vi.fn() }));
vi.mock("../routes/service-tickets", () => ({ default: vi.fn() }));
vi.mock("../routes/safety", () => ({ default: vi.fn() }));
vi.mock("../routes/notification-jobs", () => ({ default: vi.fn() }));
vi.mock("../routes/documents", () => ({ default: vi.fn() }));
vi.mock("../routes/health", () => ({ default: vi.fn() }));
vi.mock("../routes/quickbooks", () => ({ default: vi.fn() }));
vi.mock("../routes/call-logs", () => ({ default: vi.fn() }));
vi.mock("../routes/geofence", () => ({ default: vi.fn() }));
vi.mock("../routes/stripe", () => ({ default: vi.fn() }));
vi.mock("../routes/invitations", () => ({ default: vi.fn() }));
vi.mock("../routes/intelligence", () => ({ default: vi.fn() }));
vi.mock("../routes/loads-driver-intake", () => ({ default: vi.fn() }));
vi.mock("../routes/ifta-audit-packets", () => ({ default: vi.fn() }));
vi.mock("../routes/demo", () => ({ default: vi.fn() }));

// Tests R-B1-09
describe("R-B1-09: initSentry called when SENTRY_DSN is set", () => {
  let originalDsn: string | undefined;

  beforeEach(() => {
    originalDsn = process.env.SENTRY_DSN;
    sentryTracker.callCount = 0;
    vi.resetModules();
  });

  afterEach(() => {
    if (originalDsn === undefined) {
      delete process.env.SENTRY_DSN;
    } else {
      process.env.SENTRY_DSN = originalDsn;
    }
  });

  it("calls initSentry exactly once when SENTRY_DSN is configured", async () => {
    process.env.SENTRY_DSN = "test-dsn";
    await import("../index");
    expect(sentryTracker.callCount).toBe(1);
  });
});

// Tests R-B1-10
describe("R-B1-10: server loads without throwing when SENTRY_DSN unset", () => {
  let originalDsn: string | undefined;

  beforeEach(() => {
    originalDsn = process.env.SENTRY_DSN;
    sentryTracker.callCount = 0;
    vi.resetModules();
  });

  afterEach(() => {
    if (originalDsn === undefined) {
      delete process.env.SENTRY_DSN;
    } else {
      process.env.SENTRY_DSN = originalDsn;
    }
  });

  it("loads server/index without error when SENTRY_DSN is not set", async () => {
    delete process.env.SENTRY_DSN;
    const mod = await import("../index");
    expect(mod).toBeDefined();
    expect(sentryTracker.callCount).toBe(0);
  });
});
