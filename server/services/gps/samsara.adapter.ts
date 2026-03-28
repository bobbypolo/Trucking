/**
 * Samsara GPS Adapter for LoadPilot
 *
 * Implements GpsProvider interface by calling Samsara Fleet API.
 * - 5-second timeout on all requests
 * - 60-second in-memory cache per company
 * - Returns empty positions when SAMSARA_API_TOKEN is not configured
 *
 * @see https://developers.samsara.com/reference/listvehiclelocations
 * @see .claude/docs/PLAN.md S-203
 */

import { createChildLogger } from "../../lib/logger";
import type { GpsPosition, GpsProvider } from "./gps-provider.interface";

const log = createChildLogger({ service: "gps-samsara" });

const SAMSARA_API_BASE = "https://api.samsara.com";
const SAMSARA_TIMEOUT_MS = 5000;
const CACHE_TTL_MS = 60000; // 60 seconds

interface CacheEntry {
  data: GpsPosition[];
  expiresAt: number;
}

/**
 * Raw Samsara API vehicle location shape.
 * Internal to this adapter — not exported.
 */
interface SamsaraVehicleLocation {
  id: string;
  name: string;
  location: {
    latitude: number;
    longitude: number;
    speed: { value: number };
    heading: number;
    time: string;
  };
}

/**
 * Parse a Samsara API vehicle location into a GpsPosition.
 */
function parseSamsaraLocation(
  vehicle: SamsaraVehicleLocation,
): GpsPosition {
  return {
    vehicleId: vehicle.id,
    latitude: vehicle.location.latitude,
    longitude: vehicle.location.longitude,
    speed: vehicle.location.speed.value,
    heading: vehicle.location.heading,
    recordedAt: new Date(vehicle.location.time),
    provider: "samsara",
    providerVehicleId: vehicle.id,
  };
}

/**
 * Samsara GPS adapter.
 *
 * Calls the Samsara Fleet API to retrieve vehicle locations.
 * Returns empty positions when SAMSARA_API_TOKEN is not set.
 */
export class SamsaraAdapter implements GpsProvider {
  private cache: Map<string, CacheEntry> = new Map();

  /**
   * Get current locations for all vehicles in a company.
   *
   * @param companyId - LoadPilot company identifier
   * @returns Array of GPS positions (empty on error/timeout/no credentials)
   */
  async getVehicleLocations(companyId: string): Promise<GpsPosition[]> {
    const apiToken = process.env.SAMSARA_API_TOKEN;

    // No API token — return empty (no mock data)
    if (!apiToken) {
      log.info(
        { companyId },
        "SAMSARA_API_TOKEN not set, returning empty positions",
      );
      return [];
    }

    // Check cache
    const cacheKey = `locations:${companyId}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      log.info(
        { companyId, cacheHit: true },
        "Returning cached GPS positions",
      );
      return cached.data;
    }

    // Call Samsara API
    const startTime = Date.now();
    try {
      const url = `${SAMSARA_API_BASE}/fleet/vehicles/locations`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(SAMSARA_TIMEOUT_MS),
      });

      const durationMs = Date.now() - startTime;

      if (!response.ok) {
        log.error(
          { companyId, status: response.status, durationMs },
          "Samsara API returned non-OK status",
        );
        return [];
      }

      const body = await response.json();
      const vehicles: SamsaraVehicleLocation[] = body.data || [];
      const positions = vehicles.map(parseSamsaraLocation);

      // Cache the result
      this.cache.set(cacheKey, {
        data: positions,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });

      log.info(
        { companyId, vehicleCount: positions.length, durationMs },
        "Samsara GPS positions fetched successfully",
      );

      return positions;
    } catch (err: unknown) {
      const durationMs = Date.now() - startTime;

      if (
        err instanceof DOMException &&
        (err.name === "AbortError" || err.name === "TimeoutError")
      ) {
        log.warn(
          { companyId, durationMs, timeoutMs: SAMSARA_TIMEOUT_MS },
          "Samsara GPS request timed out",
        );
        return [];
      }

      log.error(
        {
          companyId,
          durationMs,
          error: err instanceof Error ? err.message : String(err),
        },
        "Samsara GPS request failed",
      );
      return [];
    }
  }

  /**
   * Get current location for a single vehicle.
   *
   * @param vehicleId - The Samsara vehicle identifier
   * @returns GPS position or null if not found
   */
  async getVehicleLocation(
    vehicleId: string,
  ): Promise<GpsPosition | null> {
    const apiToken = process.env.SAMSARA_API_TOKEN;

    if (!apiToken) {
      log.info(
        { vehicleId },
        "SAMSARA_API_TOKEN not set, returning null for single vehicle",
      );
      return null;
    }

    const startTime = Date.now();
    try {
      const url = `${SAMSARA_API_BASE}/fleet/vehicles/${vehicleId}/locations`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(SAMSARA_TIMEOUT_MS),
      });

      const durationMs = Date.now() - startTime;

      if (!response.ok) {
        log.error(
          { vehicleId, status: response.status, durationMs },
          "Samsara single vehicle location request failed",
        );
        return null;
      }

      const body = await response.json();
      const vehicles: SamsaraVehicleLocation[] = body.data || [];
      if (vehicles.length === 0) {
        return null;
      }

      return parseSamsaraLocation(vehicles[0]);
    } catch (err: unknown) {
      const durationMs = Date.now() - startTime;
      log.warn(
        {
          vehicleId,
          durationMs,
          error: err instanceof Error ? err.message : String(err),
        },
        "Samsara single vehicle location request failed",
      );
      return null;
    }
  }

  /**
   * Clear the internal position cache.
   * Primarily for testing — forces next call to hit the API.
   */
  clearCache(): void {
    this.cache.clear();
  }
}
