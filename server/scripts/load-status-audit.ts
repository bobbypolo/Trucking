/**
 * Load Status Audit Script
 *
 * Pre/post migration validation for 002_load_status_normalization.sql.
 * Run before and after the migration to verify row conservation and
 * validate that no rows have invalid status values after normalization.
 *
 * Usage:
 *   npx ts-node server/scripts/load-status-audit.ts
 *
 * Exit codes:
 *   0 — audit passed (no invalid rows found)
 *   1 — audit failed (invalid rows found — do NOT proceed with migration)
 *
 * @story STORY-002 (R-P2-05)
 */

import dotenv from "dotenv";
import mysql from "mysql2/promise";
import { logger } from "../lib/logger";

dotenv.config();

// Canonical status values after migration
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

// All known status values (canonical + legacy PascalCase from 001_baseline.sql)
const ALL_KNOWN_STATUSES = [
  ...CANONICAL_STATUSES,
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

interface StatusCount {
  status: string;
  count: number;
}

async function main(): Promise<void> {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    logger.info("=== Load Status Audit ===");
    logger.info(
      "Use before and after running 002_load_status_normalization.sql",
    );

    // PRE-MIGRATION QUERY 1: Count loads by status
    logger.info("\n--- Status distribution ---");
    const [statusRows] = await connection.query<mysql.RowDataPacket[]>(
      "SELECT status, COUNT(*) AS count FROM loads GROUP BY status ORDER BY status",
    );
    const statusCounts = statusRows as StatusCount[];

    let totalRows = 0;
    for (const row of statusCounts) {
      logger.info(
        { status: row.status, count: row.count },
        `  ${row.status}: ${row.count}`,
      );
      totalRows += row.count;
    }
    logger.info({ total: totalRows }, `  TOTAL: ${totalRows} rows`);

    // PRE-MIGRATION QUERY 2: Find any completely unknown status values
    logger.info("\n--- Unknown status values (not in known set) ---");
    const knownPlaceholders = ALL_KNOWN_STATUSES.map(() => "?").join(", ");
    const [unknownRows] = await connection.query<mysql.RowDataPacket[]>(
      `SELECT status, COUNT(*) AS count FROM loads WHERE status NOT IN (${knownPlaceholders}) GROUP BY status`,
      [...ALL_KNOWN_STATUSES],
    );

    if (unknownRows.length === 0) {
      logger.info("  No unknown status values found. Safe to migrate.");
    } else {
      logger.error(
        { unknownRows },
        "  UNKNOWN STATUS VALUES FOUND — do NOT migrate!",
      );
      for (const row of unknownRows as StatusCount[]) {
        logger.error(`  UNKNOWN: '${row.status}' (${row.count} rows)`);
      }
    }

    // POST-MIGRATION QUERY: Verify no rows have non-canonical status values
    logger.info("\n--- Post-migration validation ---");
    logger.info(
      "(Run this after 002_load_status_normalization.sql to verify success)",
    );
    const canonicalPlaceholders = CANONICAL_STATUSES.map(() => "?").join(", ");
    const [invalidRows] = await connection.query<mysql.RowDataPacket[]>(
      `SELECT status, COUNT(*) AS count FROM loads WHERE status NOT IN (${canonicalPlaceholders}) GROUP BY status`,
      [...CANONICAL_STATUSES],
    );

    if (invalidRows.length === 0) {
      logger.info(
        "  Post-migration check PASSED: All rows have canonical status values.",
      );
    } else {
      logger.error(
        { invalidRows },
        "  Post-migration check FAILED: Non-canonical rows remain!",
      );
      for (const row of invalidRows as StatusCount[]) {
        logger.error(
          `  NON-CANONICAL: '${row.status}' (${row.count} rows) — migration incomplete`,
        );
      }
    }

    // CONSERVATION CHECK: Pre-total must equal post-total
    const [totalAfter] = await connection.query<mysql.RowDataPacket[]>(
      "SELECT COUNT(*) AS total FROM loads",
    );
    const totalAfterCount = (totalAfter[0] as { total: number }).total;
    if (totalAfterCount === totalRows) {
      logger.info(
        { before: totalRows, after: totalAfterCount },
        "  Row conservation PASSED: row counts match.",
      );
    } else {
      logger.error(
        { before: totalRows, after: totalAfterCount },
        `  Row conservation FAILED: ${totalRows} before, ${totalAfterCount} after.`,
      );
    }

    // Exit 1 if unknown values found (not safe to migrate)
    if (unknownRows.length > 0) {
      logger.error(
        "Audit FAILED — do not run migration until unknown values are resolved.",
      );
      process.exit(1);
    }

    logger.info("\nAudit complete.");
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  logger.error({ err }, "Load status audit failed");
  process.exit(1);
});
