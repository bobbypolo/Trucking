import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// We need to test the fetch paths of fetchWeatherData.
// The env vars are read at call-time via import.meta.env, so we can stub them.

describe("weatherService fetch paths", () => {
  let fetchWeatherData: typeof import("../../../services/weatherService").fetchWeatherData;

  beforeEach(async () => {
    vi.stubGlobal("fetch", vi.fn());
    // Dynamic import to get fresh module
    const mod = await import("../../../services/weatherService");
    fetchWeatherData = mod.fetchWeatherData;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("uses Azure Maps API when VITE_WEATHER_API_KEY is set", async () => {
    vi.stubEnv("VITE_WEATHER_API_KEY", "test-azure-key");
    vi.stubEnv("VITE_OPENWEATHER_API_KEY", "");

    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        results: [
          {
            temperature: { value: 72 },
            phrase: "Partly Cloudy",
            iconCode: "03d",
            wind: { speed: { value: 12 } },
            relativeHumidity: 65,
          },
        ],
      }),
    };
    vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse as any);

    const result = await fetchWeatherData(41.8781, -87.6298);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("atlas.microsoft.com"),
    );
    expect(result.temp).toBe(72);
    expect(result.condition).toBe("Partly Cloudy");
    expect(result.windSpeed).toBe(12);
    expect(result.humidity).toBe(65);
  });

  it("falls back to OpenWeatherMap when Azure Maps fails", async () => {
    vi.stubEnv("VITE_WEATHER_API_KEY", "test-azure-key");
    vi.stubEnv("VITE_OPENWEATHER_API_KEY", "test-openweather-key");

    const azureResponse = { ok: false, status: 401 };
    const owmResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        main: { temp: 68, humidity: 55 },
        weather: [{ description: "clear sky", icon: "01d" }],
        wind: { speed: 8 },
        name: "Chicago",
      }),
    };

    vi.mocked(globalThis.fetch)
      .mockResolvedValueOnce(azureResponse as any)
      .mockResolvedValueOnce(owmResponse as any);

    const result = await fetchWeatherData(41.8781, -87.6298);

    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    expect(result.temp).toBe(68);
    expect(result.condition).toBe("clear sky");
    expect(result.windSpeed).toBe(8);
    expect(result.humidity).toBe(55);
    expect(result.location).toBe("Chicago");
  });

  it("uses OpenWeatherMap when only that key is set", async () => {
    vi.stubEnv("VITE_WEATHER_API_KEY", "");
    vi.stubEnv("VITE_OPENWEATHER_API_KEY", "test-openweather-key");

    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        main: { temp: 75, humidity: 40 },
        weather: [{ description: "sunny", icon: "01d" }],
        wind: { speed: 5 },
        name: "Milwaukee",
      }),
    };
    vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse as any);

    const result = await fetchWeatherData(43.0389, -87.9065);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("openweathermap.org"),
    );
    expect(result.temp).toBe(75);
    expect(result.location).toBe("Milwaukee");
  });

  it("handles Azure Maps response with missing fields gracefully", async () => {
    vi.stubEnv("VITE_WEATHER_API_KEY", "test-azure-key");

    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        results: [{}],
      }),
    };
    vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse as any);

    const result = await fetchWeatherData(41.8781, -87.6298);

    // Should use defaults
    expect(result.temp).toBe(70);
    expect(result.condition).toBe("Unknown");
    expect(result.windSpeed).toBe(0);
    expect(result.humidity).toBe(50);
    expect(result.location).toBe("Current Location");
  });

  it("handles OpenWeatherMap response with missing fields gracefully", async () => {
    vi.stubEnv("VITE_WEATHER_API_KEY", "");
    vi.stubEnv("VITE_OPENWEATHER_API_KEY", "test-openweather-key");

    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({}),
    };
    vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse as any);

    const result = await fetchWeatherData(41.8781, -87.6298);

    expect(result.temp).toBe(70);
    expect(result.condition).toBe("Unknown");
    expect(result.windSpeed).toBe(0);
    expect(result.humidity).toBe(50);
    expect(result.location).toBe("Current Location");
  });

  it("falls through to error when Azure key is placeholder", async () => {
    vi.stubEnv(
      "VITE_WEATHER_API_KEY",
      "your_azure_maps_subscription_key_here",
    );
    vi.stubEnv("VITE_OPENWEATHER_API_KEY", "");

    await expect(fetchWeatherData(41.8781, -87.6298)).rejects.toThrow(
      "Weather API not configured",
    );
  });

  it("falls through to error when Azure throws and no OpenWeather key", async () => {
    vi.stubEnv("VITE_WEATHER_API_KEY", "test-azure-key");
    vi.stubEnv("VITE_OPENWEATHER_API_KEY", "");

    vi.mocked(globalThis.fetch).mockRejectedValue(new Error("Network error"));

    await expect(fetchWeatherData(41.8781, -87.6298)).rejects.toThrow(
      "Weather API not configured",
    );
  });
});
