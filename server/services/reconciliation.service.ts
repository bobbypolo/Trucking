import type { RowDataPacket } from "mysql2/promise";
import pool from "../db";
import { createChildLogger } from "../lib/logger";

const log = createChildLogger({ module: "reconciliation.service" });

/**
 * Interface for listing storage objects (injectable for testing).
 * Lists all object paths under a tenant prefix in Firebase Storage.
 */
export interface StorageListAdapter {
  listObjects(tenantPrefix: string): Promise<string[]>;
}

/**
 * Finding types for each reconciliation check category.
 */
export interface OrphanStop {
  stop_id: string;
  load_id: string;
}

export interface MissingEventTrail {
  load_id: string;
  load_number: string;
  status: string;
}

export interface SettlementMismatch {
  settlement_id: string;
  load_id: string;
  stored_total_earnings: string;
  recalc_total_earnings: string;
  stored_net_pay: string;
  recalc_net_pay: string;
}

export interface DuplicateAssignment {
  entity_type: "driver" | "equipment";
  entity_id: string;
  load_count: number;
  load_ids: string;
}

export interface MetadataWithoutStorage {
  doc_id: string;
  storage_path: string;
}

export interface StorageWithoutMetadata {
  storage_path: string;
}

/**
 * Full reconciliation report returned by runReconciliation.
 */
export interface ReconciliationReport {
  companyId: string;
  generatedAt: string;
  orphanStops: OrphanStop[];
  missingEventTrails: MissingEventTrail[];
  settlementMismatches: SettlementMismatch[];
  duplicateAssignments: DuplicateAssignment[];
  metadataWithoutStorage: MetadataWithoutStorage[];
  storageWithoutMetadata: StorageWithoutMetadata[];
  isClean: boolean;
}

/**
 * Run all reconciliation checks for a tenant and return a structured report.
 *
 * Checks performed:
 *   1. Orphan stops — stops referencing a load_id that does not exist in loads table
 *   2. Missing event trails — loads with non-initial status but no dispatch_events records
 *   3. Settlement mismatches — settlement header totals that differ from recalculated line item sums
 *   4. Duplicate assignments — drivers or equipment assigned to multiple active loads simultaneously
 *   5. Document metadata without storage — documents table rows whose storage_path has no Firebase Storage object
 *   6. Storage objects without metadata — Firebase Storage objects with no matching documents table row
 *
 * @param companyId — tenant ID to scope all checks
 * @param storageAdapter — injectable adapter for listing Firebase Storage objects
 * @returns ReconciliationReport with findings per category and isClean flag
 *
 * @story R-P4-03
 */
export async function runReconciliation(
  companyId: string,
  storageAdapter: StorageListAdapter,
): Promise<ReconciliationReport> {
  log.info({ companyId }, "Starting reconciliation run");

  // 1. Orphan stops: stops whose load_id does not exist in loads table
  const [orphanStops] = await pool.query<RowDataPacket[]>(
    `/* orphan_stops */
     SELECT ll.id AS stop_id, ll.load_id
     FROM load_legs ll
     LEFT JOIN loads l ON ll.load_id = l.id
     WHERE l.id IS NULL
       AND ll.load_id IN (
         SELECT ll2.load_id FROM load_legs ll2
         INNER JOIN loads l2 ON l2.company_id = ?
         WHERE ll2.load_id = ll.load_id
         UNION
         SELECT ll3.load_id FROM load_legs ll3
         LEFT JOIN loads l3 ON ll3.load_id = l3.id
         WHERE l3.id IS NULL
       )`,
    [companyId],
  );

  // 2. Missing event trails: loads with non-initial status but zero dispatch_events
  const [missingEventTrails] = await pool.query<RowDataPacket[]>(
    `/* missing_event_trails */
     SELECT l.id AS load_id, l.load_number, l.status
     FROM loads l
     LEFT JOIN dispatch_events de ON l.id = de.load_id
     WHERE l.company_id = ?
       AND l.status NOT IN ('pending', 'created')
       AND de.id IS NULL`,
    [companyId],
  );

  // 3. Settlement mismatches: stored totals differ from recalculated line item sums
  const [settlementMismatches] = await pool.query<RowDataPacket[]>(
    `/* settlement_mismatches */
     SELECT
       s.id AS settlement_id,
       s.load_id,
       s.total_earnings AS stored_total_earnings,
       COALESCE(calc.recalc_earnings, 0) AS recalc_total_earnings,
       s.net_pay AS stored_net_pay,
       COALESCE(
         calc.recalc_earnings - calc.recalc_deductions + calc.recalc_reimbursements,
         0
       ) AS recalc_net_pay
     FROM settlements s
     LEFT JOIN (
       SELECT
         sdl.settlement_id,
         ROUND(SUM(CASE WHEN sdl.type = 'earning' THEN sdl.amount ELSE 0 END), 2) AS recalc_earnings,
         ROUND(SUM(CASE WHEN sdl.type = 'deduction' THEN sdl.amount ELSE 0 END), 2) AS recalc_deductions,
         ROUND(SUM(CASE WHEN sdl.type = 'reimbursement' THEN sdl.amount ELSE 0 END), 2) AS recalc_reimbursements
       FROM settlement_detail_lines sdl
       GROUP BY sdl.settlement_id
     ) calc ON s.id = calc.settlement_id
     WHERE s.company_id = ?
       AND (
         ROUND(s.total_earnings, 2) != ROUND(COALESCE(calc.recalc_earnings, 0), 2)
         OR ROUND(s.net_pay, 2) != ROUND(
           COALESCE(calc.recalc_earnings, 0) - COALESCE(calc.recalc_deductions, 0) + COALESCE(calc.recalc_reimbursements, 0),
           2
         )
       )`,
    [companyId],
  );

  // 4a. Duplicate driver assignments: drivers on multiple active loads
  const [duplicateDrivers] = await pool.query<RowDataPacket[]>(
    `/* duplicate_driver_assignments */
     SELECT
       'driver' AS entity_type,
       l.driver_id AS entity_id,
       COUNT(*) AS load_count,
       GROUP_CONCAT(l.id) AS load_ids
     FROM loads l
     WHERE l.company_id = ?
       AND l.driver_id IS NOT NULL
       AND l.status NOT IN ('completed', 'cancelled', 'invoiced')
     GROUP BY l.driver_id
     HAVING COUNT(*) > 1`,
    [companyId],
  );

  // 4b. Duplicate equipment assignments: equipment on multiple active loads
  const [duplicateEquipment] = await pool.query<RowDataPacket[]>(
    `/* duplicate_equipment_assignments */
     SELECT
       'equipment' AS entity_type,
       e.id AS entity_id,
       COUNT(*) AS load_count,
       GROUP_CONCAT(e.assigned_load_id) AS load_ids
     FROM equipment e
     INNER JOIN loads l ON e.assigned_load_id = l.id
     WHERE e.company_id = ?
       AND e.assigned_load_id IS NOT NULL
       AND l.status NOT IN ('completed', 'cancelled', 'invoiced')
     GROUP BY e.id
     HAVING COUNT(*) > 1`,
    [companyId],
  );

  const duplicateAssignments: DuplicateAssignment[] = [
    ...duplicateDrivers,
    ...duplicateEquipment,
  ];

  // 5 & 6. Bidirectional document reconciliation
  // 5a. Get all document metadata rows for this tenant
  const [docMetadataRows] = await pool.query<RowDataPacket[]>(
    `/* orphan_metadata */
     SELECT id AS doc_id, storage_path
     FROM documents
     WHERE company_id = ?`,
    [companyId],
  );

  // 5b. Get all storage objects for this tenant
  const tenantPrefix = `tenants/${companyId}/documents/`;
  const storageObjects = await storageAdapter.listObjects(tenantPrefix);

  // Build sets for bidirectional comparison
  const metadataPaths = new Set(
    docMetadataRows.map((r) => r.storage_path as string),
  );
  const storagePaths = new Set(storageObjects);

  // 5c. Metadata without storage: DB rows whose storage_path is NOT in storage
  const metadataWithoutStorage: MetadataWithoutStorage[] = docMetadataRows
    .filter((r) => !storagePaths.has(r.storage_path as string))
    .map((r) => ({
      doc_id: r.doc_id as string,
      storage_path: r.storage_path as string,
    }));

  // 6. Storage without metadata: storage objects not in any DB row's storage_path
  const storageWithoutMetadata: StorageWithoutMetadata[] = storageObjects
    .filter((path: string) => !metadataPaths.has(path))
    .map((path: string) => ({ storage_path: path }));

  // Build report
  const report: ReconciliationReport = {
    companyId,
    generatedAt: new Date().toISOString(),
    orphanStops,
    missingEventTrails,
    settlementMismatches,
    duplicateAssignments,
    metadataWithoutStorage,
    storageWithoutMetadata,
    isClean:
      orphanStops.length === 0 &&
      missingEventTrails.length === 0 &&
      settlementMismatches.length === 0 &&
      duplicateAssignments.length === 0 &&
      metadataWithoutStorage.length === 0 &&
      storageWithoutMetadata.length === 0,
  };

  log.info(
    {
      companyId,
      isClean: report.isClean,
      orphanStops: orphanStops.length,
      missingEventTrails: missingEventTrails.length,
      settlementMismatches: settlementMismatches.length,
      duplicateAssignments: duplicateAssignments.length,
      metadataWithoutStorage: metadataWithoutStorage.length,
      storageWithoutMetadata: storageWithoutMetadata.length,
    },
    "Reconciliation run complete",
  );

  return report;
}
