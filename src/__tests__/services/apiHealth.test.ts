import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock config
vi.mock("../../../services/config", () => ({
  API_URL: "http://test-api:5000/api",
}));

// Must import after mocks
import { apiHealth } from "../../../services/apiHealth";

describe("apiHealth", () => {
  beforeEach(() => {
    // Reset internal state by reporting success
    apiHealth.reportSuccess();
    apiHealth.stopPolling();
    vi.spyOn(globalThis, "fetch").mockReset();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    apiHealth.stopPolling();
    vi.restoreAllMocks();
  });

  // --- getStatus ---
  describe("getStatus", () => {
    it("returns 'connected' by default", () => {
      expect(apiHealth.getStatus()).toBe("connected");
    });
  });

  // --- reportFailure ---
  describe("reportFailure", () => {
    it("transitions to 'degraded' after first failure", () => {
      apiHealth.reportFailure("/api/test", new Error("timeout"));
      expect(apiHealth.getStatus()).toBe("degraded");
    });

    it("transitions to 'offline' after 3 consecutive failures", () => {
      apiHealth.reportFailure("/api/test", "err1");
      apiHealth.reportFailure("/api/test", "err2");
      apiHealth.reportFailure("/api/test", "err3");
      expect(apiHealth.getStatus()).toBe("offline");
    });

    it("logs failure details with Error instance message", () => {
      apiHealth.reportFailure("/api/loads", new Error("Network error"));
      expect(console.warn).toHaveBeenCalledWith(
        "[apiHealth] Failure reported",
        expect.objectContaining({
          endpoint: "/api/loads",
          error: "Network error",
          consecutiveFailures: 1,
          status: "degraded",
        }),
      );
    });

    it("logs failure details with string error", () => {
      apiHealth.reportFailure("/api/loads", "HTTP 500");
      expect(console.warn).toHaveBeenCalledWith(
        "[apiHealth] Failure reported",
        expect.objectContaining({
          error: "HTTP 500",
        }),
      );
    });

    it("notifies listeners when status changes", () => {
      const listener = vi.fn();
      apiHealth.onConnectionChange(listener);
      apiHealth.reportFailure("/api/test", "err");
      expect(listener).toHaveBeenCalledWith("degraded");
    });

    it("does not notify listeners when status stays the same", () => {
      const listener = vi.fn();
      apiHealth.reportFailure("/api/test", "err1"); // degraded
      apiHealth.onConnectionChange(listener);
      apiHealth.reportFailure("/api/test", "err2"); // still degraded
      expect(listener).not.toHaveBeenCalled();
    });
  });

  // --- reportSuccess ---
  describe("reportSuccess", () => {
    it("resets status to 'connected' after failures", () => {
      apiHealth.reportFailure("/api/test", "err1");
      apiHealth.reportFailure("/api/test", "err2");
      expect(apiHealth.getStatus()).toBe("degraded");
      apiHealth.reportSuccess();
      expect(apiHealth.getStatus()).toBe("connected");
    });

    it("notifies listeners when recovering from failure", () => {
      apiHealth.reportFailure("/api/test", "err1");
      const listener = vi.fn();
      apiHealth.onConnectionChange(listener);
      apiHealth.reportSuccess();
      expect(listener).toHaveBeenCalledWith("connected");
    });

    it("does not notify listeners when already connected", () => {
      const listener = vi.fn();
      apiHealth.onConnectionChange(listener);
      apiHealth.reportSuccess();
      expect(listener).not.toHaveBeenCalled();
    });
  });

  // --- onConnectionChange ---
  describe("onConnectionChange", () => {
    it("returns an unsubscribe function", () => {
      const listener = vi.fn();
      const unsub = apiHealth.onConnectionChange(listener);
      unsub();
      apiHealth.reportFailure("/api/test", "err");
      expect(listener).not.toHaveBeenCalled();
    });

    it("supports multiple listeners", () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      apiHealth.onConnectionChange(listener1);
      apiHealth.onConnectionChange(listener2);
      apiHealth.reportFailure("/api/test", "err");
      expect(listener1).toHaveBeenCalledWith("degraded");
      expect(listener2).toHaveBeenCalledWith("degraded");
    });

    it("handles listener errors gracefully", () => {
      const badListener = vi.fn(() => {
        throw new Error("listener crash");
      });
      const goodListener = vi.fn();
      apiHealth.onConnectionChange(badListener);
      apiHealth.onConnectionChange(goodListener);
      apiHealth.reportFailure("/api/test", "err");
      expect(badListener).toHaveBeenCalled();
      expect(goodListener).toHaveBeenCalledWith("degraded");
    });
  });

  // --- checkNow ---
  describe("checkNow", () => {
    it("returns 'connected' when health endpoint responds OK", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
      } as Response);
      const status = await apiHealth.checkNow();
      expect(status).toBe("connected");
    });

    it("calls the correct health endpoint URL", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
      } as Response);
      await apiHealth.checkNow();
      expect(fetchSpy).toHaveBeenCalledWith(
        "http://test-api:5000/api/health",
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });

    it("reports failure and returns degraded status on non-OK response", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: false,
        status: 503,
      } as Response);
      const status = await apiHealth.checkNow();
      expect(status).toBe("degraded");
    });

    it("reports failure and returns status on fetch error", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(
        new Error("Network unreachable"),
      );
      const status = await apiHealth.checkNow();
      expect(status).toBe("degraded");
    });

    it("returns 'offline' after enough consecutive fetch errors", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("down"));
      await apiHealth.checkNow();
      await apiHealth.checkNow();
      const status = await apiHealth.checkNow();
      expect(status).toBe("offline");
    });
  });

  // --- startPolling / stopPolling ---
  describe("polling", () => {
    it("startPolling sets up an interval", () => {
      vi.useFakeTimers();
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
      } as Response);
      apiHealth.startPolling();
      // Second call should be a no-op
      apiHealth.startPolling();
      vi.advanceTimersByTime(30000);
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      apiHealth.stopPolling();
      vi.useRealTimers();
    });

    it("stopPolling clears the interval", () => {
      vi.useFakeTimers();
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
      } as Response);
      apiHealth.startPolling();
      apiHealth.stopPolling();
      vi.advanceTimersByTime(60000);
      expect(globalThis.fetch).not.toHaveBeenCalled();
      vi.useRealTimers();
    });

    it("stopPolling is safe to call when not polling", () => {
      expect(() => apiHealth.stopPolling()).not.toThrow();
    });

    it("polling reports success on OK response", async () => {
      vi.useFakeTimers();
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
      } as Response);
      apiHealth.reportFailure("/api/test", "err"); // make it degraded
      apiHealth.startPolling();
      await vi.advanceTimersByTimeAsync(30000);
      expect(apiHealth.getStatus()).toBe("connected");
      apiHealth.stopPolling();
      vi.useRealTimers();
    });

    it("polling reports failure on non-OK response", async () => {
      vi.useFakeTimers();
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: false,
        status: 500,
      } as Response);
      apiHealth.startPolling();
      await vi.advanceTimersByTimeAsync(30000);
      expect(apiHealth.getStatus()).toBe("degraded");
      apiHealth.stopPolling();
      vi.useRealTimers();
    });

    it("polling reports failure on fetch error", async () => {
      vi.useFakeTimers();
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
      apiHealth.startPolling();
      await vi.advanceTimersByTimeAsync(30000);
      expect(apiHealth.getStatus()).toBe("degraded");
      apiHealth.stopPolling();
      vi.useRealTimers();
    });
  });
});
