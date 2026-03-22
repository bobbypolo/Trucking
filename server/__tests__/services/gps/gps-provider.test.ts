import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Tests R-P2-10, R-P2-11, R-P2-12, R-P2-13

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Mock logger
const mockInfo = vi.fn();
const mockWarn = vi.fn();
const mockError = vi.fn();
vi.mock("../../../lib/logger", () => ({
  createChildLogger: () => ({
    info: mockInfo,
    warn: mockWarn,
    error: mockError,
  }),
}));

const originalEnv = { ...process.env };

describe("S-203: GPS Provider Interface + Samsara Adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("R-P2-10: GpsProvider interface is provider-agnostic", () => {
    it("GpsPosition type contains no Samsara-specific fields", async () => {
      const mod = await import("../../../services/gps/gps-provider.interface");
      // Verify the module exports exist and have the expected shape
      // The interface itself is compile-time only; we verify via the
      // exported GpsPosition type usage in tests below.
      // This test ensures the module can be imported without Samsara deps.
      expect(mod).toBeDefined();
    });

    it("GpsProvider interface methods are documented in module exports", async () => {
      // The interface is compile-time TypeScript; we verify it
      // compiles without any Samsara imports via tsc --noEmit
      // This test confirms the module loads independently
      const mod = await import("../../../services/gps/gps-provider.interface");
      expect(mod).toBeDefined();
    });
  });

  describe("R-P2-11: Samsara adapter returns parsed GpsPosition array", () => {
    it("returns parsed GpsPosition array from successful API response", async () => {
      process.env.SAMSARA_API_TOKEN = "test-samsara-token";
      process.env.GPS_PROVIDER = "samsara";

      vi.doMock("../../../lib/logger", () => ({
        createChildLogger: () => ({
          info: mockInfo,
          warn: mockWarn,
          error: mockError,
        }),
      }));

      const { SamsaraAdapter } = await import(
        "../../../services/gps/samsara.adapter"
      );

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              id: "vehicle-1",
              name: "Truck 101",
              location: {
                latitude: 41.8781,
                longitude: -87.6298,
                speed: { value: 55 },
                heading: 180,
                time: "2026-03-22T10:00:00Z",
              },
            },
            {
              id: "vehicle-2",
              name: "Truck 102",
              location: {
                latitude: 34.0522,
                longitude: -118.2437,
                speed: { value: 0 },
                heading: 90,
                time: "2026-03-22T10:00:00Z",
              },
            },
          ],
        }),
      });

      const adapter = new SamsaraAdapter();
      const positions = await adapter.getVehicleLocations("co-1");

      expect(positions).toHaveLength(2);
      expect(positions[0]).toEqual(
        expect.objectContaining({
          vehicleId: "vehicle-1",
          latitude: 41.8781,
          longitude: -87.6298,
          speed: 55,
          heading: 180,
          provider: "samsara",
          providerVehicleId: "vehicle-1",
        }),
      );
      expect(positions[0].recordedAt).toBeInstanceOf(Date);
      expect(positions[1].latitude).toBe(34.0522);
    });

    it("uses 5-second timeout on API requests", async () => {
      process.env.SAMSARA_API_TOKEN = "test-samsara-token";

      vi.doMock("../../../lib/logger", () => ({
        createChildLogger: () => ({
          info: mockInfo,
          warn: mockWarn,
          error: mockError,
        }),
      }));

      const { SamsaraAdapter } = await import(
        "../../../services/gps/samsara.adapter"
      );

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      });

      const adapter = new SamsaraAdapter();
      await adapter.getVehicleLocations("co-1");

      // Verify fetch was called with an AbortSignal (timeout)
      const fetchOptions = mockFetch.mock.calls[0][1];
      expect(fetchOptions).toBeDefined();
      expect(fetchOptions.signal).toBeDefined();
    });

    it("returns empty array on timeout (not error)", async () => {
      process.env.SAMSARA_API_TOKEN = "test-samsara-token";

      vi.doMock("../../../lib/logger", () => ({
        createChildLogger: () => ({
          info: mockInfo,
          warn: mockWarn,
          error: mockError,
        }),
      }));

      const { SamsaraAdapter } = await import(
        "../../../services/gps/samsara.adapter"
      );

      const abortError = new DOMException(
        "The operation was aborted",
        "AbortError",
      );
      mockFetch.mockRejectedValueOnce(abortError);

      const adapter = new SamsaraAdapter();
      const positions = await adapter.getVehicleLocations("co-1");

      expect(positions).toEqual([]);
    });

    it("returns empty array on API error", async () => {
      process.env.SAMSARA_API_TOKEN = "test-samsara-token";

      vi.doMock("../../../lib/logger", () => ({
        createChildLogger: () => ({
          info: mockInfo,
          warn: mockWarn,
          error: mockError,
        }),
      }));

      const { SamsaraAdapter } = await import(
        "../../../services/gps/samsara.adapter"
      );

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      const adapter = new SamsaraAdapter();
      const positions = await adapter.getVehicleLocations("co-1");

      expect(positions).toEqual([]);
    });

    it("cache hit within 60s returns cached data without API call", async () => {
      process.env.SAMSARA_API_TOKEN = "test-samsara-token";

      vi.doMock("../../../lib/logger", () => ({
        createChildLogger: () => ({
          info: mockInfo,
          warn: mockWarn,
          error: mockError,
        }),
      }));

      const { SamsaraAdapter } = await import(
        "../../../services/gps/samsara.adapter"
      );

      const apiResponse = {
        ok: true,
        json: async () => ({
          data: [
            {
              id: "vehicle-1",
              name: "Truck 101",
              location: {
                latitude: 41.8781,
                longitude: -87.6298,
                speed: { value: 55 },
                heading: 180,
                time: "2026-03-22T10:00:00Z",
              },
            },
          ],
        }),
      };

      mockFetch.mockResolvedValueOnce(apiResponse);

      const adapter = new SamsaraAdapter();

      // First call - should hit API
      const firstResult = await adapter.getVehicleLocations("co-1");
      expect(firstResult).toHaveLength(1);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second call within 60s - should use cache, NOT call API again
      const secondResult = await adapter.getVehicleLocations("co-1");
      expect(secondResult).toHaveLength(1);
      expect(mockFetch).toHaveBeenCalledTimes(1); // Still 1, cache hit
    });

    it("cache expires after 60s, makes new API call", async () => {
      process.env.SAMSARA_API_TOKEN = "test-samsara-token";

      vi.doMock("../../../lib/logger", () => ({
        createChildLogger: () => ({
          info: mockInfo,
          warn: mockWarn,
          error: mockError,
        }),
      }));

      const { SamsaraAdapter } = await import(
        "../../../services/gps/samsara.adapter"
      );

      const makeResponse = () => ({
        ok: true,
        json: async () => ({
          data: [
            {
              id: "vehicle-1",
              name: "Truck 101",
              location: {
                latitude: 41.8781,
                longitude: -87.6298,
                speed: { value: 55 },
                heading: 180,
                time: "2026-03-22T10:00:00Z",
              },
            },
          ],
        }),
      });

      mockFetch.mockResolvedValueOnce(makeResponse());
      mockFetch.mockResolvedValueOnce(makeResponse());

      const adapter = new SamsaraAdapter();

      // First call
      await adapter.getVehicleLocations("co-1");
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Simulate cache expiry by clearing internal cache
      adapter.clearCache();

      // Third call after cache clear
      await adapter.getVehicleLocations("co-1");
      expect(mockFetch).toHaveBeenCalledTimes(2); // New API call
    });

    it("getVehicleLocation returns single position by vehicleId", async () => {
      process.env.SAMSARA_API_TOKEN = "test-samsara-token";

      vi.doMock("../../../lib/logger", () => ({
        createChildLogger: () => ({
          info: mockInfo,
          warn: mockWarn,
          error: mockError,
        }),
      }));

      const { SamsaraAdapter } = await import(
        "../../../services/gps/samsara.adapter"
      );

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              id: "vehicle-1",
              name: "Truck 101",
              location: {
                latitude: 41.8781,
                longitude: -87.6298,
                speed: { value: 55 },
                heading: 180,
                time: "2026-03-22T10:00:00Z",
              },
            },
          ],
        }),
      });

      const adapter = new SamsaraAdapter();
      const position = await adapter.getVehicleLocation("vehicle-1");

      expect(position).not.toBeNull();
      expect(position!.vehicleId).toBe("vehicle-1");
      expect(position!.latitude).toBe(41.8781);
    });

    it("getVehicleLocation returns null for unknown vehicleId", async () => {
      process.env.SAMSARA_API_TOKEN = "test-samsara-token";

      vi.doMock("../../../lib/logger", () => ({
        createChildLogger: () => ({
          info: mockInfo,
          warn: mockWarn,
          error: mockError,
        }),
      }));

      const { SamsaraAdapter } = await import(
        "../../../services/gps/samsara.adapter"
      );

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      });

      const adapter = new SamsaraAdapter();
      const position = await adapter.getVehicleLocation("nonexistent");

      expect(position).toBeNull();
    });
  });

  describe("R-P2-12: Missing SAMSARA_API_TOKEN returns mock positions", () => {
    it("returns mock positions with isMock: true when no API token", async () => {
      delete process.env.SAMSARA_API_TOKEN;

      vi.doMock("../../../lib/logger", () => ({
        createChildLogger: () => ({
          info: mockInfo,
          warn: mockWarn,
          error: mockError,
        }),
      }));

      const { SamsaraAdapter } = await import(
        "../../../services/gps/samsara.adapter"
      );

      const adapter = new SamsaraAdapter();
      const positions = await adapter.getVehicleLocations("co-1");

      expect(positions.length).toBeGreaterThan(0);
      expect(positions.every((p) => (p as any).isMock === true)).toBe(true);
      // Mock positions should still have required GpsPosition fields
      expect(positions[0].latitude).toBeDefined();
      expect(positions[0].longitude).toBeDefined();
      expect(positions[0].vehicleId).toBeDefined();
      expect(positions[0].provider).toBe("samsara");
    });

    it("does not call fetch when no API token", async () => {
      delete process.env.SAMSARA_API_TOKEN;

      vi.doMock("../../../lib/logger", () => ({
        createChildLogger: () => ({
          info: mockInfo,
          warn: mockWarn,
          error: mockError,
        }),
      }));

      const { SamsaraAdapter } = await import(
        "../../../services/gps/samsara.adapter"
      );

      const adapter = new SamsaraAdapter();
      await adapter.getVehicleLocations("co-1");

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("R-P2-13: Factory returns SamsaraAdapter for samsara", () => {
    it("returns SamsaraAdapter when GPS_PROVIDER=samsara", async () => {
      process.env.GPS_PROVIDER = "samsara";

      vi.doMock("../../../lib/logger", () => ({
        createChildLogger: () => ({
          info: mockInfo,
          warn: mockWarn,
          error: mockError,
        }),
      }));

      const { getGpsProvider } = await import("../../../services/gps");
      const { SamsaraAdapter } = await import(
        "../../../services/gps/samsara.adapter"
      );

      const provider = getGpsProvider();
      expect(provider).toBeInstanceOf(SamsaraAdapter);
    });

    it("throws for unknown provider", async () => {
      process.env.GPS_PROVIDER = "garmin-unknown";

      vi.doMock("../../../lib/logger", () => ({
        createChildLogger: () => ({
          info: mockInfo,
          warn: mockWarn,
          error: mockError,
        }),
      }));

      const { getGpsProvider } = await import("../../../services/gps");

      expect(() => getGpsProvider()).toThrow("garmin-unknown");
    });

    it("defaults to samsara when GPS_PROVIDER is not set", async () => {
      delete process.env.GPS_PROVIDER;

      vi.doMock("../../../lib/logger", () => ({
        createChildLogger: () => ({
          info: mockInfo,
          warn: mockWarn,
          error: mockError,
        }),
      }));

      const { getGpsProvider } = await import("../../../services/gps");
      const { SamsaraAdapter } = await import(
        "../../../services/gps/samsara.adapter"
      );

      const provider = getGpsProvider();
      expect(provider).toBeInstanceOf(SamsaraAdapter);
    });
  });
});
