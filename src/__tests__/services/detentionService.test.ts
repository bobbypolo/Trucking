import { describe, it, expect, vi, beforeEach } from "vitest";

// Use vi.hoisted so mock fns are available when vi.mock factory runs (hoisted)
const { mockPost, mockGet } = vi.hoisted(() => ({
  mockPost: vi.fn(),
  mockGet: vi.fn(),
}));

vi.mock("../../../services/api", () => ({
  api: {
    post: mockPost,
    get: mockGet,
  },
}));

import { DetentionService } from "../../../services/detentionService";

describe("DetentionService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("processGeofenceEvent", () => {
    it("calls POST /api/geofence-events with event payload", async () => {
      const mockResponse = { id: "ev-123", message: "Geofence event recorded" };
      mockPost.mockResolvedValueOnce(mockResponse);

      const event = {
        loadId: "LOAD-001",
        eventType: "ENTRY" as const,
        facilityLat: 33.1234,
        facilityLng: -97.5678,
        facilityName: "Warehouse A",
      };

      const result = await DetentionService.processGeofenceEvent(event);

      expect(mockPost).toHaveBeenCalledWith("/api/geofence-events", event);
      expect(result.id).toBe("ev-123");
      expect(result.message).toBe("Geofence event recorded");
    });

    it("passes EXIT event type correctly", async () => {
      mockPost.mockResolvedValueOnce({
        id: "ev-456",
        message: "Geofence event recorded",
      });

      const event = {
        loadId: "LOAD-002",
        eventType: "EXIT" as const,
        facilityLat: 34.0,
        facilityLng: -98.0,
        driverId: "DRV-1",
        eventTimestamp: "2026-03-20T14:00:00Z",
      };

      await DetentionService.processGeofenceEvent(event);

      expect(mockPost).toHaveBeenCalledWith("/api/geofence-events", event);
      expect(mockPost.mock.calls[0][1].eventType).toBe("EXIT");
    });

    it("propagates API errors", async () => {
      mockPost.mockRejectedValueOnce(new Error("Network error"));

      const event = {
        loadId: "LOAD-003",
        eventType: "ENTRY" as const,
        facilityLat: 33.0,
        facilityLng: -97.0,
      };

      await expect(
        DetentionService.processGeofenceEvent(event),
      ).rejects.toThrow("Network error");
    });
  });

  describe("calculateDetention", () => {
    it("calls POST /api/detention/calculate with loadId", async () => {
      const mockResponse = {
        loadId: "LOAD-001",
        records: [
          {
            facilityName: "WH-A",
            entryTime: "2026-03-20T08:00:00",
            exitTime: "2026-03-20T13:00:00",
            dwellHours: 5,
            billableHours: 3,
            charge: 225,
            freeHours: 2,
            hourlyRate: 75,
          },
        ],
        totalCharge: 225,
        rules: { freeHours: 2, hourlyRate: 75, maxBillableHours: 24 },
      };
      mockPost.mockResolvedValueOnce(mockResponse);

      const result = await DetentionService.calculateDetention("LOAD-001");

      expect(mockPost).toHaveBeenCalledWith("/api/detention/calculate", {
        loadId: "LOAD-001",
      });
      expect(result.loadId).toBe("LOAD-001");
      expect(result.records).toHaveLength(1);
      expect(result.records[0].charge).toBe(225);
      expect(result.totalCharge).toBe(225);
      expect(result.rules.freeHours).toBe(2);
    });

    it("returns zero detention when no records", async () => {
      mockPost.mockResolvedValueOnce({
        loadId: "LOAD-EMPTY",
        records: [],
        totalCharge: 0,
        rules: { freeHours: 2, hourlyRate: 75, maxBillableHours: 24 },
      });

      const result = await DetentionService.calculateDetention("LOAD-EMPTY");

      expect(result.records).toHaveLength(0);
      expect(result.totalCharge).toBe(0);
    });

    it("propagates API errors", async () => {
      mockPost.mockRejectedValueOnce(new Error("Server error"));

      await expect(
        DetentionService.calculateDetention("LOAD-ERR"),
      ).rejects.toThrow("Server error");
    });
  });

  describe("getGeofenceEvents", () => {
    it("calls GET /api/geofence-events with loadId query param", async () => {
      const mockEvents = [
        {
          id: "ev-1",
          event_type: "ENTRY",
          event_timestamp: "2026-03-20T10:00:00",
        },
        {
          id: "ev-2",
          event_type: "EXIT",
          event_timestamp: "2026-03-20T14:00:00",
        },
      ];
      mockGet.mockResolvedValueOnce(mockEvents);

      const result = await DetentionService.getGeofenceEvents("LOAD-001");

      expect(mockGet).toHaveBeenCalledWith(
        "/api/geofence-events?loadId=LOAD-001",
      );
      expect(result).toHaveLength(2);
      expect(result[0].event_type).toBe("ENTRY");
      expect(result[1].event_type).toBe("EXIT");
    });

    it("encodes loadId with special characters", async () => {
      mockGet.mockResolvedValueOnce([]);

      await DetentionService.getGeofenceEvents("LOAD/001&x=1");

      expect(mockGet).toHaveBeenCalledWith(
        "/api/geofence-events?loadId=LOAD%2F001%26x%3D1",
      );
    });
  });
});
