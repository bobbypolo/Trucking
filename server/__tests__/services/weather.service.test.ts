import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Tests R-P3-03-AC1: Weather requests have 5s timeout; failures return degraded response not 500; behind feature flag; telemetry logged

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Mock logger
const mockInfo = vi.fn();
const mockWarn = vi.fn();
const mockError = vi.fn();
vi.mock("../../lib/logger", () => ({
  createChildLogger: () => ({
    info: mockInfo,
    warn: mockWarn,
    error: mockError,
  }),
}));

const originalEnv = { ...process.env };

describe("R-P3-03: Weather Service with Timeouts and Fallbacks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env = { ...originalEnv };
    // Default: feature flag enabled, API key present
    process.env.WEATHER_API_KEY = "test-weather-key";
    process.env.WEATHER_ENABLED = "true";
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("AC1: Successful weather response", () => {
    it("returns weather data when Azure Maps API responds successfully", async () => {
      const { getWeatherForLocation } =
        await import("../../services/weather.service");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              temperature: { value: 72 },
              phrase: "Partly Cloudy",
              wind: { speed: { value: 10 } },
              hasPrecipitation: false,
            },
          ],
        }),
      });

      const result = await getWeatherForLocation(41.8781, -87.6298);

      expect(result.available).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.temperature).toBe(72);
      expect(result.data!.description).toBe("Partly Cloudy");
      expect(result.data!.windSpeed).toBe(10);
      expect(result.data!.hasPrecipitation).toBe(false);
    });

    it("passes correct coordinates and API key in the URL", async () => {
      const { getWeatherForLocation } =
        await import("../../services/weather.service");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              temperature: { value: 65 },
              phrase: "Clear",
              wind: { speed: { value: 5 } },
              hasPrecipitation: false,
            },
          ],
        }),
      });

      await getWeatherForLocation(41.8781, -87.6298);

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain("41.8781");
      expect(calledUrl).toContain("-87.6298");
      expect(calledUrl).toContain("test-weather-key");
    });
  });

  describe("AC1: 5-second timeout", () => {
    it("returns degraded response when request exceeds 5s timeout", async () => {
      const { getWeatherForLocation } =
        await import("../../services/weather.service");

      // Simulate AbortError (what happens when AbortSignal.timeout fires)
      const abortError = new DOMException(
        "The operation was aborted",
        "AbortError",
      );
      mockFetch.mockRejectedValueOnce(abortError);

      const result = await getWeatherForLocation(41.8781, -87.6298);

      expect(result.available).toBe(false);
      expect(result.reason).toBe("timeout");
      expect(result.data).toBeUndefined();
    });
  });

  describe("AC1: Failure returns degraded response, not 500", () => {
    it("returns degraded response on network error", async () => {
      const { getWeatherForLocation } =
        await import("../../services/weather.service");

      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await getWeatherForLocation(41.8781, -87.6298);

      expect(result.available).toBe(false);
      expect(result.reason).toBe("api_error");
      expect(result.data).toBeUndefined();
    });

    it("returns degraded response when API returns non-OK status", async () => {
      const { getWeatherForLocation } =
        await import("../../services/weather.service");

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: "Service Unavailable",
      });

      const result = await getWeatherForLocation(41.8781, -87.6298);

      expect(result.available).toBe(false);
      expect(result.reason).toBe("api_error");
    });

    it("returns degraded response when API returns empty results", async () => {
      const { getWeatherForLocation } =
        await import("../../services/weather.service");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [] }),
      });

      const result = await getWeatherForLocation(41.8781, -87.6298);

      expect(result.available).toBe(false);
      expect(result.reason).toBe("no_data");
    });

    it("returns degraded response when API key is missing", async () => {
      delete process.env.WEATHER_API_KEY;

      vi.resetModules();

      // Re-mock logger after resetModules
      vi.doMock("../../lib/logger", () => ({
        createChildLogger: () => ({
          info: mockInfo,
          warn: mockWarn,
          error: mockError,
        }),
      }));

      const { getWeatherForLocation } =
        await import("../../services/weather.service");

      const result = await getWeatherForLocation(41.8781, -87.6298);

      expect(result.available).toBe(false);
      expect(result.reason).toBe("no_api_key");
    });
  });

  describe("AC1: Feature flag", () => {
    it("returns degraded response when feature flag is disabled", async () => {
      process.env.WEATHER_ENABLED = "false";

      vi.resetModules();

      vi.doMock("../../lib/logger", () => ({
        createChildLogger: () => ({
          info: mockInfo,
          warn: mockWarn,
          error: mockError,
        }),
      }));

      const { getWeatherForLocation } =
        await import("../../services/weather.service");

      const result = await getWeatherForLocation(41.8781, -87.6298);

      expect(result.available).toBe(false);
      expect(result.reason).toBe("disabled");
    });

    it("processes requests when feature flag is enabled", async () => {
      process.env.WEATHER_ENABLED = "true";

      const { getWeatherForLocation } =
        await import("../../services/weather.service");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              temperature: { value: 70 },
              phrase: "Sunny",
              wind: { speed: { value: 3 } },
              hasPrecipitation: false,
            },
          ],
        }),
      });

      const result = await getWeatherForLocation(41.8781, -87.6298);

      expect(result.available).toBe(true);
    });

    it("defaults to disabled when WEATHER_ENABLED is not set", async () => {
      delete process.env.WEATHER_ENABLED;

      vi.resetModules();

      vi.doMock("../../lib/logger", () => ({
        createChildLogger: () => ({
          info: mockInfo,
          warn: mockWarn,
          error: mockError,
        }),
      }));

      const { getWeatherForLocation } =
        await import("../../services/weather.service");

      const result = await getWeatherForLocation(41.8781, -87.6298);

      expect(result.available).toBe(false);
      expect(result.reason).toBe("disabled");
    });
  });

  describe("AC1: Telemetry logging", () => {
    it("logs successful weather requests with duration", async () => {
      const { getWeatherForLocation } =
        await import("../../services/weather.service");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              temperature: { value: 65 },
              phrase: "Clear",
              wind: { speed: { value: 5 } },
              hasPrecipitation: false,
            },
          ],
        }),
      });

      await getWeatherForLocation(41.8781, -87.6298);

      // Check that info was called with telemetry data
      expect(mockInfo).toHaveBeenCalled();
      const logCall = mockInfo.mock.calls.find(
        (call: unknown[]) =>
          typeof call[1] === "string" && call[1].includes("Weather"),
      );
      expect(logCall).toBeDefined();
    });

    it("logs timeout events", async () => {
      const { getWeatherForLocation } =
        await import("../../services/weather.service");

      const abortError = new DOMException(
        "The operation was aborted",
        "AbortError",
      );
      mockFetch.mockRejectedValueOnce(abortError);

      await getWeatherForLocation(41.8781, -87.6298);

      expect(mockWarn).toHaveBeenCalled();
    });

    it("logs API failure events", async () => {
      const { getWeatherForLocation } =
        await import("../../services/weather.service");

      mockFetch.mockRejectedValueOnce(new Error("Connection refused"));

      await getWeatherForLocation(41.8781, -87.6298);

      expect(mockError).toHaveBeenCalled();
    });
  });
});
