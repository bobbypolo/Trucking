import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import {
  fetchWeatherData,
  getWeatherIconName,
  formatTemperature,
  getWeatherAlertLevel,
} from "../../../services/weatherService";
import type { WeatherData } from "../../../services/weatherService";

describe("weatherService", () => {
  beforeEach(() => {
    vi.spyOn(globalThis, "fetch").mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── getWeatherIconName ──────────────────────────────────────────────
  describe("getWeatherIconName", () => {
    it("returns rain for rain conditions", () => {
      expect(getWeatherIconName("Light Rain")).toBe("rain");
      expect(getWeatherIconName("Heavy Drizzle")).toBe("rain");
    });

    it("returns snow for snow/sleet conditions", () => {
      expect(getWeatherIconName("Snow Shower")).toBe("snow");
      expect(getWeatherIconName("Freezing Sleet")).toBe("snow");
    });

    it("returns sunny for clear/sunny conditions", () => {
      expect(getWeatherIconName("Clear skies")).toBe("sunny");
      expect(getWeatherIconName("Sunny and warm")).toBe("sunny");
    });

    it("returns cloudy for cloud conditions", () => {
      expect(getWeatherIconName("Partly Cloudy")).toBe("cloudy");
      expect(getWeatherIconName("Overcast clouds")).toBe("cloudy");
    });

    it("returns storm for thunder/storm conditions", () => {
      expect(getWeatherIconName("Thunderstorm")).toBe("storm");
      expect(getWeatherIconName("Severe Storm Warning")).toBe("storm");
    });

    it("returns fog for fog/mist conditions", () => {
      expect(getWeatherIconName("Dense Fog")).toBe("fog");
      expect(getWeatherIconName("Morning Mist")).toBe("fog");
    });

    it("returns partly-cloudy as default", () => {
      expect(getWeatherIconName("Unknown")).toBe("partly-cloudy");
      expect(getWeatherIconName("Hazy")).toBe("partly-cloudy");
    });

    it("is case-insensitive", () => {
      expect(getWeatherIconName("RAIN")).toBe("rain");
      expect(getWeatherIconName("SNOW")).toBe("snow");
    });
  });

  // ─── formatTemperature ───────────────────────────────────────────────
  describe("formatTemperature", () => {
    it("formats temperature in Fahrenheit by default", () => {
      expect(formatTemperature(72)).toBe("72\u00B0F");
    });

    it("formats temperature in Celsius", () => {
      expect(formatTemperature(22, "C")).toBe("22\u00B0C");
    });

    it("rounds decimal temperatures", () => {
      expect(formatTemperature(72.7)).toBe("73\u00B0F");
      expect(formatTemperature(72.3)).toBe("72\u00B0F");
    });

    it("handles negative temperatures", () => {
      expect(formatTemperature(-10)).toBe("-10\u00B0F");
      expect(formatTemperature(-5, "C")).toBe("-5\u00B0C");
    });

    it("handles zero", () => {
      expect(formatTemperature(0)).toBe("0\u00B0F");
    });
  });

  // ─── getWeatherAlertLevel ────────────────────────────────────────────
  describe("getWeatherAlertLevel", () => {
    it("returns severe for tornado/hurricane/severe", () => {
      expect(
        getWeatherAlertLevel({
          condition: "Severe Thunderstorm Warning",
          windSpeed: 10,
        } as WeatherData),
      ).toBe("severe");
      expect(
        getWeatherAlertLevel({
          condition: "Tornado Warning",
          windSpeed: 5,
        } as WeatherData),
      ).toBe("severe");
      expect(
        getWeatherAlertLevel({
          condition: "Hurricane Force Winds",
          windSpeed: 50,
        } as WeatherData),
      ).toBe("severe");
    });

    it("returns warning for thunderstorm, heavy conditions, or wind > 30", () => {
      expect(
        getWeatherAlertLevel({
          condition: "Thunderstorm",
          windSpeed: 15,
        } as WeatherData),
      ).toBe("warning");
      expect(
        getWeatherAlertLevel({
          condition: "Heavy Rain",
          windSpeed: 10,
        } as WeatherData),
      ).toBe("warning");
      expect(
        getWeatherAlertLevel({
          condition: "Clear",
          windSpeed: 35,
        } as WeatherData),
      ).toBe("warning");
    });

    it("returns caution for rain, snow, or wind > 20", () => {
      expect(
        getWeatherAlertLevel({
          condition: "Light Rain",
          windSpeed: 10,
        } as WeatherData),
      ).toBe("caution");
      expect(
        getWeatherAlertLevel({
          condition: "Snow Shower",
          windSpeed: 5,
        } as WeatherData),
      ).toBe("caution");
      expect(
        getWeatherAlertLevel({
          condition: "Clear",
          windSpeed: 25,
        } as WeatherData),
      ).toBe("caution");
    });

    it("returns none for mild conditions", () => {
      expect(
        getWeatherAlertLevel({
          condition: "Clear",
          windSpeed: 5,
        } as WeatherData),
      ).toBe("none");
      expect(
        getWeatherAlertLevel({
          condition: "Partly Cloudy",
          windSpeed: 10,
        } as WeatherData),
      ).toBe("none");
    });
  });

  // ─── fetchWeatherData ────────────────────────────────────────────────
  describe("fetchWeatherData", () => {
    it("throws when no API keys are configured", async () => {
      // In test env, import.meta.env keys will be undefined
      await expect(fetchWeatherData(41.8781, -87.6298)).rejects.toThrow(
        "Weather API not configured",
      );
    });
  });
});
