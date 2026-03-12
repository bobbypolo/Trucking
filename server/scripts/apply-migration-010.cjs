/**
 * One-time script to apply migration 010 (add firebase_uid to users).
 * Safe to run multiple times (uses IF NOT EXISTS).
 */
const mysql = require("mysql2/promise");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../server/.env") });

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || "127.0.0.1",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "root",
    database: process.env.DB_NAME || "trucklogix",
  });

  const migPath = path.resolve(__dirname, "../migrations/010_add_firebase_uid_to_users.sql");
  const content = fs.readFileSync(migPath, "utf-8");

  // Extract UP section
  const lines = content.split("\n");
  let inUp = false;
  const upLines = [];
  for (const line of lines) {
    const stripped = line.trim();
    if (stripped === "-- UP") { inUp = true; continue; }
    if (stripped === "-- DOWN") break;
    if (inUp) upLines.push(line);
  }
  const sql = upLines.join("\n");

  // Check if firebase_uid already exists before applying
  const [existingCols] = await conn.query("SHOW COLUMNS FROM users LIKE 'firebase_uid'");
  if (existingCols.length > 0) {
    console.log("Column firebase_uid already exists — skipping ADD COLUMN");
  } else {
    // Apply ADD COLUMN (without IF NOT EXISTS — not supported in MySQL 8.4)
    await conn.query("ALTER TABLE users ADD COLUMN firebase_uid VARCHAR(128) NULL AFTER email");
    console.log("Added firebase_uid column");
  }

  // Check if unique key already exists
  const [existingKeys] = await conn.query(
    "SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND INDEX_NAME = 'uq_users_firebase_uid'",
    [process.env.DB_NAME || "trucklogix"]
  );
  if (existingKeys.length > 0) {
    console.log("Unique key uq_users_firebase_uid already exists — skipping");
  } else {
    await conn.query("ALTER TABLE users ADD UNIQUE KEY uq_users_firebase_uid (firebase_uid)");
    console.log("Added unique key uq_users_firebase_uid");
  }

  const [cols] = await conn.query("SHOW COLUMNS FROM users LIKE 'firebase_uid'");
  if (cols.length === 0) throw new Error("firebase_uid column missing after migration");
  console.log("Migration 010: firebase_uid column verified");
  await conn.end();
}

main().catch(e => { console.error("Migration failed:", e.message); process.exit(1); });
