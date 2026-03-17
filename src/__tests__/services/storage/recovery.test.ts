/**
 * Tests for services/storage/recovery.ts
 * Recovery domain -- Crisis Actions, Service Tickets, KCI Requests.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../../../services/authService", () => ({
  getAuthHeaders: vi.fn().mockResolvedValue({
    "Content-Type": "application/json",
    Authorization: "Bearer test-token",
  }),
  getCurrentUser: vi.fn(),
}));

vi.mock("../../../../services/config", () => ({
  API_URL: "http://localhost:5000/api",
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
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("getRawCrisisActions", () => {
    it("calls GET /api/crisis-actions and returns array", async () => {
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
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => actions,
      });

      const result = await getRawCrisisActions();

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url] = mockFetch.mock.calls[0];
      expect(url).toBe("http://localhost:5000/api/crisis-actions");
      expect(result).toEqual(actions);
    });

    it("returns empty array on non-ok response", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
      expect(await getRawCrisisActions()).toEqual([]);
    });

    it("returns empty array when response is not an array", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: "not-array" }),
      });
      expect(await getRawCrisisActions()).toEqual([]);
    });

    it("returns empty array on network error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network down"));
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
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => action,
      });

      await saveCrisisAction(action);

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toBe("http://localhost:5000/api/crisis-actions/ca-1");
      expect(opts.method).toBe("PATCH");
    });

    it("falls back to POST when PATCH fails", async () => {
      mockFetch
        .mockRejectedValueOnce(new Error("PATCH failed"))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => action,
        });

      await saveCrisisAction(action);

      expect(mockFetch).toHaveBeenCalledTimes(2);
      const [postUrl, postOpts] = mockFetch.mock.calls[1];
      expect(postUrl).toBe("http://localhost:5000/api/crisis-actions");
      expect(postOpts.method).toBe("POST");
    });

    it("throws when both PATCH and POST fail", async () => {
      mockFetch
        .mockRejectedValueOnce(new Error("PATCH failed"))
        .mockResolvedValueOnce({ ok: false, status: 500 });

      await expect(saveCrisisAction(action)).rejects.toThrow(
        "Failed to save crisis action",
      );
    });
  });
});

describe("recovery.ts — KCI Requests", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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
    it("calls GET /api/kci-requests and returns array", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => sampleRequests,
      });

      const result = await getRawRequests();

      expect(result).toHaveLength(3);
      expect(result[0].id).toBe("REQ-001");
    });

    it("returns empty array on non-ok response", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false });
      expect(await getRawRequests()).toEqual([]);
    });

    it("returns empty array on non-array response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ requests: [] }),
      });
      expect(await getRawRequests()).toEqual([]);
    });

    it("returns empty array on network error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Timeout"));
      expect(await getRawRequests()).toEqual([]);
    });
  });

  describe("getRequests (filtered)", () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => sampleRequests,
      });
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
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => request,
      });

      await saveRequest(request as any);

      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain("/kci-requests/REQ-001");
      expect(opts.method).toBe("PATCH");
    });

    it("falls back to POST when PATCH fails", async () => {
      mockFetch
        .mockRejectedValueOnce(new Error("not found"))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => request,
        });

      await saveRequest(request as any);

      expect(mockFetch).toHaveBeenCalledTimes(2);
      const [postUrl, postOpts] = mockFetch.mock.calls[1];
      expect(postUrl).toBe("http://localhost:5000/api/kci-requests");
      expect(postOpts.method).toBe("POST");
    });

    it("throws when both PATCH and POST fail", async () => {
      mockFetch
        .mockRejectedValueOnce(new Error("patch"))
        .mockResolvedValueOnce({ ok: false });

      await expect(saveRequest(request as any)).rejects.toThrow(
        "Failed to save KCI request",
      );
    });
  });

  describe("updateRequestStatus", () => {
    const actor = { id: "user-1", name: "John Doe" };

    beforeEach(() => {
      // Reset fetch for each test
      mockFetch.mockReset();
    });

    it("sends PATCH with status and decision log", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "REQ-001", status: "APPROVED" }),
      });

      const result = await updateRequestStatus(
        "REQ-001",
        "APPROVED",
        actor,
        "Approved for payment",
        150,
      );

      expect(result).not.toBeNull();
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain("/kci-requests/REQ-001");
      expect(opts.method).toBe("PATCH");
      const body = JSON.parse(opts.body);
      expect(body.status).toBe("APPROVED");
      expect(body.approved_by).toBe("John Doe");
      expect(body.approved_amount).toBe(150);
      expect(body.decision_log).toHaveLength(1);
    });

    it("sets denied fields for DENIED status", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "REQ-001", status: "DENIED" }),
      });

      await updateRequestStatus(
        "REQ-001",
        "DENIED",
        actor,
        "Insufficient documentation",
      );

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.denied_by).toBe("John Doe");
      expect(body.denial_reason).toBe("Insufficient documentation");
    });

    it("returns null on non-ok response", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

      const result = await updateRequestStatus(
        "REQ-999",
        "APPROVED",
        actor,
      );
      expect(result).toBeNull();
    });

    it("returns null on network error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await updateRequestStatus(
        "REQ-001",
        "APPROVED",
        actor,
      );
      expect(result).toBeNull();
    });

    it("includes decision_log with timestamp, actor, and note", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await updateRequestStatus(
        "REQ-001",
        "PENDING_APPROVAL",
        actor,
        "Needs manager review",
      );

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
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
        {
          id: "REQ-1",
          status: "NEW",
          priority: "NORMAL",
          createdAt: "2026-01-03T00:00:00Z",
        },
        {
          id: "REQ-2",
          status: "APPROVED",
          priority: "HIGH",
          createdAt: "2026-01-01T00:00:00Z",
        },
        {
          id: "REQ-3",
          status: "PENDING_APPROVAL",
          priority: "HIGH",
          createdAt: "2026-01-02T00:00:00Z",
        },
        {
          id: "REQ-4",
          status: "NEEDS_INFO",
          priority: "NORMAL",
          createdAt: "2026-01-01T00:00:00Z",
        },
        {
          id: "REQ-5",
          status: "CLOSED",
          priority: "HIGH",
          createdAt: "2026-01-01T00:00:00Z",
        },
        {
          id: "REQ-6",
          status: "DEFERRED",
          priority: "NORMAL",
          createdAt: "2026-01-04T00:00:00Z",
        },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => requests,
      });

      const result = await getUnresolvedRequests();

      // Should include NEW, PENDING_APPROVAL, NEEDS_INFO, DEFERRED but not APPROVED or CLOSED
      expect(result).toHaveLength(4);
      expect(result.map((r) => r.id)).not.toContain("REQ-2");
      expect(result.map((r) => r.id)).not.toContain("REQ-5");

      // HIGH priority should come first
      expect(result[0].id).toBe("REQ-3");
    });

    it("sorts by date (oldest first) within same priority", async () => {
      const requests = [
        {
          id: "REQ-B",
          status: "NEW",
          priority: "NORMAL",
          createdAt: "2026-01-10T00:00:00Z",
        },
        {
          id: "REQ-A",
          status: "NEW",
          priority: "NORMAL",
          createdAt: "2026-01-05T00:00:00Z",
        },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => requests,
      });

      const result = await getUnresolvedRequests();

      expect(result[0].id).toBe("REQ-A");
      expect(result[1].id).toBe("REQ-B");
    });
  });
});

describe("recovery.ts — Service Tickets", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("getRawServiceTickets", () => {
    it("calls GET /api/service-tickets and returns array", async () => {
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
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => tickets,
      });

      const result = await getRawServiceTickets();
      expect(result).toEqual(tickets);
    });

    it("returns empty array on non-ok response", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false });
      expect(await getRawServiceTickets()).toEqual([]);
    });

    it("returns empty array on non-array response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ tickets: [] }),
      });
      expect(await getRawServiceTickets()).toEqual([]);
    });

    it("returns empty array on network error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("offline"));
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
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ticket,
      });

      await saveServiceTicket(ticket as any);

      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain("/service-tickets/ST-1");
      expect(opts.method).toBe("PATCH");
    });

    it("falls back to POST when PATCH fails", async () => {
      mockFetch
        .mockRejectedValueOnce(new Error("not found"))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ticket,
        });

      await saveServiceTicket(ticket as any);

      expect(mockFetch).toHaveBeenCalledTimes(2);
      const [postUrl, postOpts] = mockFetch.mock.calls[1];
      expect(postUrl).toBe("http://localhost:5000/api/service-tickets");
      expect(postOpts.method).toBe("POST");
    });

    it("throws when both PATCH and POST fail", async () => {
      mockFetch
        .mockRejectedValueOnce(new Error("patch"))
        .mockResolvedValueOnce({ ok: false });

      await expect(saveServiceTicket(ticket as any)).rejects.toThrow(
        "Failed to save service ticket",
      );
    });
  });
});
