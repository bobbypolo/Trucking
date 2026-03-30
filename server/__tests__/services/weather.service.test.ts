import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Tests R-P2-20, R-P2-21, R-P2-22: Weather feature flag removed, API key presence check only
// Note: The old feature flag env var has been fully removed from the codebase.

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Mock logger
const mockInfo = vi.fn();
const mockWarn = vi.fn();
const mockError = vi.fn();
vi.mock("../../lib/logger", () => ({
  createChildLogger: () => ({
    info: mockInfo,
    error: mockError,
    warn: mockWarn,
    debug: vi.fn(),
  }),
  createRequestLogger: () => ({
    info: mockInfo,
    warn: mockWarn,
    error: mockError,
  }),
}));

const originalEnv = { ...process.env };

describe("S-205: Weather Service (feature flag removed)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env = { ...originalEnv };
    // Only WEATHER_API_KEY needed — old feature flag removed
    process.env.WEATHER_API_KEY = "test-weather-key";
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("R-P2-20: Weather works when WEATHER_API_KEY set (no feature flag needed)", () => {
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

    it("works without any feature flag being set", async () => {
      // No feature flag env var needed — only API key matters
      // (old feature flag env var was removed in S-205)

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

      const result = await getWeatherForLocation(41.8781, -87.6298);

      // Should work — no feature flag check
      expect(result.available).toBe(true);
      expect(result.data!.temperature).toBe(65);
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

  describe("R-P2-21: Returns { available: false, reason: no_api_key } when key not set", () => {
    it("returns no_api_key when WEATHER_API_KEY is missing", async () => {
      delete process.env.WEATHER_API_KEY;

      vi.resetModules();

      vi.doMock("../../lib/logger", () => ({
        createChildLogger: () => ({
          info: mockInfo,
          error: mockError,
          warn: mockWarn,
          debug: vi.fn(),
        }),
        createRequestLogger: () => ({
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
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("does not call the API when key is missing", async () => {
      delete process.env.WEATHER_API_KEY;

      vi.resetModules();

      vi.doMock("../../lib/logger", () => ({
        createChildLogger: () => ({
          info: mockInfo,
          error: mockError,
          warn: mockWarn,
          debug: vi.fn(),
        }),
        createRequestLogger: () => ({
          info: mockInfo,
          warn: mockWarn,
          error: mockError,
        }),
      }));

      const { getWeatherForLocation } =
        await import("../../services/weather.service");

      await getWeatherForLocation(41.8781, -87.6298);

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("R-P2-22: No reference to old feature flag remains", () => {
    it("WeatherResponse type does not include 'disabled' reason", async () => {
      const { getWeatherForLocation } =
        await import("../../services/weather.service");

      // With API key set, should get weather data (not 'disabled')
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
      expect(result.reason).toBeUndefined();
      // 'disabled' is no longer a valid reason
    });
  });

  describe("Graceful degradation (preserved behavior)", () => {
    it("returns degraded response on 5s timeout", async () => {
      const { getWeatherForLocation } =
        await import("../../services/weather.service");

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
  });

  describe("Telemetry logging (preserved behavior)", () => {
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
