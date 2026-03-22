/**
 * GPS Provider Interface for LoadPilot
 *
 * Provider-agnostic interface for vehicle location tracking.
 * Implementations are in separate adapter files (e.g., samsara.adapter.ts).
 *
 * No provider-specific types are exposed by this interface.
 * Each adapter translates its provider's API response into the
 * common GpsPosition type.
 *
 * @see .claude/docs/PLAN.md S-203
 */

/**
 * A single vehicle GPS position, provider-agnostic.
 *
 * Every field is a common trucking concept — no provider-specific
 * identifiers leak into the interface. `providerVehicleId` is the
 * vehicle's ID within the GPS provider's system, while `vehicleId`
 * is the canonical LoadPilot identifier.
 */
export interface GpsPosition {
  /** LoadPilot or provider-specific vehicle identifier */
  vehicleId: string;
  /** Driver associated with the vehicle (if known) */
  driverId?: string;
  /** Decimal degrees latitude (-90 to 90) */
  latitude: number;
  /** Decimal degrees longitude (-180 to 180) */
  longitude: number;
  /** Speed in miles per hour */
  speed: number;
  /** Compass heading in degrees (0-359) */
  heading: number;
  /** When this position was recorded */
  recordedAt: Date;
  /** GPS provider name (e.g., "samsara", "keeptruckin") */
  provider: string;
  /** Vehicle ID in the provider's system */
  providerVehicleId: string;
  /** True if this position is mock/simulated data */
  isMock?: boolean;
}

/**
 * Provider-agnostic GPS data interface.
 *
 * All methods return gracefully on failure (empty arrays / null)
 * rather than throwing. Errors are logged internally.
 */
export interface GpsProvider {
  /**
   * Get current locations for all vehicles in a company.
   *
   * @param companyId - The LoadPilot company identifier
   * @returns Array of GPS positions (empty on error/timeout)
   */
  getVehicleLocations(companyId: string): Promise<GpsPosition[]>;

  /**
   * Get current location for a single vehicle.
   *
   * @param vehicleId - The vehicle identifier (provider-specific)
   * @returns GPS position or null if not found/error
   */
  getVehicleLocation(vehicleId: string): Promise<GpsPosition | null>;
}
