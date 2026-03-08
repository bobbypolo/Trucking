import { describe, it, expect, vi, beforeEach } from "vitest";

// Tests R-P3-02-AC1: geocoding service populates lat/lng from address

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Clear env before importing
const originalEnv = process.env;

describe("R-P3-02: Geocoding Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  describe("AC1: geocodeAddress converts address to coordinates", () => {
    it("returns lat/lng when Google API responds successfully", async () => {
      process.env.GOOGLE_MAPS_API_KEY = "test-key";

      // Must import after env is set
      const { geocodeAddress } =
        await import("../../services/geocoding.service");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "OK",
          results: [
            {
              geometry: {
                location: { lat: 41.8781, lng: -87.6298 },
              },
              formatted_address: "Chicago, IL, USA",
            },
          ],
        }),
      });

      const result = await geocodeAddress("Chicago, IL");

      expect(result).toEqual({
        latitude: 41.8781,
        longitude: -87.6298,
      });
    });

    it("returns null when API key is missing (graceful degradation)", async () => {
      delete process.env.GOOGLE_MAPS_API_KEY;

      // Force re-import with cleared cache
      vi.resetModules();
      const { geocodeAddress } =
        await import("../../services/geocoding.service");

      const result = await geocodeAddress("Chicago, IL");

      expect(result).toBeNull();
    });

    it("returns null when geocoding fails (network error)", async () => {
      process.env.GOOGLE_MAPS_API_KEY = "test-key";

      vi.resetModules();
      const { geocodeAddress } =
        await import("../../services/geocoding.service");

      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await geocodeAddress("Nonexistent Place");

      expect(result).toBeNull();
    });

    it("returns null when API returns ZERO_RESULTS", async () => {
      process.env.GOOGLE_MAPS_API_KEY = "test-key";

      vi.resetModules();
      const { geocodeAddress } =
        await import("../../services/geocoding.service");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "ZERO_RESULTS",
          results: [],
        }),
      });

      const result = await geocodeAddress("zzzzzznonexistent");

      expect(result).toBeNull();
    });
  });

  describe("AC1: geocodeStopAddress builds address from city+state", () => {
    it("geocodes combined city/state address for a stop", async () => {
      process.env.GOOGLE_MAPS_API_KEY = "test-key";

      vi.resetModules();
      const { geocodeStopAddress } =
        await import("../../services/geocoding.service");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "OK",
          results: [
            {
              geometry: {
                location: { lat: 41.8781, lng: -87.6298 },
              },
              formatted_address: "Chicago, IL, USA",
            },
          ],
        }),
      });

      const result = await geocodeStopAddress("Chicago", "IL", "Warehouse A");

      expect(result).toEqual({
        latitude: 41.8781,
        longitude: -87.6298,
      });

      // Verify it constructed the right address query
      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain("Warehouse");
      expect(calledUrl).toContain("Chicago");
      expect(calledUrl).toContain("IL");
    });

    it("returns null when city is missing", async () => {
      process.env.GOOGLE_MAPS_API_KEY = "test-key";

      vi.resetModules();
      const { geocodeStopAddress } =
        await import("../../services/geocoding.service");

      const result = await geocodeStopAddress(null, "IL");

      expect(result).toBeNull();
    });
  });
});
