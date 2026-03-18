import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("weatherService deep coverage (lines 51-58, 75-76, 90)", () => {
  beforeEach(() => { vi.spyOn(globalThis, "fetch").mockReset(); });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

  describe("OpenWeatherMap fallback (lines 49-62)", () => {
    it("uses OpenWeatherMap when Azure key is empty", async () => {
      vi.stubEnv("VITE_WEATHER_API_KEY", "");
      vi.stubEnv("VITE_OPENWEATHER_API_KEY", "valid-key");
      vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true, json: () => Promise.resolve({ main: { temp: 72, humidity: 55 }, weather: [{ description: "clear sky", icon: "01d" }], wind: { speed: 8 }, name: "Chicago" }) } as any);
      const { fetchWeatherData } = await import("../../../services/weatherService");
      const result = await fetchWeatherData(41.8, -87.6);
      expect(result.temp).toBe(72);
      expect(result.condition).toBe("clear sky");
      expect(result.location).toBe("Chicago");
    });
    it("throws when OpenWeather returns non-ok", async () => {
      vi.stubEnv("VITE_WEATHER_API_KEY", "");
      vi.stubEnv("VITE_OPENWEATHER_API_KEY", "valid-key");
      vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: false, status: 401 } as any);
      const { fetchWeatherData } = await import("../../../services/weatherService");
      await expect(fetchWeatherData(41.8, -87.6)).rejects.toThrow("Weather API not configured");
    });
  });

  describe("Azure Maps primary (lines 34-47)", () => {
    it("uses Azure Maps when key is set", async () => {
      vi.stubEnv("VITE_WEATHER_API_KEY", "azure-key");
      vi.stubEnv("VITE_OPENWEATHER_API_KEY", "");
      vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true, json: () => Promise.resolve({ results: [{ temperature: { value: 85 }, phrase: "Sunny", iconCode: "01", wind: { speed: { value: 12 } }, relativeHumidity: 40 }] }) } as any);
      const { fetchWeatherData } = await import("../../../services/weatherService");
      const result = await fetchWeatherData(33.4, -112.0);
      expect(result.temp).toBe(85);
      expect(result.condition).toBe("Sunny");
    });
    it("falls through to OpenWeather when Azure fails", async () => {
      vi.stubEnv("VITE_WEATHER_API_KEY", "azure-key");
      vi.stubEnv("VITE_OPENWEATHER_API_KEY", "ow-key");
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({ ok: false, status: 403 } as any).mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ main: { temp: 68, humidity: 60 }, weather: [{ description: "partly cloudy", icon: "02d" }], wind: { speed: 5 }, name: "Dallas" }) } as any);
      const { fetchWeatherData } = await import("../../../services/weatherService");
      const result = await fetchWeatherData(32.7, -96.8);
      expect(result.temp).toBe(68);
      expect(result.location).toBe("Dallas");
    });
  });

  describe("parseAzureMapsWeather null fields (lines 74-83)", () => {
    it("uses fallback values for null fields", async () => {
      vi.stubEnv("VITE_WEATHER_API_KEY", "azure-key");
      vi.stubEnv("VITE_OPENWEATHER_API_KEY", "");
      vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true, json: () => Promise.resolve({ results: [{ temperature: null, phrase: null, iconCode: null, wind: null, relativeHumidity: null }] }) } as any);
      const { fetchWeatherData } = await import("../../../services/weatherService");
      const result = await fetchWeatherData(40.7, -74.0);
      expect(result.temp).toBe(70);
      expect(result.condition).toBe("Unknown");
      expect(result.windSpeed).toBe(0);
    });
  });

  describe("parseOpenWeatherData missing fields (lines 89-97)", () => {
    it("uses fallback values for missing fields", async () => {
      vi.stubEnv("VITE_WEATHER_API_KEY", "");
      vi.stubEnv("VITE_OPENWEATHER_API_KEY", "ow-key");
      vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true, json: () => Promise.resolve({ main: {}, weather: [], wind: {} }) } as any);
      const { fetchWeatherData } = await import("../../../services/weatherService");
      const result = await fetchWeatherData(34.0, -118.2);
      expect(result.temp).toBe(70);
      expect(result.condition).toBe("Unknown");
      expect(result.location).toBe("Current Location");
    });
  });

  describe("placeholder key detection", () => {
    it("treats placeholder Azure key as unconfigured", async () => {
      vi.stubEnv("VITE_WEATHER_API_KEY", "your_azure_maps_subscription_key_here");
      vi.stubEnv("VITE_OPENWEATHER_API_KEY", "");
      const { fetchWeatherData } = await import("../../../services/weatherService");
      await expect(fetchWeatherData(41.8, -87.6)).rejects.toThrow("Weather API not configured");
    });
  });
});