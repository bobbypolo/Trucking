/**
 * Applies all pending migrations to the Docker MySQL instance.
 * Idempotent — ignores duplicate key / table already exists errors.
 */
const mysql = require("mysql2/promise");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env.local"), override: false });
require("dotenv").config({ path: path.resolve(__dirname, "../../.env"), override: false });
require("dotenv").config({ path: path.resolve(__dirname, "../../server/.env"), override: false });

const PROJECT_ROOT = path.resolve(__dirname, "../..");

// Auto-discover all .sql files in server/migrations/ sorted by filename.
// This replaces the old hardcoded list that was missing 001_baseline.sql
// and 30+ other migrations, causing CI to fail on a fresh database.
const MIGRATIONS_DIR = path.join(PROJECT_ROOT, "server", "migrations");
const MIGRATIONS = fs.readdirSync(MIGRATIONS_DIR)
  .filter(f => f.endsWith(".sql"))
  .sort()
  .map(f => path.join("server", "migrations", f));

const IGNORABLE_CODES = new Set([
  "ER_DUP_KEYNAME",
  "ER_TABLE_EXISTS_ERROR",
  "ER_DUP_FIELDNAME",
  "ER_CANT_DROP_FIELD_OR_KEY",
  "ER_NO_SUCH_TABLE",
  "ER_BAD_FIELD_ERROR",
  "ER_DUP_ENTRY",
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
    const rawSql = extractUpSection(content);
    // Strip full-line comments BEFORE splitting by ";" so that
    // semicolons inside comments (e.g. "does NOT rewrite; GET...")
    // don't cause false statement splits.
    const sql = rawSql
      .split("\n")
      .filter(line => !line.trim().startsWith("--"))
      .join("\n");
    const stmts = sql
      .split(";")
      .map(s => s.trim())
      .filter(s => s.length > 0);

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
