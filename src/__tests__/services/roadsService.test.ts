import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * roadsService reads `import.meta.env.VITE_GOOGLE_MAPS_API_KEY` at module
 * top-level into a const. Vite replaces import.meta.env.VITE_* with
 * process.env.VITE_* in test mode, so we set it on process.env before
 * the dynamic import.
 */

describe("roadsService", () => {
  let snapToRoads: typeof import("../../../services/roadsService").snapToRoads;
  let getSpeedLimits: typeof import("../../../services/roadsService").getSpeedLimits;

  beforeEach(async () => {
    vi.resetModules();
    vi.spyOn(globalThis, "fetch").mockReset();
    // Set the env var before module evaluation
    process.env.VITE_GOOGLE_MAPS_API_KEY = "test-api-key-123";
    const mod = await import("../../../services/roadsService");
    snapToRoads = mod.snapToRoads;
    getSpeedLimits = mod.getSpeedLimits;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.VITE_GOOGLE_MAPS_API_KEY;
  });

  // --- snapToRoads ---
  describe("snapToRoads", () => {
    it("constructs the correct URL with path coordinates", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            snappedPoints: [
              {
                location: { latitude: 32.78, longitude: -96.8 },
                placeId: "abc",
              },
            ],
          }),
      } as Response);

      await snapToRoads([
        { lat: 32.78, lng: -96.8 },
        { lat: 32.79, lng: -96.81 },
      ]);

      const url = (globalThis.fetch as any).mock.calls[0][0] as string;
      expect(url).toContain("roads.googleapis.com/v1/snapToRoads");
      expect(url).toContain("path=32.78,-96.8|32.79,-96.81");
      expect(url).toContain("interpolate=true");
      expect(url).toContain("key=test-api-key-123");
    });

    it("returns snapped points from the API", async () => {
      const mockPoints = [
        {
          location: { latitude: 32.78, longitude: -96.8 },
          originalIndex: 0,
          placeId: "ChIJ123",
        },
      ];
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ snappedPoints: mockPoints }),
      } as Response);

      const result = await snapToRoads([{ lat: 32.78, lng: -96.8 }]);
      expect(result).toEqual(mockPoints);
    });

    it("throws on non-OK HTTP response", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: false,
        statusText: "Forbidden",
      } as Response);

      await expect(
        snapToRoads([{ lat: 32.78, lng: -96.8 }]),
      ).rejects.toThrow("SnapToRoads failed: Forbidden");
    });

    it("throws when API returns an error object", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            error: { message: "INVALID_ARGUMENT: Too many points" },
          }),
      } as Response);

      await expect(
        snapToRoads([{ lat: 32.78, lng: -96.8 }]),
      ).rejects.toThrow("Roads API error: INVALID_ARGUMENT: Too many points");
    });

    it("throws when API key is not configured", async () => {
      vi.resetModules();
      delete process.env.VITE_GOOGLE_MAPS_API_KEY;
      const mod = await import("../../../services/roadsService");
      await expect(
        mod.snapToRoads([{ lat: 32.78, lng: -96.8 }]),
      ).rejects.toThrow("Google Maps API key not configured");
    });
  });

  // --- getSpeedLimits ---
  describe("getSpeedLimits", () => {
    it("constructs the correct URL with path coordinates", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            speedLimits: [{ placeId: "abc", speedLimit: 65 }],
          }),
      } as Response);

      await getSpeedLimits([{ lat: 35.0, lng: -97.0 }]);

      const url = (globalThis.fetch as any).mock.calls[0][0] as string;
      expect(url).toContain("roads.googleapis.com/v1/speedLimits");
      expect(url).toContain("path=35,-97");
      expect(url).toContain("key=test-api-key-123");
    });

    it("returns speed limit data from the API", async () => {
      const limits = [
        { placeId: "ChIJ123", speedLimit: 65, units: "MPH" },
        { placeId: "ChIJ456", speedLimit: 55, units: "MPH" },
      ];
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ speedLimits: limits }),
      } as Response);

      const result = await getSpeedLimits([
        { lat: 35.0, lng: -97.0 },
        { lat: 35.1, lng: -97.1 },
      ]);
      expect(result).toEqual(limits);
    });

    it("throws on non-OK HTTP response", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: false,
        statusText: "Rate Limit Exceeded",
      } as Response);

      await expect(
        getSpeedLimits([{ lat: 35.0, lng: -97.0 }]),
      ).rejects.toThrow("SpeedLimits failed: Rate Limit Exceeded");
    });

    it("throws when API returns an error object", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            error: { message: "PERMISSION_DENIED" },
          }),
      } as Response);

      await expect(
        getSpeedLimits([{ lat: 35.0, lng: -97.0 }]),
      ).rejects.toThrow("Roads API error: PERMISSION_DENIED");
    });

    it("throws when API key is not configured", async () => {
      vi.resetModules();
      delete process.env.VITE_GOOGLE_MAPS_API_KEY;
      const mod = await import("../../../services/roadsService");
      await expect(
        mod.getSpeedLimits([{ lat: 35.0, lng: -97.0 }]),
      ).rejects.toThrow("Google Maps API key not configured");
    });
  });
});
