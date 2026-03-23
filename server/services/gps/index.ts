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

import type { GpsProvider } from "./gps-provider.interface";
import { SamsaraAdapter } from "./samsara.adapter";

/**
 * Supported GPS provider names.
 */
const SUPPORTED_PROVIDERS = ["samsara"] as const;

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
