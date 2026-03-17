import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  transitionLoadStatus,
  fetchDashboardCounts,
  fetchDispatchEvents,
} from "../../../services/dispatchService";

// Mock the api module
vi.mock("../../../services/api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

import { api } from "../../../services/api";

describe("dispatchService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("transitionLoadStatus", () => {
    it("calls api.patch with correct endpoint and body", async () => {
      const mockResult = {
        id: "load-1",
        status: "dispatched",
        version: 2,
        previous_status: "planned",
      };
      vi.mocked(api.patch).mockResolvedValue(mockResult);

      const result = await transitionLoadStatus("load-1", "dispatched" as any);

      expect(api.patch).toHaveBeenCalledWith("/loads/load-1/status", {
        status: "dispatched",
      });
      expect(result).toEqual(mockResult);
    });

    it("propagates API errors", async () => {
      vi.mocked(api.patch).mockRejectedValue(
        new Error("Invalid transition"),
      );

      await expect(
        transitionLoadStatus("load-1", "completed" as any),
      ).rejects.toThrow("Invalid transition");
    });
  });

  describe("fetchDashboardCounts", () => {
    it("calls api.get with correct endpoint", async () => {
      const mockCounts = {
        draft: 2,
        planned: 3,
        dispatched: 1,
        in_transit: 4,
        arrived: 0,
        delivered: 5,
        completed: 10,
        cancelled: 1,
        total: 26,
      };
      vi.mocked(api.get).mockResolvedValue(mockCounts);

      const result = await fetchDashboardCounts();

      expect(api.get).toHaveBeenCalledWith("/loads/counts");
      expect(result).toEqual(mockCounts);
    });
  });

  describe("fetchDispatchEvents", () => {
    it("calls api.get with correct endpoint including load ID", async () => {
      const mockEvents = [
        {
          id: "evt-1",
          load_id: "load-1",
          dispatcher_id: "disp-1",
          actor_id: "user-1",
          event_type: "STATUS_CHANGE",
          prior_state: "planned",
          next_state: "dispatched",
          correlation_id: "corr-1",
          message: "Load dispatched",
          payload: "{}",
          created_at: "2026-03-15T10:00:00Z",
        },
      ];
      vi.mocked(api.get).mockResolvedValue(mockEvents);

      const result = await fetchDispatchEvents("load-1");

      expect(api.get).toHaveBeenCalledWith("/dispatch-events/load-1");
      expect(result).toEqual(mockEvents);
      expect(result).toHaveLength(1);
    });

    it("returns empty array when no events exist", async () => {
      vi.mocked(api.get).mockResolvedValue([]);

      const result = await fetchDispatchEvents("load-no-events");

      expect(result).toEqual([]);
    });
  });
});
