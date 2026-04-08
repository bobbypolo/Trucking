/**
 * IFTA Evidence Bridge Service
 *
 * Bridges GPS position data into the ifta_trip_evidence table for
 * automatic IFTA mileage tracking. Called inline at GPS ingestion
 * points (Samsara polling, webhook, mobile GPS).
 *
 * All operations are best-effort — failures are logged but never
 * block GPS position storage.
 */

import { v4 as uuidv4 } from "uuid";
import type { RowDataPacket } from "mysql2/promise";
import { detectState } from "../geoUtils";
import { createChildLogger } from "../lib/logger";

const log = createChildLogger({ module: "ifta-evidence" });

/** Active load statuses where a truck is "on the road" */
const ACTIVE_LOAD_STATUSES = ["dispatched", "in_transit", "arrived"];

export interface GpsToIftaInput {
  companyId: string;
  vehicleId: string;
  driverId: string | null;
  lat: number;
  lng: number;
  speed: number | null;
  odometer: number | null;
  timestamp: Date;
  source: "ELD" | "GPS" | "Manual" | "Import";
}

/**
 * Find all active loads for a company, indexed by driver_id.
 * Single query — used for batch processing in Samsara polling.
 *
 * @returns Map of driver_id → load_id for all in-progress loads
 */
export async function findActiveLoadsForCompany(
  companyId: string,
  pool: { query(sql: string, params?: unknown[]): Promise<[RowDataPacket[], unknown]> },
): Promise<Map<string, string>> {
  const placeholders = ACTIVE_LOAD_STATUSES.map(() => "?").join(", ");
  const [rows] = await pool.query(
    `SELECT id, driver_id FROM loads
     WHERE company_id = ? AND status IN (${placeholders})
     AND driver_id IS NOT NULL`,
    [companyId, ...ACTIVE_LOAD_STATUSES],
  );

  const map = new Map<string, string>();
  for (const row of rows) {
    if (row.driver_id) {
      map.set(row.driver_id, row.id);
    }
  }
  return map;
}

/**
 * Find the active load for a specific vehicle/driver.
 * Uses a resolution chain:
 *   1. Direct driver_id → load lookup
 *   2. Vehicle mapping → recent driver → load lookup
 *
 * @returns load_id or null if no active load found
 */
export async function findActiveLoadForVehicle(
  companyId: string,
  vehicleId: string,
  driverId: string | null,
  pool: { query(sql: string, params?: unknown[]): Promise<[RowDataPacket[], unknown]> },
): Promise<string | null> {
  const placeholders = ACTIVE_LOAD_STATUSES.map(() => "?").join(", ");

  // Strategy 1: Direct driver_id lookup
  if (driverId) {
    const [rows] = await pool.query(
      `SELECT id FROM loads
       WHERE company_id = ? AND driver_id = ? AND status IN (${placeholders})
       ORDER BY created_at DESC LIMIT 1`,
      [companyId, driverId, ...ACTIVE_LOAD_STATUSES],
    );
    if (rows.length > 0) return rows[0].id;
  }

  // Strategy 2: Resolve vehicle → driver via recent GPS positions
  const [driverRows] = await pool.query(
    `SELECT driver_id FROM gps_positions
     WHERE company_id = ? AND vehicle_id = ? AND driver_id IS NOT NULL
     ORDER BY recorded_at DESC LIMIT 1`,
    [companyId, vehicleId],
  );

  if (driverRows.length > 0 && driverRows[0].driver_id) {
    const resolvedDriverId = driverRows[0].driver_id;
    const [loadRows] = await pool.query(
      `SELECT id FROM loads
       WHERE company_id = ? AND driver_id = ? AND status IN (${placeholders})
       ORDER BY created_at DESC LIMIT 1`,
      [companyId, resolvedDriverId, ...ACTIVE_LOAD_STATUSES],
    );
    if (loadRows.length > 0) return loadRows[0].id;
  }

  return null;
}

/**
 * Bridge a GPS position into IFTA trip evidence.
 *
 * Best-effort: failures are logged but never thrown.
 * Skips silently if no active load is found (IFTA evidence requires load context).
 */
export async function bridgeGpsToIfta(
  input: GpsToIftaInput,
  pool: { query(sql: string, params?: unknown[]): Promise<[RowDataPacket[], unknown]> },
  loadId?: string | null,
): Promise<void> {
  try {
    // Resolve load_id if not provided
    const resolvedLoadId =
      loadId ??
      (await findActiveLoadForVehicle(
        input.companyId,
        input.vehicleId,
        input.driverId,
        pool,
      ));

    if (!resolvedLoadId) {
      // No active load — GPS is logged but not linked to IFTA.
      // This is correct behavior: IFTA evidence is per-load.
      return;
    }

    // Detect state code via reverse geocoding (cached)
    const stateCode = await detectState(input.lat, input.lng);

    await pool.query(
      `INSERT INTO ifta_trip_evidence
         (id, company_id, load_id, truck_id, driver_id, timestamp,
          lat, lng, odometer, state_code, speed_mph, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        input.companyId,
        resolvedLoadId,
        input.vehicleId,
        input.driverId || null,
        input.timestamp,
        input.lat,
        input.lng,
        input.odometer,
        stateCode || null, // CHAR(2) — null if unresolved
        input.speed,
        input.source,
      ],
    );

    log.info(
      {
        companyId: input.companyId,
        loadId: resolvedLoadId,
        vehicleId: input.vehicleId,
        stateCode,
      },
      "GPS ping bridged to IFTA evidence",
    );
  } catch (err) {
    log.error(
      { err, vehicleId: input.vehicleId, companyId: input.companyId },
      "Failed to bridge GPS to IFTA evidence",
    );
  }
}
