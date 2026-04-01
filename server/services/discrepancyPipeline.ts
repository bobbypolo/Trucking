import { v4 as uuidv4 } from 'uuid';

const DISCREPANCY_THRESHOLD_PCT = 5.0;

/**
 * discrepancyPipeline.ts
 *
 * Server-side AI Discrepancy Engine.
 * Called after Gemini extracts scanned_weight/scanned_commodity from a BOL scan.
 *
 * Flow:
 *   1. Dispatcher creates load → quoted_weight and quoted_commodity saved to loads table
 *   2. Driver scans BOL → Gemini runs extractBOLForDiscrepancy()
 *   3. compareWeights() math-checks scanned vs quoted
 *   4. If variance > 5% → flag load, increment broker discrepancy_score
 */

/**
 * Compares Gemini-extracted scanned weight against the quoted weight stored at dispatch.
 * Writes results to loads table and logs DISCREPANCY_FLAGGED event if threshold exceeded.
 */
export async function compareWeights(
    db: any,
    loadId: string,
    quotedWeight: number,
    scannedWeight: number,
    scannedCommodity: string,
    customerId: string
): Promise<{ flagged: boolean; discrepancyPct: number }> {

    if (!quotedWeight || quotedWeight === 0) {
        // No quoted weight on record — store scanned values but don't flag
        await db.query(
            `UPDATE loads SET scanned_weight = ?, scanned_commodity = ? WHERE id = ?`,
            [scannedWeight, scannedCommodity, loadId]
        );
        return { flagged: false, discrepancyPct: 0 };
    }

    const discrepancyPct = ((scannedWeight - quotedWeight) / quotedWeight) * 100;
    const flagged = Math.abs(discrepancyPct) > DISCREPANCY_THRESHOLD_PCT;

    await db.query(
        `UPDATE loads
         SET scanned_weight         = ?,
             scanned_commodity      = ?,
             weight_discrepancy_pct = ?,
             discrepancy_flagged    = ?
         WHERE id = ?`,
        [scannedWeight, scannedCommodity, discrepancyPct.toFixed(2), flagged, loadId]
    );

    if (flagged) {
        console.log(`[DiscrepancyPipeline] FLAGGED — Load ${loadId}: quoted ${quotedWeight}lbs, scanned ${scannedWeight}lbs (${discrepancyPct.toFixed(1)}%)`);

        // Increment broker discrepancy score
        await db.query(
            `UPDATE customers
             SET discrepancy_score   = discrepancy_score + 1,
                 last_discrepancy_at = NOW()
             WHERE id = ?`,
            [customerId]
        );

        // Log immutable event
        await db.query(
            `INSERT INTO load_events (id, load_id, event_type, occurred_at, payload)
             VALUES (?, ?, 'DISCREPANCY_FLAGGED', NOW(), ?)`,
            [
                uuidv4(),
                loadId,
                JSON.stringify({
                    quoted_weight:   quotedWeight,
                    scanned_weight:  scannedWeight,
                    discrepancy_pct: discrepancyPct.toFixed(2),
                    customer_id:     customerId
                })
            ]
        );
    }

    return { flagged, discrepancyPct };
}

/**
 * Called when a load is marked Settled or Completed.
 * Updates broker's total_loads_completed and recalculates avg_payment_days.
 *
 * @param invoicedAt - ISO date string when invoice was sent
 * @param paidAt     - ISO date string when payment was received (null if not yet paid)
 */
export async function recordLoadCompletion(
    db: any,
    customerId: string,
    invoicedAt: string,
    paidAt: string | null
): Promise<void> {
    if (paidAt) {
        // Rolling average: new_avg = (old_avg * old_count + new_days) / new_count
        await db.query(
            `UPDATE customers
             SET total_loads_completed = total_loads_completed + 1,
                 avg_payment_days      = ROUND(
                     (avg_payment_days * total_loads_completed + DATEDIFF(?, ?)) / (total_loads_completed + 1),
                 1)
             WHERE id = ?`,
            [paidAt, invoicedAt, customerId]
        );
    } else {
        await db.query(
            `UPDATE customers
             SET total_loads_completed = total_loads_completed + 1
             WHERE id = ?`,
            [customerId]
        );
    }
}
