/**
 * Applies all pending migrations to the Docker MySQL instance.
 * Idempotent — ignores duplicate key / table already exists errors.
 */
const mysql = require("mysql2/promise");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../server/.env") });

const PROJECT_ROOT = path.resolve(__dirname, "../..");

const MIGRATIONS = [
  "server/migrations/002_load_status_normalization.sql",
  "server/migrations/003_operational_entities.sql",
  "server/migrations/004_idempotency_keys.sql",
  "server/migrations/005_documents_table.sql",
  "server/migrations/006_add_load_legs_lat_lng.sql",
  "server/migrations/007_ocr_results.sql",
  "server/migrations/008_settlements.sql",
  "server/migrations/009_settlement_adjustments.sql",
  "server/migrations/011_accounting_financial_ledger.sql",
  "server/migrations/012_accounting_v3_extensions.sql",
  "server/migrations/013_ifta_intelligence.sql",
  "server/migrations/015_add_users_phone.sql",
  "server/migrations/016_exception_management.sql",
];

const IGNORABLE_CODES = new Set([
  "ER_DUP_KEYNAME",
  "ER_TABLE_EXISTS_ERROR",
  "ER_DUP_FIELDNAME",
  "ER_CANT_DROP_FIELD_OR_KEY",
]);

function extractUpSection(content) {
  const lines = content.split("\n");
  let inUp = false;
  const upLines = [];
  for (const line of lines) {
    const stripped = line.trim();
    if (stripped === "-- UP") { inUp = true; continue; }
    if (stripped === "-- DOWN") break;
    if (inUp) upLines.push(line);
  }
  return upLines.length > 0 ? upLines.join("\n") : content;
}

async function main() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || "127.0.0.1",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "root",
    database: process.env.DB_NAME || "trucklogix",
  });

  let applied = 0;
  for (const relPath of MIGRATIONS) {
    const migFile = path.join(PROJECT_ROOT, relPath);
    if (!fs.existsSync(migFile)) {
      console.log("SKIP (not found):", relPath);
      continue;
    }
    const content = fs.readFileSync(migFile, "utf-8");
    const sql = extractUpSection(content);
    const stmts = sql
      .split(";")
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith("--"));

    let errors = 0;
    for (const stmt of stmts) {
      try {
        await pool.query(stmt);
      } catch (e) {
        if (!IGNORABLE_CODES.has(e.code) && !e.message.includes("Duplicate key name") && !e.message.includes("already exists") && !e.message.includes("IF NOT EXISTS")) {
          console.log("  WARN:", e.code, e.message.slice(0, 100));
          errors++;
        }
      }
    }
    console.log("Applied:", path.basename(migFile), errors > 0 ? "(with " + errors + " warnings)" : "OK");
    applied++;
  }

  console.log("\nTotal migrations processed:", applied);

  // Verify accounting tables
  const [tables] = await pool.query("SHOW TABLES");
  const names = tables.map(t => Object.values(t)[0]);
  const REQUIRED = [
    "gl_accounts", "journal_entries", "journal_lines",
    "ar_invoices", "ar_invoice_lines",
    "ap_bills", "ap_bill_lines",
    "driver_settlements", "settlement_lines",
    "document_vault", "ifta_trips_audit",
    "mileage_jurisdiction", "fuel_ledger",
    "ifta_trip_evidence", "adjustment_entries", "sync_qb_log"
  ];
  const found = REQUIRED.filter(t => names.includes(t));
  const missing = REQUIRED.filter(t => !names.includes(t));
  console.log("Accounting tables found:", found.length + "/" + REQUIRED.length);
  if (missing.length > 0) {
    console.log("Missing tables:", missing.join(", "));
  }

  await pool.end();
}

main().catch(e => { console.error("Migration failed:", e.message); process.exit(1); });
