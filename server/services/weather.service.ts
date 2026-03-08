/**
 * Weather Service for LoadPilot
 *
 * Fetches current weather conditions from Azure Maps Weather API
 * for route/stop locations. Used to display weather alerts on
 * dispatch and tracking views.
 *
 * Features:
 * - 5-second timeout on all API requests
 * - Graceful degradation: failures return { available: false } not 500
 * - Feature flag: WEATHER_ENABLED env var (defaults to disabled)
 * - Telemetry: logs request duration, success/failure, timeout events
 *
 * @see .claude/docs/PLAN.md R-P3-03
 */

import { createChildLogger } from "../lib/logger";

const log = createChildLogger({ service: "weather" });

const WEATHER_TIMEOUT_MS = 5000;
const AZURE_MAPS_BASE_URL =
  "https://atlas.microsoft.com/weather/currentConditions/json";

/**
 * Weather data returned on successful API call.
 */
export interface WeatherData {
  temperature: number;
  description: string;
  windSpeed: number;
  hasPrecipitation: boolean;
}

/**
 * Degraded response shape: always returned, never throws.
 * When available=true, data is populated.
 * When available=false, reason explains why.
 */
export interface WeatherResponse {
  available: boolean;
  reason?: "timeout" | "api_error" | "no_data" | "no_api_key" | "disabled";
  data?: WeatherData;
}

/**
 * Check if the weather feature flag is enabled.
 * Defaults to disabled when WEATHER_ENABLED is not set.
 */
function isWeatherEnabled(): boolean {
  return process.env.WEATHER_ENABLED === "true";
}

/**
 * Fetch current weather conditions for a given latitude/longitude.
 *
 * Never throws — always returns a WeatherResponse.
 * On any failure (timeout, network, missing key, disabled),
 * returns { available: false, reason: "..." }.
 */
export async function getWeatherForLocation(
  latitude: number,
  longitude: number,
): Promise<WeatherResponse> {
  const startTime = Date.now();

  // Check feature flag first
  if (!isWeatherEnabled()) {
    log.info(
      { latitude, longitude, enabled: false },
      "Weather request skipped: feature disabled",
    );
    return { available: false, reason: "disabled" };
  }

  // Check API key
  const apiKey = process.env.WEATHER_API_KEY;
  if (!apiKey) {
    log.warn(
      { latitude, longitude },
      "Weather request skipped: no API key configured",
    );
    return { available: false, reason: "no_api_key" };
  }

  try {
    const url = `${AZURE_MAPS_BASE_URL}?api-version=1.1&query=${latitude},${longitude}&subscription-key=${apiKey}`;

    const response = await fetch(url, {
      signal: AbortSignal.timeout(WEATHER_TIMEOUT_MS),
    });

    const durationMs = Date.now() - startTime;

    if (!response.ok) {
      log.error(
        {
          latitude,
          longitude,
          status: response.status,
          durationMs,
        },
        "Weather API returned non-OK status",
      );
      return { available: false, reason: "api_error" };
    }

    const data = await response.json();

    if (!data.results || data.results.length === 0) {
      log.warn(
        { latitude, longitude, durationMs },
        "Weather API returned no results",
      );
      return { available: false, reason: "no_data" };
    }

    const current = data.results[0];
    const weatherData: WeatherData = {
      temperature: current.temperature.value,
      description: current.phrase,
      windSpeed: current.wind.speed.value,
      hasPrecipitation: current.hasPrecipitation,
    };

    log.info(
      {
        latitude,
        longitude,
        durationMs,
        success: true,
        temperature: weatherData.temperature,
      },
      "Weather request completed successfully",
    );

    return { available: true, data: weatherData };
  } catch (err: unknown) {
    const durationMs = Date.now() - startTime;

    // Detect timeout (AbortSignal.timeout throws DOMException with name "AbortError"
    // or in Node.js may throw with name "TimeoutError")
    if (
      err instanceof DOMException &&
      (err.name === "AbortError" || err.name === "TimeoutError")
    ) {
      log.warn(
        {
          latitude,
          longitude,
          durationMs,
          timeoutMs: WEATHER_TIMEOUT_MS,
        },
        "Weather request timed out",
      );
      return { available: false, reason: "timeout" };
    }

    log.error(
      {
        latitude,
        longitude,
        durationMs,
        error: err instanceof Error ? err.message : String(err),
      },
      "Weather request failed",
    );
    return { available: false, reason: "api_error" };
  }
}
