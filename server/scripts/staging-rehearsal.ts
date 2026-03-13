/**
 * Staging Migration Rehearsal Script
 *
 * Proves that DB migrations and normalized load status logic work correctly
 * in a prod-like isolated environment. This script:
 *
 *   1. Connects to the configured database (staging or dev)
 *   2. Captures pre-migration status counts
 *   3. Applies all pending migrations via MigrationRunner
 *   4. Captures post-migration status counts
 *   5. Validates row conservation (pre-total == post-total)
 *   6. Validates no legacy PascalCase statuses remain
 *   7. Runs post-migration reconciliation checks
 *   8. Performs rollback and re-applies (round-trip proof)
 *   9. Outputs a structured rehearsal report
 *
 * Usage:
 *   npx ts-node server/scripts/staging-rehearsal.ts [--dry-run] [--rollback-test]
 *
 * Options:
 *   --dry-run        Connect and snapshot only — do not apply migrations
 *   --rollback-test  After forward migration, run rollback and re-apply to prove round-trip
 *
 * Environment variables (from .env):
 *   DB_HOST, DB_USER, DB_PASSWORD, DB_NAME
 *
 * Exit codes:
 *   0 — rehearsal passed all validations
 *   1 — rehearsal failed — do NOT promote to production
 *
 * @story R-FS-02
 */

import * as path from "path";
import dotenv from "dotenv";
import mysql from "mysql2/promise";
import { MigrationRunner } from "../lib/migrator";
import { logger } from "../lib/logger";

dotenv.config();

// ─── Constants ────────────────────────────────────────────────────────────────

const CANONICAL_STATUSES = [
  "draft",
  "planned",
  "dispatched",
  "in_transit",
  "arrived",
  "delivered",
  "completed",
  "cancelled",
] as const;

type CanonicalStatus = (typeof CANONICAL_STATUSES)[number];

const LEGACY_STATUSES = [
  "Planned",
  "Booked",
  "Active",
  "Departed",
  "Arrived",
  "Docked",
  "Unloaded",
  "Delivered",
  "Invoiced",
  "Settled",
  "Cancelled",
  "CorrectionRequested",
] as const;

const MIGRATIONS_DIR = path.resolve(__dirname, "..", "migrations");

// Expected table count after applying all migrations 001–016.
// This is the authoritative count for the full migration chain.
// Update this when adding new migrations (017+).
// Verified count as of migration 016_exception_management: 53 tables
// (48 from 001-015 + 5 from 016: exception_status, exception_type, dashboard_card, exceptions, exception_events).
const EXPECTED_TABLE_COUNT = 53;
const HIGHEST_MIGRATION = "016_exception_management";

// ─── Types ────────────────────────────────────────────────────────────────────

interface StatusRow {
  status: string;
  count: number;
}

interface CountRow {
  total: number;
}

interface StatusSnapshot {
  timestamp: string;
  totalLoads: number;
  byStatus: Record<string, number>;
  legacyRowsRemaining: number;
  nonCanonicalRows: number;
}

interface RehearsalStep {
  step: string;
  passed: boolean;
  detail: string;
  data?: unknown;
}

interface RehearsalReport {
  timestamp: string;
  environment: string;
  dryRun: boolean;
  rollbackTest: boolean;
  preMigration: StatusSnapshot | null;
  postMigration: StatusSnapshot | null;
  migrationsApplied: string[];
  steps: RehearsalStep[];
  overallPassed: boolean;
  summary: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function captureStatusSnapshot(
  conn: mysql.Connection,
  label: string,
): Promise<StatusSnapshot> {
  // Total row count
  const [totalRows] = await conn.query<mysql.RowDataPacket[]>(
    "SELECT COUNT(*) AS total FROM loads",
  );
  const totalLoads = (totalRows[0] as CountRow).total;

  // Status distribution
  const [statusRows] = await conn.query<mysql.RowDataPacket[]>(
    "SELECT status, COUNT(*) AS count FROM loads GROUP BY status ORDER BY status",
  );
  const byStatus: Record<string, number> = {};
  for (const row of statusRows as StatusRow[]) {
    byStatus[row.status] = row.count;
  }

  // Legacy rows remaining
  const legacyPlaceholders = LEGACY_STATUSES.map(() => "?").join(", ");
  const [legacyRows] = await conn.query<mysql.RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM loads WHERE status IN (${legacyPlaceholders})`,
    [...LEGACY_STATUSES],
  );
  const legacyRowsRemaining = (legacyRows[0] as CountRow).total;

  // Non-canonical rows (not in canonical set)
  const canonicalPlaceholders = CANONICAL_STATUSES.map(() => "?").join(", ");
  const [nonCanonicalRows] = await conn.query<mysql.RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM loads WHERE status NOT IN (${canonicalPlaceholders})`,
    [...CANONICAL_STATUSES],
  );
  const nonCanonicalCount = (nonCanonicalRows[0] as CountRow).total;

  const snapshot: StatusSnapshot = {
    timestamp: new Date().toISOString(),
    totalLoads,
    byStatus,
    legacyRowsRemaining,
    nonCanonicalRows: nonCanonicalCount,
  };

  logger.info(
    { label, snapshot },
    `Status snapshot [${label}]: ${totalLoads} total loads, ${legacyRowsRemaining} legacy rows, ${nonCanonicalCount} non-canonical`,
  );

  return snapshot;
}

function checkLoadsTableExists(conn: mysql.Connection): Promise<boolean> {
  return conn
    .query<
      mysql.RowDataPacket[]
    >("SELECT COUNT(*) AS cnt FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'loads'")
    .then(([rows]) => (rows[0] as { cnt: number }).cnt > 0);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const rollbackTest = args.includes("--rollback-test");

  logger.info({ dryRun, rollbackTest }, "=== Staging Migration Rehearsal ===");

  const socketPath = process.env.DB_SOCKET_PATH;
  const hasHost = !!process.env.DB_HOST;

  if (!socketPath && !hasHost) {
    logger.error(
      "Either DB_SOCKET_PATH (Cloud SQL Unix socket) or DB_HOST (TCP) must be set. Configure staging database credentials in .env",
    );
    process.exit(1);
  }

  if (!process.env.DB_NAME) {
    logger.error("DB_NAME must be set. Configure staging database credentials in .env");
    process.exit(1);
  }

  // Build connection config: prefer Cloud SQL Unix socket (DB_SOCKET_PATH) over TCP (DB_HOST + DB_PORT).
  const connectionConfig: mysql.ConnectionOptions = {
    ...(socketPath
      ? { socketPath }
      : {
          host: process.env.DB_HOST,
          port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
        }),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: false,
  };

  const connection = await mysql.createConnection(connectionConfig);

  const report: RehearsalReport = {
    timestamp: new Date().toISOString(),
    environment: `${process.env.DB_SOCKET_PATH || process.env.DB_HOST}/${process.env.DB_NAME}`,
    dryRun,
    rollbackTest,
    preMigration: null,
    postMigration: null,
    migrationsApplied: [],
    steps: [],
    overallPassed: false,
    summary: "",
  };

  const addStep = (
    step: string,
    passed: boolean,
    detail: string,
    data?: unknown,
  ): void => {
    report.steps.push({ step, passed, detail, data });
    const level = passed ? "info" : "error";
    logger[level](
      { step, detail, data },
      `[${passed ? "PASS" : "FAIL"}] ${step}: ${detail}`,
    );
  };

  try {
    // ── Step 1: Connection test ──────────────────────────────────────────────
    await connection.query("SELECT 1");
    addStep(
      "connection",
      true,
      `Connected to ${process.env.DB_HOST}/${process.env.DB_NAME}`,
    );

    const runner = new MigrationRunner(connection, MIGRATIONS_DIR);

    // ── Step 2: Migration status pre-check ──────────────────────────────────
    const statusBefore = await runner.status();
    addStep(
      "pre-migration-status",
      true,
      `Applied: ${statusBefore.applied.length}, Pending: ${statusBefore.pending.length}`,
      statusBefore,
    );

    // ── Step 3: Pre-migration snapshot ──────────────────────────────────────
    const loadsExists = await checkLoadsTableExists(connection);
    if (loadsExists) {
      report.preMigration = await captureStatusSnapshot(
        connection,
        "pre-migration",
      );
      addStep(
        "pre-migration-snapshot",
        true,
        `Captured: ${report.preMigration.totalLoads} loads, ${report.preMigration.legacyRowsRemaining} legacy rows`,
        report.preMigration,
      );
    } else {
      addStep(
        "pre-migration-snapshot",
        true,
        "loads table not yet created (baseline not applied)",
      );
    }

    if (dryRun) {
      addStep("dry-run", true, "Dry run mode — skipping migration execution");
      report.overallPassed = true;
      report.summary =
        "Dry run complete — connection and snapshot verified, no migrations applied";
      printReport(report);
      return;
    }

    // ── Step 4: Apply migrations ─────────────────────────────────────────────
    logger.info("Applying pending migrations...");
    const upResult = await runner.up();
    report.migrationsApplied = upResult.applied;

    if (upResult.applied.length === 0) {
      addStep(
        "migrations-up",
        true,
        "No pending migrations — database is up to date",
      );
    } else {
      addStep(
        "migrations-up",
        true,
        `Applied ${upResult.applied.length} migration(s): ${upResult.applied.join(", ")}`,
        upResult.applied,
      );
    }

    // ── Step 5: Post-migration snapshot ─────────────────────────────────────
    const loadsExistsAfter = await checkLoadsTableExists(connection);
    if (loadsExistsAfter) {
      report.postMigration = await captureStatusSnapshot(
        connection,
        "post-migration",
      );
      addStep(
        "post-migration-snapshot",
        true,
        `Captured: ${report.postMigration.totalLoads} loads, ${report.postMigration.legacyRowsRemaining} legacy rows`,
        report.postMigration,
      );

      // ── Step 6: Row conservation check ──────────────────────────────────────
      if (report.preMigration !== null) {
        const conserved =
          report.preMigration.totalLoads === report.postMigration.totalLoads;
        addStep(
          "row-conservation",
          conserved,
          conserved
            ? `Row count preserved: ${report.preMigration.totalLoads} loads`
            : `Row count mismatch: ${report.preMigration.totalLoads} before, ${report.postMigration.totalLoads} after`,
        );
      } else {
        addStep(
          "row-conservation",
          true,
          "No pre-migration baseline — baseline migration creates schema",
        );
      }

      // ── Step 7: No legacy rows remain ───────────────────────────────────────
      const noLegacy = report.postMigration.legacyRowsRemaining === 0;
      addStep(
        "no-legacy-statuses",
        noLegacy,
        noLegacy
          ? "All rows have canonical status values — no legacy PascalCase values remain"
          : `${report.postMigration.legacyRowsRemaining} rows still have legacy status values`,
      );

      // ── Step 8: All statuses are canonical ──────────────────────────────────
      const allCanonical = report.postMigration.nonCanonicalRows === 0;
      addStep(
        "all-statuses-canonical",
        allCanonical,
        allCanonical
          ? "All load rows have canonical status values (draft|planned|dispatched|in_transit|arrived|delivered|completed|cancelled)"
          : `${report.postMigration.nonCanonicalRows} rows have non-canonical status values`,
      );
    } else {
      addStep(
        "post-migration-snapshot",
        true,
        "loads table created by migration — no legacy rows to normalize",
      );
    }

    // ── Step 9: Migration status post-check ─────────────────────────────────
    const statusAfter = await runner.status();
    const noChecksumMismatches = statusAfter.checksumMismatches.length === 0;
    addStep(
      "checksum-integrity",
      noChecksumMismatches,
      noChecksumMismatches
        ? `All ${statusAfter.applied.length} applied migrations have valid checksums`
        : `Checksum mismatches: ${statusAfter.checksumMismatches.join(", ")}`,
      statusAfter,
    );

    // ── Step 10: Table count validation ─────────────────────────────────────
    const [tableCountRows] = await connection.query<mysql.RowDataPacket[]>(`
      SELECT COUNT(*) AS cnt
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
        AND table_type = 'BASE TABLE'
    `);
    const actualTableCount = (tableCountRows[0] as { cnt: number }).cnt;
    const tableCountOk = actualTableCount >= EXPECTED_TABLE_COUNT;
    addStep(
      "table-count-validation",
      tableCountOk,
      tableCountOk
        ? `Table count OK: ${actualTableCount} tables (expected >= ${EXPECTED_TABLE_COUNT}). Highest migration: ${HIGHEST_MIGRATION}`
        : `Table count mismatch: ${actualTableCount} tables found, expected >= ${EXPECTED_TABLE_COUNT}. Highest migration: ${HIGHEST_MIGRATION}`,
      {
        actualTableCount,
        expectedTableCount: EXPECTED_TABLE_COUNT,
        highestMigration: HIGHEST_MIGRATION,
      },
    );

    // ── Step 11: Rollback round-trip (optional) ──────────────────────────────
    if (rollbackTest && statusAfter.applied.length > 0) {
      logger.info("Running rollback round-trip test...");

      // Rollback last migration
      const downResult = await runner.down();
      addStep(
        "rollback-down",
        downResult.rolledBack !== null,
        downResult.rolledBack
          ? `Rolled back: ${downResult.rolledBack}`
          : "Nothing to roll back",
      );

      if (downResult.rolledBack) {
        // Re-apply migrations
        const reapplyResult = await runner.up();
        addStep(
          "rollback-reapply",
          reapplyResult.applied.includes(downResult.rolledBack),
          reapplyResult.applied.includes(downResult.rolledBack)
            ? `Re-applied ${downResult.rolledBack} successfully — rollback round-trip proven`
            : `Re-apply did not include ${downResult.rolledBack}`,
          reapplyResult.applied,
        );

        // Verify integrity after round-trip
        const statusFinal = await runner.status();
        addStep(
          "rollback-round-trip-integrity",
          statusFinal.checksumMismatches.length === 0,
          statusFinal.checksumMismatches.length === 0
            ? "Post-round-trip checksums valid"
            : `Checksum mismatches after round-trip: ${statusFinal.checksumMismatches.join(", ")}`,
        );
      }
    }

    // ── Step 12: Reconciliation smoke check ─────────────────────────────────
    // Check for orphaned records: dispatch_events without valid loads
    const [orphanRows] = await connection.query<mysql.RowDataPacket[]>(`
      SELECT COUNT(*) AS cnt
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
        AND table_name = 'dispatch_events'
    `);
    const dispatchEventsExists = (orphanRows[0] as { cnt: number }).cnt > 0;

    if (dispatchEventsExists) {
      const [orphans] = await connection.query<mysql.RowDataPacket[]>(`
        SELECT COUNT(*) AS cnt
        FROM dispatch_events de
        LEFT JOIN loads l ON de.load_id = l.id
        WHERE l.id IS NULL
      `);
      const orphanCount = (orphans[0] as { cnt: number }).cnt;
      addStep(
        "reconciliation-orphan-check",
        orphanCount === 0,
        orphanCount === 0
          ? "No orphaned dispatch_events — referential integrity intact"
          : `${orphanCount} orphaned dispatch_events found (no corresponding load)`,
      );
    } else {
      addStep(
        "reconciliation-orphan-check",
        true,
        "dispatch_events table not present — skip orphan check",
      );
    }

    // ── Determine overall result ─────────────────────────────────────────────
    const failedSteps = report.steps.filter((s) => !s.passed);
    report.overallPassed = failedSteps.length === 0;
    report.summary = report.overallPassed
      ? `Rehearsal PASSED — ${report.steps.length} steps, ${report.migrationsApplied.length} migrations applied. No data loss. No legacy statuses remain.`
      : `Rehearsal FAILED — ${failedSteps.length} step(s) failed: ${failedSteps.map((s) => s.step).join(", ")}`;

    printReport(report);
    process.exit(report.overallPassed ? 0 : 1);
  } catch (err) {
    addStep(
      "rehearsal-error",
      false,
      `Unexpected error: ${err instanceof Error ? err.message : String(err)}`,
    );
    report.summary = `Rehearsal FAILED with unexpected error: ${err instanceof Error ? err.message : String(err)}`;
    report.overallPassed = false;
    printReport(report);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

function printReport(report: RehearsalReport): void {
  logger.info("\n=== STAGING REHEARSAL REPORT ===");
  logger.info(JSON.stringify(report, null, 2));
  logger.info(`\nOverall: ${report.overallPassed ? "PASS" : "FAIL"}`);
  logger.info(report.summary);
}

main().catch((err) => {
  logger.error({ err }, "Staging rehearsal script failed unexpectedly");
  process.exit(1);
});
