import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Tests for server/lib/graceful-shutdown.ts
 *
 * Mocks: HTTP server.close(), closePool (db), process.exit, setTimeout.
 * Tests the graceful shutdown sequence.
 */

const { mockClosePool } = vi.hoisted(() => ({
  mockClosePool: vi.fn(),
}));

vi.mock("../../db", () => ({
  closePool: mockClosePool,
}));

vi.mock("../../lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { registerShutdownHandlers } from "../../lib/graceful-shutdown";
import { logger } from "../../lib/logger";

describe("graceful-shutdown.ts", () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {}) as any);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    exitSpy.mockRestore();
  });

  function createMockServer(closeError?: Error) {
    return {
      close: vi.fn((cb: (err?: Error) => void) => {
        if (closeError) {
          cb(closeError);
        } else {
          cb();
        }
      }),
    };
  }

  it("logs the signal name on shutdown", async () => {
    const server = createMockServer();
    mockClosePool.mockResolvedValue(undefined);

    await registerShutdownHandlers(server as any, "SIGTERM");

    expect(logger.info).toHaveBeenCalledWith(
      { signal: "SIGTERM" },
      "Shutting down gracefully...",
    );
  });

  it("closes HTTP server and DB pool in sequence", async () => {
    const server = createMockServer();
    mockClosePool.mockResolvedValue(undefined);

    await registerShutdownHandlers(server as any, "SIGINT");

    expect(server.close).toHaveBeenCalled();
    expect(mockClosePool).toHaveBeenCalled();
  });

  it("calls process.exit(0) on successful shutdown", async () => {
    const server = createMockServer();
    mockClosePool.mockResolvedValue(undefined);

    await registerShutdownHandlers(server as any, "SIGTERM");

    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it("logs error when server.close() fails but continues shutdown", async () => {
    const server = createMockServer(new Error("Close failed"));
    mockClosePool.mockResolvedValue(undefined);

    await registerShutdownHandlers(server as any, "SIGTERM");

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(Error) }),
      "Error closing HTTP server",
    );
    // Should still call closePool and exit
    expect(mockClosePool).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it("logs error and still exits 0 when closePool() throws", async () => {
    const server = createMockServer();
    mockClosePool.mockRejectedValue(new Error("Pool close failed"));

    await registerShutdownHandlers(server as any, "SIGTERM");

    // Server should still have been closed
    expect(server.close).toHaveBeenCalled();
    // closePool was called (and threw)
    expect(mockClosePool).toHaveBeenCalled();
    // Error should be logged
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(Error) }),
      "Error closing database pool",
    );
    // Should still exit with 0 (graceful)
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it("sets a 10-second force-exit timeout", async () => {
    const server = createMockServer();
    mockClosePool.mockResolvedValue(undefined);

    // Use spy to check setTimeout was called
    const setTimeoutSpy = vi.spyOn(global, "setTimeout");

    await registerShutdownHandlers(server as any, "SIGTERM");

    // Should have set a timeout with 10000ms
    const timeoutCall = setTimeoutSpy.mock.calls.find(
      (call) => call[1] === 10000,
    );
    expect(timeoutCall).toBeDefined();

    setTimeoutSpy.mockRestore();
  });
});
