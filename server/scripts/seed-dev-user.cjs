/**
 * Seed a dev admin user with a known firebase_uid for local development.
 * This script creates the minimal DB records needed for Phase 2 validation
 * without requiring a live Firebase service account.
 *
 * Safe to run multiple times (idempotent via INSERT IGNORE / ON DUPLICATE KEY UPDATE).
 *
 * Usage: node server/scripts/seed-dev-user.cjs
 */
const mysql = require("mysql2/promise");
const crypto = require("crypto");
require("dotenv").config({ path: require("path").resolve(__dirname, "../../server/.env") });

// Stable dev seed constants — these are LOCAL DEV ONLY, not production secrets.
const DEV_COMPANY_ID = "dev-company-001";
const DEV_USER_ID = "dev-user-001";
const DEV_USER_EMAIL = "admin@loadpilot.com";
const DEV_USER_NAME = "Dev Admin";
const DEV_USER_ROLE = "admin";
// Simulated Firebase UID — format matches real Firebase UIDs (28-char alphanumeric).
// In a real environment this would come from Firebase Auth.
const DEV_FIREBASE_UID = "devUid0000000000000000000001";

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || "127.0.0.1",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "root",
    database: process.env.DB_NAME || "trucklogix",
  });

  try {
    // 1. Ensure dev company exists
    await conn.query(
      `INSERT INTO companies (id, name, account_type, email)
       VALUES (?, ?, 'fleet', ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name)`,
      [DEV_COMPANY_ID, "LoadPilot Dev Co", "dev@loadpilot.com"]
    );
    console.log("Dev company ensured:", DEV_COMPANY_ID);

    // 2. Ensure dev user exists with firebase_uid set
    await conn.query(
      `INSERT INTO users (id, company_id, email, name, role, firebase_uid)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         firebase_uid = COALESCE(VALUES(firebase_uid), firebase_uid),
         name = VALUES(name)`,
      [DEV_USER_ID, DEV_COMPANY_ID, DEV_USER_EMAIL, DEV_USER_NAME, DEV_USER_ROLE, DEV_FIREBASE_UID]
    );
    console.log("Dev user ensured:", DEV_USER_EMAIL, "->", DEV_FIREBASE_UID);

    // 3. Verify
    const [rows] = await conn.query(
      "SELECT id, email, firebase_uid FROM users WHERE email = ?",
      [DEV_USER_EMAIL]
    );
    if (rows.length === 0) throw new Error("Dev user not found after insert");
    if (!rows[0].firebase_uid) throw new Error("firebase_uid is NULL after insert");

    console.log("Verified:", JSON.stringify(rows[0]));
    console.log("DEV_LOGIN_EMAIL=" + DEV_USER_EMAIL);
    console.log("DEV_FIREBASE_UID=" + DEV_FIREBASE_UID);
  } finally {
    await conn.end();
  }
}

main().catch(e => { console.error("Seed failed:", e.message); process.exit(1); });
