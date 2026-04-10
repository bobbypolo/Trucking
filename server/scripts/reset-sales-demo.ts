/**
 * Sales Demo Reset Script — LoadPilot (DisbatchMe)
 *
 * Tenant-scoped reset that wipes SALES-DEMO-001 data in verified order
 * before re-invoking seedSalesDemo() to produce a clean slate. Refuses
 * to run when DB_NAME looks like a production database.
 *
 * Usage (run from project root):
 *   npm run demo:reset:sales
 *
 * Required env vars in .env.local (same as seed-sales-demo):
 *   DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
 *   SALES_DEMO_ADMIN_FIREBASE_UID
 *   SALES_DEMO_DRIVER_FIREBASE_UID
 *
 * Column names verified against migration 038_accounting_tenant_to_
 * company_id.sql — every accounting and IFTA table uses company_id
 * (renamed from tenant_id by migration 038).
 *
 * Exit codes:
 *   0 — reset + seed completed (including the idempotent second run)
 *   1 — reset failed (see error output)
 */

import * as path from "path";
import dotenv from "dotenv";
import mysql from "mysql2/promise";

import {
  SALES_DEMO_COMPANY_ID,
  SqlExecutor,
  seedSalesDemo,
} from "./seed-sales-demo";

// The reset script shares the .env.local single source of truth with
// seed-sales-demo and certify. We only call dotenv.config here when
// running as a CLI (main); imports from test files keep their own env.
if (require.main === module) {
  dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });
}

// ─── Production guard ─────────────────────────────────────────────────────────

export function assertNotProduction(
  env: NodeJS.ProcessEnv = process.env,
): void {
  const dbName = env.DB_NAME || "";
  if (/prod|production/i.test(dbName)) {
    throw new Error(
      `Refusing to run reset-sales-demo against DB_NAME='${dbName}' — ` +
        "the production guard blocks any database whose name matches /prod|production/i.",
    );
  }
}

// ─── DELETE order (verified against migrations 005, 011, 012, 013, 038) ──────
//
// Order matters: tables without a CASCADE path must be deleted BEFORE
// the companies row. Deleting the companies row relies on FK cascade
// to clean up users, customers, parties, loads, load_legs, etc.
//
// journal_lines has NO company_id column — it must be filtered via its
// parent journal_entries row (FK cascade would clean it anyway but
// explicit deletion keeps the script defensive against partial state).
export const SALES_DEMO_DELETE_SEQUENCE: ReadonlyArray<{
  label: string;
  sql: string;
}> = [
  {
    label: "ifta_trips_audit",
    sql: "DELETE FROM ifta_trips_audit WHERE company_id = ?",
  },
  {
    label: "ifta_trip_evidence",
    sql: "DELETE FROM ifta_trip_evidence WHERE company_id = ?",
  },
  {
    label: "mileage_jurisdiction",
    sql: "DELETE FROM mileage_jurisdiction WHERE company_id = ?",
  },
  {
    label: "fuel_ledger",
    sql: "DELETE FROM fuel_ledger WHERE company_id = ?",
  },
  {
    label: "journal_lines",
    sql:
      "DELETE FROM journal_lines WHERE journal_entry_id IN " +
      "(SELECT id FROM journal_entries WHERE company_id = ?)",
  },
  {
    label: "journal_entries",
    sql: "DELETE FROM journal_entries WHERE company_id = ?",
  },
  {
    label: "ar_invoices",
    sql: "DELETE FROM ar_invoices WHERE company_id = ?",
  },
  {
    label: "ap_bills",
    sql: "DELETE FROM ap_bills WHERE company_id = ?",
  },
  {
    label: "gl_accounts",
    sql: "DELETE FROM gl_accounts WHERE company_id = ?",
  },
  {
    label: "documents",
    sql: "DELETE FROM documents WHERE company_id = ?",
  },
  {
    label: "exceptions",
    sql: "DELETE FROM exceptions WHERE company_id = ?",
  },
  // The final DELETE against companies must be LAST — it cascades to
  // users, customers, parties (after migration 037), party_contacts,
  // party_documents, rate_rows, rate_tiers, constraint_sets,
  // constraint_rules, party_catalog_links, loads, load_legs, equipment.
  {
    label: "companies",
    sql: "DELETE FROM companies WHERE id = ?",
  },
];

// ─── Reset runner ─────────────────────────────────────────────────────────────

export async function resetSalesDemo(
  conn: SqlExecutor,
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  assertNotProduction(env);

  const companyId = SALES_DEMO_COMPANY_ID;

  for (const step of SALES_DEMO_DELETE_SEQUENCE) {
    await conn.execute(step.sql, [companyId]);
  }

  await seedSalesDemo(conn, env);
}

// ─── CLI entry point ──────────────────────────────────────────────────────────

async function main(): Promise<void> {
  try {
    assertNotProduction();
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      multipleStatements: false,
    });
    try {
      await resetSalesDemo(conn as unknown as SqlExecutor);
    } finally {
      await conn.end();
    }
    process.exit(0);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.error(`reset-sales-demo failed: ${msg}`);
    process.exit(1);
  }
}

if (require.main === module) {
  void main();
}
