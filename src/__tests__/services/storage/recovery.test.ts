/**
 * Tests for services/storage/recovery.ts
 * Recovery domain -- Crisis Actions, Service Tickets, KCI Requests via api client.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    postFormData: vi.fn(),
  },
}));

vi.mock("../../../../services/api", () => ({
  api: mockApi,
  apiFetch: vi.fn(),
}));

import {
  getRawCrisisActions,
  saveCrisisAction,
  getRawRequests,
  getRequests,
  saveRequest,
  updateRequestStatus,
  getUnresolvedRequests,
  getRawServiceTickets,
  saveServiceTicket,
} from "../../../../services/storage/recovery";

describe("recovery.ts — Crisis Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getRawCrisisActions", () => {
    it("calls api.get /crisis-actions and returns array", async () => {
      const actions = [
        {
          id: "ca-1",
          type: "REPOWER",
          status: "WATCH",
          loadId: "L-1",
          description: "Unit breakdown",
          timeline: [],
          notificationsSent: [],
          createdAt: "2026-01-01T00:00:00Z",
        },
      ];
      mockApi.get.mockResolvedValueOnce(actions);

      const result = await getRawCrisisActions();

      expect(mockApi.get).toHaveBeenCalledWith("/crisis-actions");
      expect(result).toEqual(actions);
    });

    it("returns empty array on API error", async () => {
      mockApi.get.mockRejectedValueOnce(new Error("500"));
      expect(await getRawCrisisActions()).toEqual([]);
    });

    it("returns empty array when response is not an array", async () => {
      mockApi.get.mockResolvedValueOnce({ data: "not-array" });
      expect(await getRawCrisisActions()).toEqual([]);
    });

    it("returns empty array on network error", async () => {
      mockApi.get.mockRejectedValueOnce(new Error("Network down"));
      expect(await getRawCrisisActions()).toEqual([]);
    });
  });

  describe("saveCrisisAction", () => {
    const action = {
      id: "ca-1",
      type: "REPOWER" as const,
      status: "WATCH" as const,
      loadId: "L-1",
      description: "Test action",
      timeline: [],
      notificationsSent: [],
      createdAt: "2026-01-01T00:00:00Z",
    };

    it("tries PATCH first for existing action", async () => {
      mockApi.patch.mockResolvedValueOnce(action);

      await saveCrisisAction(action);

      expect(mockApi.patch).toHaveBeenCalledWith(
        "/crisis-actions/ca-1",
        action,
      );
    });

    it("falls back to POST when PATCH fails", async () => {
      mockApi.patch.mockRejectedValueOnce(new Error("PATCH failed"));
      mockApi.post.mockResolvedValueOnce(action);

      await saveCrisisAction(action);

      expect(mockApi.patch).toHaveBeenCalledOnce();
      expect(mockApi.post).toHaveBeenCalledWith("/crisis-actions", action);
    });

    it("throws when both PATCH and POST fail", async () => {
      mockApi.patch.mockRejectedValueOnce(new Error("PATCH failed"));
      mockApi.post.mockRejectedValueOnce(
        new Error("API Request failed: 500"),
      );

      await expect(saveCrisisAction(action)).rejects.toThrow();
    });
  });
});

describe("recovery.ts — KCI Requests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const sampleRequests = [
    {
      id: "REQ-001",
      type: "LUMPER",
      status: "NEW" as const,
      priority: "HIGH" as const,
      currency: "USD",
      requiresDocs: false,
      loadId: "L-100",
      driverId: "D-1",
      openRecordId: "OR-1",
      createdAt: "2026-01-01T00:00:00Z",
    },
    {
      id: "REQ-002",
      type: "FUEL_ADVANCE",
      status: "APPROVED" as const,
      priority: "NORMAL" as const,
      currency: "USD",
      requiresDocs: false,
      loadId: "L-200",
      driverId: "D-2",
      createdAt: "2026-01-02T00:00:00Z",
    },
    {
      id: "REQ-003",
      type: "DETENTION",
      status: "PENDING_APPROVAL" as const,
      priority: "NORMAL" as const,
      currency: "USD",
      requiresDocs: true,
      loadId: "L-100",
      driverId: "D-1",
      createdAt: "2026-01-03T00:00:00Z",
    },
  ];

  describe("getRawRequests", () => {
    it("calls api.get /kci-requests and returns array", async () => {
      mockApi.get.mockResolvedValueOnce(sampleRequests);

      const result = await getRawRequests();

      expect(result).toHaveLength(3);
      expect(result[0].id).toBe("REQ-001");
    });

    it("returns empty array on API error", async () => {
      mockApi.get.mockRejectedValueOnce(new Error("fail"));
      expect(await getRawRequests()).toEqual([]);
    });

    it("returns empty array on non-array response", async () => {
      mockApi.get.mockResolvedValueOnce({ requests: [] });
      expect(await getRawRequests()).toEqual([]);
    });

    it("returns empty array on network error", async () => {
      mockApi.get.mockRejectedValueOnce(new Error("Timeout"));
      expect(await getRawRequests()).toEqual([]);
    });
  });

  describe("getRequests (filtered)", () => {
    beforeEach(() => {
      mockApi.get.mockResolvedValue(sampleRequests);
    });

    it("returns all requests when no filters are provided", async () => {
      const result = await getRequests();
      expect(result).toHaveLength(3);
    });

    it("filters by loadId", async () => {
      const result = await getRequests({ loadId: "L-100" });
      expect(result).toHaveLength(2);
      expect(result.every((r) => r.loadId === "L-100")).toBe(true);
    });

    it("filters by driverId", async () => {
      const result = await getRequests({ driverId: "D-2" });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("REQ-002");
    });

    it("filters by openRecordId", async () => {
      const result = await getRequests({ openRecordId: "OR-1" });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("REQ-001");
    });

    it("applies multiple filters (AND logic)", async () => {
      const result = await getRequests({
        loadId: "L-100",
        driverId: "D-1",
      });
      expect(result).toHaveLength(2);
    });
  });

  describe("saveRequest", () => {
    const request = {
      id: "REQ-001",
      type: "LUMPER",
      status: "NEW" as const,
      priority: "HIGH" as const,
      currency: "USD",
      requiresDocs: false,
      createdAt: "2026-01-01T00:00:00Z",
    };

    it("tries PATCH first", async () => {
      mockApi.patch.mockResolvedValueOnce(request);

      await saveRequest(request as any);

      expect(mockApi.patch).toHaveBeenCalledWith(
        "/kci-requests/REQ-001",
        request,
      );
    });

    it("falls back to POST when PATCH fails", async () => {
      mockApi.patch.mockRejectedValueOnce(new Error("not found"));
      mockApi.post.mockResolvedValueOnce(request);

      await saveRequest(request as any);

      expect(mockApi.patch).toHaveBeenCalledOnce();
      expect(mockApi.post).toHaveBeenCalledWith("/kci-requests", request);
    });

    it("throws when both PATCH and POST fail", async () => {
      mockApi.patch.mockRejectedValueOnce(new Error("patch"));
      mockApi.post.mockRejectedValueOnce(
        new Error("API Request failed: 500"),
      );

      await expect(saveRequest(request as any)).rejects.toThrow();
    });
  });

  describe("updateRequestStatus", () => {
    const actor = { id: "user-1", name: "John Doe" };

    it("sends PATCH with status and decision log", async () => {
      mockApi.patch.mockResolvedValueOnce({
        id: "REQ-001",
        status: "APPROVED",
      });

      const result = await updateRequestStatus(
        "REQ-001",
        "APPROVED",
        actor,
        "Approved for payment",
        150,
      );

      expect(result).not.toBeNull();
      expect(mockApi.patch).toHaveBeenCalledOnce();
      const [endpoint, body] = mockApi.patch.mock.calls[0];
      expect(endpoint).toBe("/kci-requests/REQ-001");
      expect(body.status).toBe("APPROVED");
      expect(body.approved_by).toBe("John Doe");
      expect(body.approved_amount).toBe(150);
      expect(body.decision_log).toHaveLength(1);
    });

    it("sets denied fields for DENIED status", async () => {
      mockApi.patch.mockResolvedValueOnce({
        id: "REQ-001",
        status: "DENIED",
      });

      await updateRequestStatus(
        "REQ-001",
        "DENIED",
        actor,
        "Insufficient documentation",
      );

      const body = mockApi.patch.mock.calls[0][1];
      expect(body.denied_by).toBe("John Doe");
      expect(body.denial_reason).toBe("Insufficient documentation");
    });

    it("returns null on API error", async () => {
      mockApi.patch.mockRejectedValueOnce(new Error("404"));

      const result = await updateRequestStatus(
        "REQ-999",
        "APPROVED",
        actor,
      );
      expect(result).toBeNull();
    });

    it("returns null on network error", async () => {
      mockApi.patch.mockRejectedValueOnce(new Error("Network error"));

      const result = await updateRequestStatus(
        "REQ-001",
        "APPROVED",
        actor,
      );
      expect(result).toBeNull();
    });

    it("includes decision_log with timestamp, actor, and note", async () => {
      mockApi.patch.mockResolvedValueOnce({});

      await updateRequestStatus(
        "REQ-001",
        "PENDING_APPROVAL",
        actor,
        "Needs manager review",
      );

      const body = mockApi.patch.mock.calls[0][1];
      const logEntry = body.decision_log[0];
      expect(logEntry.actorId).toBe("user-1");
      expect(logEntry.actorName).toBe("John Doe");
      expect(logEntry.afterState).toBe("PENDING_APPROVAL");
      expect(logEntry.note).toBe("Needs manager review");
      expect(logEntry.timestamp).toBeDefined();
    });
  });

  describe("getUnresolvedRequests", () => {
    it("returns only unresolved statuses sorted by priority and date", async () => {
      const requests = [
        { id: "REQ-1", status: "NEW", priority: "NORMAL", createdAt: "2026-01-03T00:00:00Z" },
        { id: "REQ-2", status: "APPROVED", priority: "HIGH", createdAt: "2026-01-01T00:00:00Z" },
        { id: "REQ-3", status: "PENDING_APPROVAL", priority: "HIGH", createdAt: "2026-01-02T00:00:00Z" },
        { id: "REQ-4", status: "NEEDS_INFO", priority: "NORMAL", createdAt: "2026-01-01T00:00:00Z" },
        { id: "REQ-5", status: "CLOSED", priority: "HIGH", createdAt: "2026-01-01T00:00:00Z" },
        { id: "REQ-6", status: "DEFERRED", priority: "NORMAL", createdAt: "2026-01-04T00:00:00Z" },
      ];
      mockApi.get.mockResolvedValueOnce(requests);

      const result = await getUnresolvedRequests();

      expect(result).toHaveLength(4);
      expect(result.map((r) => r.id)).not.toContain("REQ-2");
      expect(result.map((r) => r.id)).not.toContain("REQ-5");
      expect(result[0].id).toBe("REQ-3");
    });

    it("sorts by date (oldest first) within same priority", async () => {
      const requests = [
        { id: "REQ-B", status: "NEW", priority: "NORMAL", createdAt: "2026-01-10T00:00:00Z" },
        { id: "REQ-A", status: "NEW", priority: "NORMAL", createdAt: "2026-01-05T00:00:00Z" },
      ];
      mockApi.get.mockResolvedValueOnce(requests);

      const result = await getUnresolvedRequests();

      expect(result[0].id).toBe("REQ-A");
      expect(result[1].id).toBe("REQ-B");
    });
  });
});

describe("recovery.ts — Service Tickets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getRawServiceTickets", () => {
    it("calls api.get /service-tickets and returns array", async () => {
      const tickets = [
        {
          id: "ST-1",
          unitId: "U-1",
          type: "TIRE",
          status: "OPEN",
          priority: "High",
          description: "Flat tire",
          estimatedCost: 250,
        },
      ];
      mockApi.get.mockResolvedValueOnce(tickets);

      const result = await getRawServiceTickets();
      expect(result).toEqual(tickets);
    });

    it("returns empty array on API error", async () => {
      mockApi.get.mockRejectedValueOnce(new Error("fail"));
      expect(await getRawServiceTickets()).toEqual([]);
    });

    it("returns empty array on non-array response", async () => {
      mockApi.get.mockResolvedValueOnce({ tickets: [] });
      expect(await getRawServiceTickets()).toEqual([]);
    });

    it("returns empty array on network error", async () => {
      mockApi.get.mockRejectedValueOnce(new Error("offline"));
      expect(await getRawServiceTickets()).toEqual([]);
    });
  });

  describe("saveServiceTicket", () => {
    const ticket = {
      id: "ST-1",
      unitId: "U-1",
      type: "TIRE",
      status: "OPEN",
      priority: "High" as const,
      description: "Flat tire",
      estimatedCost: 250,
    };

    it("tries PATCH first for existing ticket", async () => {
      mockApi.patch.mockResolvedValueOnce(ticket);

      await saveServiceTicket(ticket as any);

      expect(mockApi.patch).toHaveBeenCalledWith(
        "/service-tickets/ST-1",
        ticket,
      );
    });

    it("falls back to POST when PATCH fails", async () => {
      mockApi.patch.mockRejectedValueOnce(new Error("not found"));
      mockApi.post.mockResolvedValueOnce(ticket);

      await saveServiceTicket(ticket as any);

      expect(mockApi.patch).toHaveBeenCalledOnce();
      expect(mockApi.post).toHaveBeenCalledWith("/service-tickets", ticket);
    });

    it("throws when both PATCH and POST fail", async () => {
      mockApi.patch.mockRejectedValueOnce(new Error("patch"));
      mockApi.post.mockRejectedValueOnce(
        new Error("API Request failed: 500"),
      );

      await expect(saveServiceTicket(ticket as any)).rejects.toThrow();
    });
  });
});
