/**
 * Verifies firebase_uid linkage in the local MySQL DB.
 * Replaces the mysql CLI check for STORY-002 gate validation.
 *
 * Checks:
 *   1. COUNT(*) FROM users WHERE firebase_uid IS NOT NULL > 0
 *   2. No duplicate firebase_uid values (HAVING cnt > 1 returns 0 rows)
 *
 * Exits 0 on success, 1 on failure.
 */
const mysql = require("mysql2/promise");
require("dotenv").config({ path: require("path").resolve(__dirname, "../../server/.env") });

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || "127.0.0.1",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "root",
    database: process.env.DB_NAME || "trucklogix",
    connectTimeout: 10000,
  });

  try {
    // Check 1: COUNT(*) WHERE firebase_uid IS NOT NULL > 0
    const [r1] = await conn.query(
      "SELECT COUNT(*) as linked_users FROM users WHERE firebase_uid IS NOT NULL"
    );
    const linkedCount = r1[0].linked_users;
    console.log("linked_users:", linkedCount);

    if (linkedCount === 0) {
      throw new Error("R-P2-02 FAIL: No users with firebase_uid (linked_users=0)");
    }

    // Check 2: No duplicate UIDs
    const [r2] = await conn.query(
      `SELECT firebase_uid, COUNT(*) as cnt
         FROM users
        WHERE firebase_uid IS NOT NULL
        GROUP BY firebase_uid
       HAVING cnt > 1`
    );
    console.log("duplicate_uid_rows:", r2.length);

    if (r2.length > 0) {
      throw new Error(
        "R-P2-03 FAIL: Duplicate firebase_uid values found: " +
        JSON.stringify(r2.map(r => r.firebase_uid))
      );
    }

    console.log("PASS: firebase_uid linkage verified (linked=" + linkedCount + ", duplicates=0)");
  } finally {
    await conn.end();
  }
}

main().catch(e => { console.error("FAIL:", e.message); process.exit(1); });
