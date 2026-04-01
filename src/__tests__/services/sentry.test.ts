/**
 * Tests for services/sentry.ts — Sentry APM frontend integration
 *
 * Covers:
 * - R-ERR-08: services/sentry.ts exists and exports captureException
 * - R-ERR-13: When DSN is not set captureException is a no-op
 * - R-ERR-14: npx vitest run src/__tests__/services/sentry.test.ts exits 0
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Use vi.hoisted so the mocks are available when vi.mock factory runs
const { mockInit, mockCaptureException, mockCaptureMessage } = vi.hoisted(
  () => ({
    mockInit: vi.fn(),
    mockCaptureException: vi.fn(),
    mockCaptureMessage: vi.fn(),
  }),
);

vi.mock("@sentry/react", () => ({
  init: mockInit,
  captureException: mockCaptureException,
  captureMessage: mockCaptureMessage,
}));

// Import module under test (uses the mocked @sentry/react)
import {
  initSentry,
  captureException,
  captureMessage,
} from "../../../services/sentry";

describe("services/sentry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no DSN set
    vi.stubEnv("VITE_SENTRY_DSN", "");
  });

  // Tests R-ERR-08
  it("exports captureException function", () => {
    expect(typeof captureException).toBe("function");
  });

  // Tests R-ERR-08
  it("exports captureMessage function", () => {
    expect(typeof captureMessage).toBe("function");
  });

  // Tests R-ERR-08
  it("exports initSentry function", () => {
    expect(typeof initSentry).toBe("function");
  });

  // Tests R-ERR-13
  it("captureException is a no-op when DSN is not set", () => {
    vi.stubEnv("VITE_SENTRY_DSN", "");
    const testError = new Error("test no-op error");

    captureException(testError);

    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  // Tests R-ERR-13
  it("captureMessage is a no-op when DSN is not set", () => {
    vi.stubEnv("VITE_SENTRY_DSN", "");

    captureMessage("test message", "warning");

    expect(mockCaptureMessage).not.toHaveBeenCalled();
  });

  // Tests R-ERR-13 (negative: confirm no crash with various inputs)
  it("captureException handles non-Error inputs without crashing when DSN unset", () => {
    vi.stubEnv("VITE_SENTRY_DSN", "");

    captureException("string error");
    captureException(42);
    captureException(null);
    captureException(undefined);
    captureException({ custom: "object" });

    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  // Tests R-ERR-08 (verify context parameter forwarding when DSN IS set)
  it("captureException forwards error and context to Sentry when DSN is set", () => {
    vi.stubEnv(
      "VITE_SENTRY_DSN",
      "https://examplePublicKey@o0.ingest.sentry.io/0",
    );

    const testError = new Error("context test");
    captureException(testError, { route: "/test", userId: "abc" });

    expect(mockCaptureException).toHaveBeenCalledWith(testError, {
      extra: { route: "/test", userId: "abc" },
    });
  });

  // Tests R-ERR-08 (verify captureMessage forwards when DSN is set)
  it("captureMessage forwards message to Sentry when DSN is set", () => {
    vi.stubEnv(
      "VITE_SENTRY_DSN",
      "https://examplePublicKey@o0.ingest.sentry.io/0",
    );

    captureMessage("test warning", "warning");

    expect(mockCaptureMessage).toHaveBeenCalledWith("test warning", "warning");
  });
});
