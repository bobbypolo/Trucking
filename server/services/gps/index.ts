/**
 * GPS Provider Factory for LoadPilot
 *
 * Returns a GpsProvider implementation based on the GPS_PROVIDER
 * environment variable. Defaults to Samsara.
 *
 * Usage:
 *   import { getGpsProvider } from './services/gps';
 *   const gps = getGpsProvider();
 *   const positions = await gps.getVehicleLocations('company-123');
 *
 * @see .claude/docs/PLAN.md S-203
 */

export type { GpsPosition, GpsProvider } from "./gps-provider.interface";
export { SamsaraAdapter } from "./samsara.adapter";

import type { GpsPosition, GpsProvider } from "./gps-provider.interface";
import { SamsaraAdapter } from "./samsara.adapter";

/**
 * Supported GPS provider names.
 */
const SUPPORTED_PROVIDERS = ["samsara", "webhook"] as const;

/**
 * Represents the tracking configuration state for a tenant.
 * - 'configured-live': provider configured and returning position data
 * - 'configured-idle': provider configured but returned empty positions
 * - 'not-configured': no active provider config or missing API token
 * - 'provider-error': provider configured but threw an error
 */
export type TrackingState =
  | "configured-live"
  | "configured-idle"
  | "not-configured"
  | "provider-error";

/**
 * Factory function to create a GPS provider based on env config.
 *
 * @returns A GpsProvider implementation
 * @throws Error if GPS_PROVIDER is set to an unsupported value
 */
export function getGpsProvider(): GpsProvider {
  const providerName = process.env.GPS_PROVIDER || "samsara";

  switch (providerName) {
    case "samsara":
      return new SamsaraAdapter();
    default:
      throw new Error(
        `Unknown GPS provider: "${providerName}". ` +
          `Supported providers: ${SUPPORTED_PROVIDERS.join(", ")}`,
      );
  }
}

/**
 * Result of getGpsProviderForTenant — includes the provider (or null) and
 * the tracking state so the caller can surface it to clients.
 */
export interface GpsProviderResult {
  provider: GpsProvider | null;
  state: TrackingState;
  providerName?: string;
}

/**
 * DB-backed factory: looks up the active provider config for a tenant and
 * returns the appropriate GpsProvider instance along with the tracking state.
 *
 * @param companyId - The tenant's company identifier
 * @param db        - A mysql2 pool or connection (must expose `.query()`)
 * @returns GpsProviderResult with provider (or null) and state
 */
export async function getGpsProviderForTenant(
  companyId: string,
  db: { query: (sql: string, params?: any[]) => Promise<any> },
): Promise<GpsProviderResult> {
  const [rows]: any = await db.query(
    `SELECT id, provider_name, api_token
     FROM tracking_provider_configs
     WHERE company_id = ? AND is_active = TRUE
     LIMIT 1`,
    [companyId],
  );

  if (!rows || rows.length === 0) {
    return { provider: null, state: "not-configured" };
  }

  const config = rows[0];

  if (!config.api_token) {
    return {
      provider: null,
      state: "not-configured",
      providerName: config.provider_name,
    };
  }

  switch (config.provider_name) {
    case "samsara": {
      const adapter = new SamsaraAdapterWithToken(config.api_token);
      return {
        provider: adapter,
        state: "configured-idle", // caller will promote to 'configured-live'
        providerName: config.provider_name,
      };
    }
    case "webhook":
      // Webhook providers don't poll — they receive inbound data via
      // POST /api/tracking/webhook. Return null provider but configured state
      // so the live endpoint falls through to reading stored positions.
      return {
        provider: null,
        state: "configured-idle",
        providerName: "webhook",
      };
    default:
      return { provider: null, state: "not-configured" };
  }
}

/**
 * A SamsaraAdapter variant that uses an explicit API token rather than the
 * SAMSARA_API_TOKEN environment variable. This enables per-tenant credentials
 * stored in tracking_provider_configs without mutating process.env (which
 * would be a race condition under concurrent requests).
 *
 * Internal — not exported from this module.
 */
class SamsaraAdapterWithToken extends SamsaraAdapter {
  private readonly token: string;

  constructor(token: string) {
    super();
    this.token = token;
  }

  /**
   * Overrides the parent to make a direct HTTP call with the per-tenant token.
   * Does NOT touch process.env — safe for concurrent requests.
   */
  async getVehicleLocations(companyId: string): Promise<GpsPosition[]> {
    const SAMSARA_API_BASE = "https://api.samsara.com";
    const SAMSARA_TIMEOUT_MS = 5000;

    const startTime = Date.now();
    try {
      const url = `${SAMSARA_API_BASE}/fleet/vehicles/locations`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(SAMSARA_TIMEOUT_MS),
      });

      const durationMs = Date.now() - startTime;

      if (!response.ok) {
        return [];
      }

      const body = await response.json();
      const vehicles: Array<{
        id: string;
        name: string;
        location: {
          latitude: number;
          longitude: number;
          speed: { value: number };
          heading: number;
          time: string;
        };
      }> = body.data || [];

      return vehicles.map((v) => ({
        vehicleId: v.id,
        latitude: v.location.latitude,
        longitude: v.location.longitude,
        speed: v.location.speed.value,
        heading: v.location.heading,
        recordedAt: new Date(v.location.time),
        provider: "samsara" as const,
        providerVehicleId: v.id,
      }));
    } catch {
      return [];
    }
  }
}
