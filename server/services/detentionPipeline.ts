import { v4 as uuidv4 } from "uuid";
import type { RowDataPacket } from "mysql2/promise";
import { deliverNotification } from "./notification-delivery.service";
import { createChildLogger } from "../lib/logger";

const log = createChildLogger({ module: "detentionPipeline" });

interface DbQueryable {
  query(sql: string, params?: unknown[]): Promise<[RowDataPacket[], unknown]>;
}

/**
 * Looks up the broker contact email for a load.
 * Returns null if the load has no customer or the customer has no email.
 * Never throws — any DB error is logged and treated as "no email".
 */
async function lookupBrokerEmail(
  db: DbQueryable,
  loadId: string,
): Promise<{ email: string | null; loadNumber: string | null }> {
  try {
    const [rows] = await db.query(
      `SELECT c.email AS email, l.load_number AS load_number
             FROM loads l
             LEFT JOIN customers c ON c.id = l.customer_id
             WHERE l.id = ?`,
      [loadId],
    );
    const row = rows?.[0];
    if (!row) return { email: null, loadNumber: null };
    return {
      email: (row.email as string | null) ?? null,
      loadNumber: (row.load_number as string | null) ?? null,
    };
  } catch (err) {
    log.warn({ err, loadId }, "broker email lookup failed");
    return { email: null, loadNumber: null };
  }
}

/**
 * Fire-and-forget detention email notification.
 *
 * Called after a DETENTION_FLAGGED event is logged. Looks up the broker
 * contact and calls deliverNotification with channel "email" and a subject
 * containing "Detention". Any rejection from deliverNotification is swallowed
 * — the caller's pipeline result is never affected.
 */
async function sendDetentionNotification(
  db: DbQueryable,
  loadId: string,
  fallbackLoadNumber: string,
  billableHours: number,
  totalAmount: number,
): Promise<void> {
  const { email, loadNumber } = await lookupBrokerEmail(db, loadId);
  if (!email) {
    log.warn({ loadId }, "No broker email — skipping detention notification");
    return;
  }

  const displayLoadNumber = loadNumber || fallbackLoadNumber;
  try {
    await deliverNotification({
      channel: "email",
      recipients: [{ email }],
      subject: `Detention Alert: Load #${displayLoadNumber}`,
      message:
        `Detention has been flagged for load ${displayLoadNumber}. ` +
        `Billable hours: ${billableHours}. Total amount: $${totalAmount.toFixed(2)}.`,
    });
  } catch (err) {
    log.error({ err, loadId }, "Detention email notification failed");
  }
}

type DetentionResult = {
  isBillable: boolean;
  dwellMinutes: number;
  billableHours: number;
  totalAmount: number;
  detentionRequest: {
    loadId: string;
    loadNumber: string;
    arrivedAt: string;
    loadedAt: string;
    dwellMinutes: number;
    billableHours: number;
    totalAmount: number;
  } | null;
};

/**
 * Server-side detention calculator used by the passive geofence pipeline.
 * Kept local to avoid importing client-side service code into server runtime.
 */
function calculateDetention(
  arrivedAt: string,
  loadedAt: string,
  loadId: string,
  loadNumber: string,
): DetentionResult {
  const freeHours = Number(process.env.DETENTION_FREE_HOURS ?? 2);
  const hourlyRate = Number(process.env.DETENTION_HOURLY_RATE ?? 75);

  const dwellMinutes = Math.max(
    0,
    Math.round(
      (new Date(loadedAt).getTime() - new Date(arrivedAt).getTime()) / 60000,
    ),
  );
  const dwellHours = dwellMinutes / 60;
  const billableHours = Math.max(0, Math.ceil(dwellHours - freeHours));
  const totalAmount = billableHours * hourlyRate;
  const isBillable = billableHours > 0;

  return {
    isBillable,
    dwellMinutes,
    billableHours,
    totalAmount,
    detentionRequest: isBillable
      ? {
          loadId,
          loadNumber,
          arrivedAt,
          loadedAt,
          dwellMinutes,
          billableHours,
          totalAmount,
        }
      : null,
  };
}

/**
 * detentionPipeline.ts
 *
 * Server-side DB operations for the geofence + detention passive pipeline.
 * Called from the GPS ping endpoint and BOL scan endpoint in server/index.ts.
 *
 * Flow:
 *   1. GPS ping arrives → isWithinGeofence() is true → recordGeofenceEntry()
 *   2. Driver scans BOL in Scanner.tsx → recordBOLScan()
 *   3. recordBOLScan reads real arrived_at, calculates detention, logs events
 */

/**
 * Called when a driver's GPS ping lands inside a facility's 0.5mi geofence
 * AND arrived_at is not yet set on that load_leg.
 *
 * Writes arrived_at to load_legs (first hit only) and logs GEOFENCE_ENTRY.
 */
export async function recordGeofenceEntry(
  db: DbQueryable,
  loadLegId: string,
  loadId: string,
  driverLat: number,
  driverLng: number,
  occurredAt: string = new Date().toISOString(),
): Promise<void> {
  // Only write if arrived_at is not already set — first geofence hit wins
  await db.query(
    `UPDATE load_legs
         SET arrived_at = ?
         WHERE id = ? AND arrived_at IS NULL`,
    [occurredAt, loadLegId],
  );

  await db.query(
    `INSERT INTO load_events (id, load_id, load_leg_id, event_type, occurred_at, driver_lat, driver_lng, payload)
         VALUES (?, ?, ?, 'GEOFENCE_ENTRY', ?, ?, ?, ?)`,
    [
      uuidv4(),
      loadId,
      loadLegId,
      occurredAt,
      driverLat,
      driverLng,
      JSON.stringify({ source: "gps_ping" }),
    ],
  );

  log.info({ loadLegId, occurredAt }, "GEOFENCE_ENTRY recorded");
}

/**
 * Called when the driver scans the BOL in Scanner.tsx.
 *
 * Writes loaded_at and detention_minutes to load_legs, then calculates
 * whether detention is billable using real timestamps from the DB.
 *
 * @returns detentionResult — pass to caller to store the billing request if isBillable
 */
export async function recordBOLScan(
  db: DbQueryable,
  loadLegId: string,
  loadId: string,
  loadNumber: string,
  driverLat: number | null,
  driverLng: number | null,
  occurredAt: string = new Date().toISOString(),
): Promise<{
  isBillable: boolean;
  totalAmount: number;
  detentionRequest: object | null;
}> {
  // Read real arrived_at from load_legs
  const [rows] = await db.query(
    `SELECT arrived_at FROM load_legs WHERE id = ?`,
    [loadLegId],
  );

  const arrivedAt: string | null = rows?.[0]?.arrived_at
    ? new Date(rows[0].arrived_at).toISOString()
    : null;

  // Write loaded_at and detention_minutes
  if (arrivedAt) {
    const detentionMinutes = Math.round(
      (new Date(occurredAt).getTime() - new Date(arrivedAt).getTime()) / 60000,
    );
    await db.query(
      `UPDATE load_legs SET loaded_at = ?, detention_minutes = ? WHERE id = ?`,
      [occurredAt, detentionMinutes, loadLegId],
    );
  } else {
    await db.query(`UPDATE load_legs SET loaded_at = ? WHERE id = ?`, [
      occurredAt,
      loadLegId,
    ]);
  }

  // Log BOL_SCANNED event
  await db.query(
    `INSERT INTO load_events (id, load_id, load_leg_id, event_type, occurred_at, driver_lat, driver_lng, payload)
         VALUES (?, ?, ?, 'BOL_SCANNED', ?, ?, ?, ?)`,
    [
      uuidv4(),
      loadId,
      loadLegId,
      occurredAt,
      driverLat,
      driverLng,
      JSON.stringify({ scanned_at: occurredAt }),
    ],
  );

  if (!arrivedAt) {
    log.warn({ loadLegId }, "No arrived_at — skipping detention calc");
    return { isBillable: false, totalAmount: 0, detentionRequest: null };
  }

  const result = calculateDetention(arrivedAt, occurredAt, loadId, loadNumber);

  if (result.isBillable) {
    await db.query(
      `INSERT INTO load_events (id, load_id, load_leg_id, event_type, occurred_at, payload)
             VALUES (?, ?, ?, 'DETENTION_FLAGGED', ?, ?)`,
      [
        uuidv4(),
        loadId,
        loadLegId,
        occurredAt,
        JSON.stringify({
          dwell_minutes: result.dwellMinutes,
          billable_hours: result.billableHours,
          total_amount: result.totalAmount,
        }),
      ],
    );

    // Fire-and-forget: notify broker of billable detention via email.
    // Any failure here is swallowed so the pipeline result is unaffected (R-P7-01, R-P7-04).
    await sendDetentionNotification(
      db,
      loadId,
      loadNumber,
      result.billableHours,
      result.totalAmount,
    );
  }

  return {
    isBillable: result.isBillable,
    totalAmount: result.totalAmount,
    detentionRequest: result.detentionRequest,
  };
}
