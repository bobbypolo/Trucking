/**
 * Tests for server/lib/sentry.ts — Sentry APM server integration
 *
 * Covers:
 * - R-ERR-09: server/lib/sentry.ts exists and exports captureException
 * - R-ERR-13: When DSN is not set captureException is a no-op
 * - R-ERR-15: cd server && npx vitest run __tests__/lib/sentry.test.ts exits 0
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Use vi.hoisted so the mocks are available when vi.mock factory runs
const { mockInit, mockCaptureException, mockCaptureMessage } = vi.hoisted(
  () => ({
    mockInit: vi.fn(),
    mockCaptureException: vi.fn(),
    mockCaptureMessage: vi.fn(),
  }),
);

vi.mock("@sentry/node", () => ({
  init: mockInit,
  captureException: mockCaptureException,
  captureMessage: mockCaptureMessage,
}));

// Import module under test (uses the mocked @sentry/node)
import { initSentry, captureException, captureMessage } from "../../lib/sentry";

describe("server/lib/sentry", () => {
  const originalDsn = process.env.SENTRY_DSN;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.SENTRY_DSN;
  });

  afterEach(() => {
    if (originalDsn !== undefined) {
      process.env.SENTRY_DSN = originalDsn;
    } else {
      delete process.env.SENTRY_DSN;
    }
  });

  // Tests R-ERR-09
  it("exports captureException function", () => {
    expect(typeof captureException).toBe("function");
  });

  // Tests R-ERR-09
  it("exports captureMessage function", () => {
    expect(typeof captureMessage).toBe("function");
  });

  // Tests R-ERR-09
  it("exports initSentry function", () => {
    expect(typeof initSentry).toBe("function");
  });

  // Tests R-ERR-13
  it("captureException is a no-op when SENTRY_DSN is not set", () => {
    delete process.env.SENTRY_DSN;
    const testError = new Error("test no-op error");

    captureException(testError);

    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  // Tests R-ERR-13
  it("captureMessage is a no-op when SENTRY_DSN is not set", () => {
    delete process.env.SENTRY_DSN;

    captureMessage("test message", "warning");

    expect(mockCaptureMessage).not.toHaveBeenCalled();
  });

  // Tests R-ERR-13 (negative: handles non-Error inputs)
  it("captureException handles non-Error inputs without crashing when DSN unset", () => {
    delete process.env.SENTRY_DSN;

    captureException("string error");
    captureException(42);
    captureException(null);
    captureException(undefined);
    captureException({ custom: "object" });

    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  // Tests R-ERR-09 (verify context forwarding when DSN IS set)
  it("captureException forwards error and context to Sentry when DSN is set", () => {
    process.env.SENTRY_DSN = "https://examplePublicKey@o0.ingest.sentry.io/0";

    const testError = new Error("context test");
    captureException(testError, { route: "GET /api/test" });

    expect(mockCaptureException).toHaveBeenCalledWith(testError, {
      extra: { route: "GET /api/test" },
    });
  });

  // Tests R-ERR-09 (verify captureMessage forwards when DSN is set)
  it("captureMessage forwards message to Sentry when DSN is set", () => {
    process.env.SENTRY_DSN = "https://examplePublicKey@o0.ingest.sentry.io/0";

    captureMessage("test warning", "warning");

    expect(mockCaptureMessage).toHaveBeenCalledWith("test warning", "warning");
  });

  // Tests R-ERR-13 (verify initSentry does not crash when DSN absent)
  it("initSentry is safe to call when DSN is not set", () => {
    delete process.env.SENTRY_DSN;

    initSentry();

    expect(mockInit).not.toHaveBeenCalled();
  });
});
