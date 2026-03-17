import { describe, it, expect, vi, beforeEach } from "vitest";
import { DetentionService } from "../../../services/detentionService";

// Mock uuid to get deterministic IDs
vi.mock("uuid", () => ({
  v4: vi.fn(() => "abcdef-1234-5678-9abc-def012345678"),
}));

describe("DetentionService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockLoad = {
    id: "LOAD-001",
    companyId: "COMP-1",
    driverId: "DRV-1",
    loadNumber: "LN-001",
    status: "in_transit" as const,
    carrierRate: 2500,
    driverPay: 1800,
    pickupDate: "2026-03-15",
    pickup: { city: "Chicago", state: "IL" },
    dropoff: { city: "Milwaukee", state: "WI" },
  };

  describe("processGeofenceEvent", () => {
    it("returns isBillable: false for ENTRY events", async () => {
      const result = await DetentionService.processGeofenceEvent(
        mockLoad as any,
        "ENTRY",
        new Date().toISOString(),
      );

      expect(result).toEqual({ isBillable: false });
    });

    it("returns billable detention when dwell time exceeds free time", async () => {
      // The mock inside the service creates a 3.5 hour dwell time
      // Free time is 2h, so billable hours = ceil(3.5 - 2) = 2
      const result = await DetentionService.processGeofenceEvent(
        mockLoad as any,
        "EXIT",
        new Date().toISOString(),
      );

      expect(result.isBillable).toBe(true);
      expect(result.request).toBeDefined();
      expect(result.request.loadId).toBe("LOAD-001");
      expect(result.request.type).toBe("DETENTION");
      expect(result.request.status).toBe("PENDING_APPROVAL");
      expect(result.request.createdBy).toBe("Detention-Bot");
    });

    it("calculates correct billable amount", async () => {
      const result = await DetentionService.processGeofenceEvent(
        mockLoad as any,
        "EXIT",
        new Date().toISOString(),
      );

      // Dwell: ~3.5h, free: 2h, billable: ceil(1.5) = 2h, rate: $50/h
      expect(result.request.requestedAmount).toBe(100); // 2 * 50
    });

    it("generates detention request with correct ID format", async () => {
      const result = await DetentionService.processGeofenceEvent(
        mockLoad as any,
        "EXIT",
        new Date().toISOString(),
      );

      expect(result.request.id).toMatch(/^DET-[A-Z0-9]{6}$/);
    });

    it("includes dwell time in response", async () => {
      const result = await DetentionService.processGeofenceEvent(
        mockLoad as any,
        "EXIT",
        new Date().toISOString(),
      );

      expect(result.dwellTime).toBeGreaterThan(3);
      expect(result.dwellTime).toBeLessThan(4);
    });

    it("includes automated detection note", async () => {
      const result = await DetentionService.processGeofenceEvent(
        mockLoad as any,
        "EXIT",
        new Date().toISOString(),
      );

      expect(result.request.notes).toContain("Automated detection");
      expect(result.request.notes).toContain("dwell time");
      expect(result.request.notes).toContain("free time exceeded");
    });

    it("includes createdAt timestamp in ISO format", async () => {
      const result = await DetentionService.processGeofenceEvent(
        mockLoad as any,
        "EXIT",
        new Date().toISOString(),
      );

      expect(result.request.createdAt).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
      );
    });
  });
});
