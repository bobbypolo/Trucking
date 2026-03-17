import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// geocodingService reads API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY at module level.
// We reset modules each test so the env is re-read.

describe("geocodingService", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.spyOn(globalThis, "fetch").mockReset();
    // Set env before dynamic import so API_KEY is captured
    (import.meta.env as any).VITE_GOOGLE_MAPS_API_KEY = "test-api-key";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── geocodeAddress ──────────────────────────────────────────────────

  describe("geocodeAddress", () => {
    it("returns lat, lng, formattedAddress on success", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            status: "OK",
            results: [
              {
                geometry: { location: { lat: 41.8781, lng: -87.6298 } },
                formatted_address: "Chicago, IL, USA",
              },
            ],
          }),
      } as any);

      const mod = await import("../../../services/geocodingService");
      const result = await mod.geocodeAddress("Chicago, IL");
      expect(result.lat).toBe(41.8781);
      expect(result.lng).toBe(-87.6298);
      expect(result.formattedAddress).toBe("Chicago, IL, USA");
    });

    it("encodes address in URL", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            status: "OK",
            results: [
              {
                geometry: { location: { lat: 0, lng: 0 } },
                formatted_address: "test",
              },
            ],
          }),
      } as any);

      const mod = await import("../../../services/geocodingService");
      await mod.geocodeAddress("123 Main St, Chicago IL");
      expect(fetchSpy.mock.calls[0][0]).toContain(
        encodeURIComponent("123 Main St, Chicago IL"),
      );
    });

    it("throws on ZERO_RESULTS", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: "ZERO_RESULTS" }),
      } as any);

      const mod = await import("../../../services/geocodingService");
      await expect(mod.geocodeAddress("xyznonexistent")).rejects.toThrow(
        "No coordinates found",
      );
    });

    it("throws on non-OK status with error message", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            status: "REQUEST_DENIED",
            error_message: "Invalid API key",
          }),
      } as any);

      const mod = await import("../../../services/geocodingService");
      await expect(mod.geocodeAddress("Chicago")).rejects.toThrow(
        "REQUEST_DENIED",
      );
    });

    it("throws on non-OK status without error message", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            status: "OVER_QUERY_LIMIT",
          }),
      } as any);

      const mod = await import("../../../services/geocodingService");
      await expect(mod.geocodeAddress("Chicago")).rejects.toThrow(
        "Unknown error",
      );
    });

    it("throws on HTTP failure", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: false,
        statusText: "Internal Server Error",
      } as any);

      const mod = await import("../../../services/geocodingService");
      await expect(mod.geocodeAddress("Chicago")).rejects.toThrow(
        "Geocoding failed",
      );
    });

    it("throws when API key is not configured", async () => {
      (import.meta.env as any).VITE_GOOGLE_MAPS_API_KEY = "";
      const mod = await import("../../../services/geocodingService");
      await expect(mod.geocodeAddress("Chicago")).rejects.toThrow(
        "API key not configured",
      );
    });
  });

  // ─── reverseGeocode ──────────────────────────────────────────────────

  describe("reverseGeocode", () => {
    it("returns formatted address on success", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            status: "OK",
            results: [
              { formatted_address: "123 Main St, Chicago, IL 60601, USA" },
            ],
          }),
      } as any);

      const mod = await import("../../../services/geocodingService");
      const result = await mod.reverseGeocode(41.8781, -87.6298);
      expect(result).toBe("123 Main St, Chicago, IL 60601, USA");
    });

    it("returns 'Unknown Location' for ZERO_RESULTS", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: "ZERO_RESULTS" }),
      } as any);

      const mod = await import("../../../services/geocodingService");
      const result = await mod.reverseGeocode(0, 0);
      expect(result).toBe("Unknown Location");
    });

    it("throws on non-OK API status", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: "REQUEST_DENIED" }),
      } as any);

      const mod = await import("../../../services/geocodingService");
      await expect(mod.reverseGeocode(41.8, -87.6)).rejects.toThrow(
        "REQUEST_DENIED",
      );
    });

    it("throws on HTTP failure", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: false,
        statusText: "Bad Gateway",
      } as any);

      const mod = await import("../../../services/geocodingService");
      await expect(mod.reverseGeocode(41.8, -87.6)).rejects.toThrow(
        "Reverse geocoding failed",
      );
    });

    it("includes lat,lng in fetch URL", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            status: "OK",
            results: [{ formatted_address: "test" }],
          }),
      } as any);

      const mod = await import("../../../services/geocodingService");
      await mod.reverseGeocode(41.123, -87.456);
      expect(fetchSpy.mock.calls[0][0]).toContain("41.123,-87.456");
    });

    it("throws when API key is not configured", async () => {
      (import.meta.env as any).VITE_GOOGLE_MAPS_API_KEY = "";
      const mod = await import("../../../services/geocodingService");
      await expect(mod.reverseGeocode(41.8, -87.6)).rejects.toThrow(
        "API key not configured",
      );
    });
  });
});
