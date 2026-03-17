import { describe, it, expect, vi } from "vitest";

vi.mock("uuid", () => ({
  v4: vi.fn(() => "abcdef-1234-5678-90ab-cdef12345678"),
}));

import { DetentionService } from "../../../services/detentionService";
import type { LoadData } from "../../../types";

describe("DetentionService", () => {
  const makeLoad = (overrides: Partial<LoadData> = {}): LoadData =>
    ({
      id: "load-001",
      loadNumber: "LD-1234",
      ...overrides,
    }) as LoadData;

  describe("processGeofenceEvent", () => {
    it("returns isBillable=false for ENTRY events", async () => {
      const result = await DetentionService.processGeofenceEvent(
        makeLoad(),
        "ENTRY",
        new Date().toISOString(),
      );
      expect(result.isBillable).toBe(false);
      expect(result.request).toBeUndefined();
    });

    it("returns isBillable=true for EXIT events when dwell time exceeds free time", async () => {
      // The service mocks 3.5h dwell time, free time is 2h
      const result = await DetentionService.processGeofenceEvent(
        makeLoad(),
        "EXIT",
        new Date().toISOString(),
      );
      expect(result.isBillable).toBe(true);
      expect(result.dwellTime).toBeCloseTo(3.5, 0);
    });

    it("generates a detention request with correct structure", async () => {
      const result = await DetentionService.processGeofenceEvent(
        makeLoad({ id: "load-999" }),
        "EXIT",
        new Date().toISOString(),
      );
      const request = result.request;
      expect(request).toBeDefined();
      expect(request.id).toMatch(/^DET-/);
      expect(request.loadId).toBe("load-999");
      expect(request.type).toBe("DETENTION");
      expect(request.status).toBe("PENDING_APPROVAL");
      expect(request.createdBy).toBe("Detention-Bot");
      expect(request.createdAt).toBeTruthy();
    });

    it("calculates billable amount correctly (ceiling of excess hours * rate)", async () => {
      // 3.5h dwell - 2h free = 1.5h excess, ceil = 2h, rate $50/h = $100
      const result = await DetentionService.processGeofenceEvent(
        makeLoad(),
        "EXIT",
        new Date().toISOString(),
      );
      expect(result.request.requestedAmount).toBe(100);
    });

    it("includes descriptive notes with dwell time and free time info", async () => {
      const result = await DetentionService.processGeofenceEvent(
        makeLoad(),
        "EXIT",
        new Date().toISOString(),
      );
      expect(result.request.notes).toContain("Automated detection");
      expect(result.request.notes).toContain("dwell time");
      expect(result.request.notes).toContain("free time exceeded");
    });

    it("handles different load IDs correctly", async () => {
      const result = await DetentionService.processGeofenceEvent(
        makeLoad({ id: "load-XYZ" }),
        "EXIT",
        new Date().toISOString(),
      );
      expect(result.request.loadId).toBe("load-XYZ");
    });
  });
});
