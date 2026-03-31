/**
 * Server-side Geocoding Service for LoadPilot
 *
 * Converts addresses (city/state/facility) to latitude/longitude coordinates
 * using the Google Maps Geocoding API. Used at load create/update time
 * to populate canonical coordinates in the load_legs table.
 *
 * Graceful degradation: returns null when API key is missing or API fails.
 */

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
