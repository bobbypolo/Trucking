/**
 * Server-side Geocoding Service for LoadPilot
 *
 * Forward geocoding: Converts addresses (city/state/facility) to lat/lng.
 * Reverse geocoding: Converts lat/lng to 2-letter state/province codes.
 *
 * Reverse geocoding uses aggressive in-memory caching:
 *   - Coordinates rounded to a 0.05° grid (~5.5km cells)
 *   - Each unique grid cell requires one API call, then cached forever
 *   - State borders don't move, so cache never expires
 *   - A cross-country trip generates ~400 unique cells
 *   - At ~50 bytes/entry, 50,000 cells = ~2.5MB — negligible
 *
 * Environment: GOOGLE_MAPS_API_KEY (server-side only)
 * Graceful degradation: returns null when API key is missing or API fails.
 */

import { createChildLogger } from "../lib/logger";

const log = createChildLogger({ module: "geocoding.service" });

export interface GeocoordinateResult {
  latitude: number;
  longitude: number;
}

/**
 * Geocode a free-form address string to lat/lng coordinates.
 * Returns null on any failure (missing key, network error, zero results).
 */
export async function geocodeAddress(
  address: string,
): Promise<GeocoordinateResult | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return null;
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
    const response = await fetch(url, {
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    if (data.status !== "OK" || !data.results || data.results.length === 0) {
      return null;
    }

    const location = data.results[0].geometry.location;
    return {
      latitude: location.lat,
      longitude: location.lng,
    };
  } catch (error) {
    console.error("Geocoding request failed:", error);
    return null;
  }
}

/**
 * Geocode a stop's address components (facility, city, state) to coordinates.
 * Builds a combined address string from available fields.
 * Returns null if no meaningful address can be constructed.
 */
export async function geocodeStopAddress(
  city: string | null | undefined,
  state: string | null | undefined,
  facilityName?: string | null,
): Promise<GeocoordinateResult | null> {
  if (!city) {
    return null;
  }

  const parts: string[] = [];
  if (facilityName) parts.push(facilityName);
  parts.push(city);
  if (state) parts.push(state);

  const address = parts.join(", ");
  return geocodeAddress(address);
}

// ── Reverse Geocoding: lat/lng → state code ────────────────────────────────

/**
 * In-memory cache: geohash key → 2-letter state/province code (or null).
 * Keys are "${roundedLat}_${roundedLng}" where coordinates are rounded
 * to a 0.05° grid (~5.5km cells).
 */
const stateCache = new Map<string, string | null>();

/**
 * Build a geohash-style cache key from coordinates.
 * Rounds to a 0.05° grid (~5.5km cells).
 */
function stateCacheKey(lat: number, lng: number): string {
  return `${Math.round(lat * 20)}_${Math.round(lng * 20)}`;
}

/**
 * Extract the 2-letter state/province code from a Google Maps
 * Geocoding API response.
 *
 * Looks for the `administrative_area_level_1` component and returns
 * its `short_name` (e.g., "TX", "CA", "ON").
 */
function extractStateCode(
  data: {
    results?: Array<{
      address_components?: Array<{
        short_name?: string;
        types?: string[];
      }>;
    }>;
  },
): string | null {
  if (!data.results || data.results.length === 0) return null;

  for (const result of data.results) {
    if (!result.address_components) continue;
    for (const component of result.address_components) {
      if (
        component.types &&
        component.types.includes("administrative_area_level_1")
      ) {
        const code = component.short_name;
        if (code && code.length >= 2) {
          // Google Maps returns proper 2-letter codes for US/CA states
          return code.length === 2 ? code : code.substring(0, 2);
        }
      }
    }
  }

  return null;
}

/**
 * Reverse-geocode a coordinate to a 2-letter state/province code
 * using the Google Maps Geocoding API.
 *
 * Uses aggressive in-memory caching — coordinates rounded to ~5.5km
 * grid cells, cached results never expire (borders don't move).
 *
 * @returns 2-letter state code (e.g., "TX", "ON") or null if:
 *   - GOOGLE_MAPS_API_KEY is not set
 *   - API returns an error or no results
 *   - Coordinate is in the ocean or outside US/Canada
 */
export async function reverseGeocodeState(
  lat: number,
  lng: number,
): Promise<string | null> {
  // Check cache first
  const key = stateCacheKey(lat, lng);
  if (stateCache.has(key)) {
    return stateCache.get(key) ?? null;
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    log.warn("GOOGLE_MAPS_API_KEY not set — reverse state detection unavailable");
    return null;
  }

  try {
    const url =
      `https://maps.googleapis.com/maps/api/geocode/json` +
      `?latlng=${lat},${lng}` +
      `&result_type=administrative_area_level_1` +
      `&key=${apiKey}`;

    const response = await fetch(url, {
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      log.error(
        { status: response.status, lat, lng },
        "Reverse geocoding HTTP error",
      );
      return null;
    }

    const data = await response.json();

    if (data.status === "ZERO_RESULTS") {
      stateCache.set(key, null);
      return null;
    }

    if (data.status !== "OK") {
      log.error(
        { apiStatus: data.status, errorMessage: data.error_message },
        "Reverse geocoding API error",
      );
      return null;
    }

    const stateCode = extractStateCode(data);
    stateCache.set(key, stateCode);
    return stateCode;
  } catch (err: unknown) {
    const isTimeout =
      err instanceof DOMException &&
      (err.name === "AbortError" || err.name === "TimeoutError");

    if (isTimeout) {
      log.warn({ lat, lng }, "Reverse geocoding timed out");
    } else {
      log.error({ err, lat, lng }, "Reverse geocoding failed");
    }
    return null;
  }
}

/**
 * Get the current reverse-geocoding cache size (for monitoring/testing).
 */
export function getStateCacheSize(): number {
  return stateCache.size;
}

/**
 * Clear the reverse-geocoding cache (for testing).
 */
export function clearStateCache(): void {
  stateCache.clear();
}
