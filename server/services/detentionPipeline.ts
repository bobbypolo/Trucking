import { v4 as uuidv4 } from 'uuid';
import { calculateDetention } from '../../services/detentionService';

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
    db: any,
    loadLegId: string,
    loadId: string,
    driverLat: number,
    driverLng: number,
    occurredAt: string = new Date().toISOString()
): Promise<void> {
    // Only write if arrived_at is not already set — first geofence hit wins
    await db.query(
        `UPDATE load_legs
         SET arrived_at = ?
         WHERE id = ? AND arrived_at IS NULL`,
        [occurredAt, loadLegId]
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
            JSON.stringify({ source: 'gps_ping' })
        ]
    );

    console.log(`[DetentionPipeline] GEOFENCE_ENTRY — leg ${loadLegId} at ${occurredAt}`);
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
    db: any,
    loadLegId: string,
    loadId: string,
    loadNumber: string,
    driverLat: number | null,
    driverLng: number | null,
    occurredAt: string = new Date().toISOString()
): Promise<{ isBillable: boolean; totalAmount: number; detentionRequest: object | null }> {

    // Read real arrived_at from load_legs
    const [rows]: any = await db.query(
        `SELECT arrived_at FROM load_legs WHERE id = ?`,
        [loadLegId]
    );

    const arrivedAt: string | null = rows?.[0]?.arrived_at
        ? new Date(rows[0].arrived_at).toISOString()
        : null;

    // Write loaded_at and detention_minutes
    if (arrivedAt) {
        const detentionMinutes = Math.round(
            (new Date(occurredAt).getTime() - new Date(arrivedAt).getTime()) / 60000
        );
        await db.query(
            `UPDATE load_legs SET loaded_at = ?, detention_minutes = ? WHERE id = ?`,
            [occurredAt, detentionMinutes, loadLegId]
        );
    } else {
        await db.query(
            `UPDATE load_legs SET loaded_at = ? WHERE id = ?`,
            [occurredAt, loadLegId]
        );
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
            JSON.stringify({ scanned_at: occurredAt })
        ]
    );

    if (!arrivedAt) {
        console.warn(`[DetentionPipeline] No arrived_at for leg ${loadLegId} — skipping detention calc`);
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
                    dwell_minutes:  result.dwellMinutes,
                    billable_hours: result.billableHours,
                    total_amount:   result.totalAmount
                })
            ]
        );
    }

    return {
        isBillable:       result.isBillable,
        totalAmount:      result.totalAmount,
        detentionRequest: result.detentionRequest
    };
}
