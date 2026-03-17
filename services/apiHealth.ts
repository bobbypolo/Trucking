/**
 * API Health Monitor — tracks connection status and surfaces failures.
 * STORY-010: Replaces silent "API fallback" console.warn with visible reporting.
 */
import { API_URL } from "./config";

type ConnectionStatus = "connected" | "degraded" | "offline";
type HealthListener = (status: ConnectionStatus) => void;

let currentStatus: ConnectionStatus = "connected";
let consecutiveFailures = 0;
let listeners: HealthListener[] = [];
let pollInterval: ReturnType<typeof setInterval> | null = null;

export const apiHealth = {
  getStatus(): ConnectionStatus {
    return currentStatus;
  },

  reportFailure(endpoint: string, error: unknown): void {
    consecutiveFailures++;
    const newStatus: ConnectionStatus =
      consecutiveFailures >= 3 ? "offline" : "degraded";

    if (newStatus !== currentStatus) {
      currentStatus = newStatus;
      notifyListeners();
    }

    console.warn("[apiHealth] Failure reported", {
      endpoint,
      error: error instanceof Error ? error.message : String(error),
      consecutiveFailures,
      status: currentStatus,
    });
  },

  reportSuccess(): void {
    if (consecutiveFailures > 0 || currentStatus !== "connected") {
      consecutiveFailures = 0;
      currentStatus = "connected";
      notifyListeners();
    }
  },

  onConnectionChange(listener: HealthListener): () => void {
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  },

  startPolling(): void {
    if (pollInterval) return;
    pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}/health`, {
          signal: AbortSignal.timeout(5000),
        });
        if (res.ok) {
          apiHealth.reportSuccess();
        } else {
          apiHealth.reportFailure("/api/health", `HTTP ${res.status}`);
        }
      } catch (error) {
        apiHealth.reportFailure("/api/health", error);
      }
    }, 30000);
  },

  stopPolling(): void {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  },

  async checkNow(): Promise<ConnectionStatus> {
    try {
      const res = await fetch(`${API_URL}/health`, {
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        apiHealth.reportSuccess();
        return "connected";
      }
      apiHealth.reportFailure("/api/health", `HTTP ${res.status}`);
      return currentStatus;
    } catch (error) {
      apiHealth.reportFailure("/api/health", error);
      return currentStatus;
    }
  },
};

function notifyListeners(): void {
  for (const listener of listeners) {
    try {
      listener(currentStatus);
    } catch {
      // listener errors are non-fatal
    }
  }
}
