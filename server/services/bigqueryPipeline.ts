import { BigQuery } from '@google-cloud/bigquery';

/**
 * bigqueryPipeline.ts
 *
 * Async export pipeline — fires when a load is Completed or Settled.
 * Sends a flattened, analytics-ready snapshot of the load to BigQuery.
 *
 * This keeps ALL heavy analytical queries (facility averages, broker risk
 * scores, rate trends) off the live MySQL database entirely.
 *
 * Setup required (one-time):
 *   1. Set BIGQUERY_PROJECT_ID in server/.env
 *   2. Set GOOGLE_APPLICATION_CREDENTIALS to your service account JSON path
 *   3. Run createAnalyticsTable() once to provision the BQ table
 */

const DATASET_ID  = 'loadpilot_analytics';
const TABLE_ID    = 'completed_loads';

function getBigQueryClient(): BigQuery {
    return new BigQuery({
        projectId: process.env.BIGQUERY_PROJECT_ID
    });
}

/**
 * One-time setup: creates the BigQuery dataset and table if they don't exist.
 * Call this from a migration script, not on every server start.
 */
export async function createAnalyticsTable(): Promise<void> {
    const bq = getBigQueryClient();

    const [datasetExists] = await bq.dataset(DATASET_ID).exists();
    if (!datasetExists) {
        await bq.createDataset(DATASET_ID, { location: 'US' });
        console.log(`[BigQuery] Dataset '${DATASET_ID}' created.`);
    }

    const dataset = bq.dataset(DATASET_ID);
    const [tableExists] = await dataset.table(TABLE_ID).exists();
    if (!tableExists) {
        await dataset.createTable(TABLE_ID, {
            schema: {
                fields: [
                    { name: 'load_id',               type: 'STRING',    mode: 'REQUIRED' },
                    { name: 'load_number',            type: 'STRING',    mode: 'NULLABLE' },
                    { name: 'company_id',             type: 'STRING',    mode: 'NULLABLE' },
                    { name: 'broker_name',            type: 'STRING',    mode: 'NULLABLE' },
                    { name: 'broker_id',              type: 'STRING',    mode: 'NULLABLE' },
                    { name: 'pickup_city',            type: 'STRING',    mode: 'NULLABLE' },
                    { name: 'pickup_state',           type: 'STRING',    mode: 'NULLABLE' },
                    { name: 'pickup_facility',        type: 'STRING',    mode: 'NULLABLE' },
                    { name: 'dropoff_city',           type: 'STRING',    mode: 'NULLABLE' },
                    { name: 'dropoff_state',          type: 'STRING',    mode: 'NULLABLE' },
                    { name: 'dropoff_facility',       type: 'STRING',    mode: 'NULLABLE' },
                    { name: 'carrier_rate',           type: 'FLOAT',     mode: 'NULLABLE' },
                    { name: 'driver_pay',             type: 'FLOAT',     mode: 'NULLABLE' },
                    { name: 'quoted_weight',          type: 'FLOAT',     mode: 'NULLABLE' },
                    { name: 'scanned_weight',         type: 'FLOAT',     mode: 'NULLABLE' },
                    { name: 'weight_discrepancy_pct', type: 'FLOAT',     mode: 'NULLABLE' },
                    { name: 'discrepancy_flagged',    type: 'BOOLEAN',   mode: 'NULLABLE' },
                    { name: 'commodity',              type: 'STRING',    mode: 'NULLABLE' },
                    { name: 'detention_minutes',      type: 'INTEGER',   mode: 'NULLABLE' },
                    { name: 'pickup_date',            type: 'DATE',      mode: 'NULLABLE' },
                    { name: 'completed_at',           type: 'TIMESTAMP', mode: 'NULLABLE' },
                    { name: 'exported_at',            type: 'TIMESTAMP', mode: 'REQUIRED' }
                ]
            },
            timePartitioning: { type: 'MONTH', field: 'completed_at' }
        });
        console.log(`[BigQuery] Table '${DATASET_ID}.${TABLE_ID}' created.`);
    }
}

/**
 * Exports a completed load to BigQuery.
 * Called asynchronously from the PATCH /api/loads/:id/status endpoint
 * when status transitions to 'Completed' or 'Settled'.
 * Errors are logged but never thrown — never blocks the main request.
 *
 * @param db        - MySQL pool (to fetch load + broker + leg data)
 * @param loadId    - The load being exported
 */
export async function exportLoadToBigQuery(db: any, loadId: string): Promise<void> {
    try {
        // Fetch the load with broker name and first pickup/dropoff legs
        const [loadRows]: any = await db.query(
            `SELECT
                l.id, l.load_number, l.company_id, l.customer_id,
                c.name          AS broker_name,
                l.carrier_rate, l.driver_pay,
                l.quoted_weight, l.scanned_weight, l.weight_discrepancy_pct,
                l.discrepancy_flagged, l.commodity, l.pickup_date,
                l.created_at
             FROM loads l
             LEFT JOIN customers c ON c.id = l.customer_id
             WHERE l.id = ?`,
            [loadId]
        );

        if (!loadRows.length) {
            console.warn(`[BigQuery] Load ${loadId} not found — skipping export`);
            return;
        }

        const load = loadRows[0];

        // Fetch first pickup and dropoff legs for facility index data
        const [legs]: any = await db.query(
            `SELECT type, facility_name, city, state, detention_minutes
             FROM load_legs
             WHERE load_id = ?
             ORDER BY sequence_order ASC`,
            [loadId]
        );

        const pickup  = legs.find((l: any) => l.type === 'Pickup');
        const dropoff = legs.find((l: any) => l.type === 'Dropoff');

        // Total detention across all legs
        const totalDetentionMinutes = legs.reduce(
            (sum: number, l: any) => sum + (l.detention_minutes || 0), 0
        );

        const row = {
            load_id:               load.id,
            load_number:           load.load_number   ?? null,
            company_id:            load.company_id    ?? null,
            broker_name:           load.broker_name   ?? null,
            broker_id:             load.customer_id   ?? null,
            pickup_city:           pickup?.city        ?? null,
            pickup_state:          pickup?.state       ?? null,
            pickup_facility:       pickup?.facility_name ?? null,
            dropoff_city:          dropoff?.city       ?? null,
            dropoff_state:         dropoff?.state      ?? null,
            dropoff_facility:      dropoff?.facility_name ?? null,
            carrier_rate:          load.carrier_rate   ?? null,
            driver_pay:            load.driver_pay     ?? null,
            quoted_weight:         load.quoted_weight  ?? null,
            scanned_weight:        load.scanned_weight ?? null,
            weight_discrepancy_pct: load.weight_discrepancy_pct ?? null,
            discrepancy_flagged:   load.discrepancy_flagged ?? false,
            commodity:             load.commodity      ?? null,
            detention_minutes:     totalDetentionMinutes || null,
            pickup_date:           load.pickup_date    ?? null,
            completed_at:          new Date().toISOString(),
            exported_at:           new Date().toISOString()
        };

        const bq = getBigQueryClient();
        await bq.dataset(DATASET_ID).table(TABLE_ID).insert([row]);

        console.log(`[BigQuery] Load ${load.load_number ?? loadId} exported to ${DATASET_ID}.${TABLE_ID}`);
    } catch (error: any) {
        // Never let BigQuery errors surface to the user — this is background work
        console.error(`[BigQuery] Export failed for load ${loadId}:`, error?.message ?? error);
    }
}
