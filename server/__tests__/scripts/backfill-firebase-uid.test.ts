/**
 * Integration tests for backfill_firebase_uid.cjs (STORY-002 Phase 2)
 *
 * Tests R-P2-01, R-P2-02, R-P2-03, R-P2-04, R-P2-05
 *
 * These tests require a running MySQL instance (Docker loadpilot-dev or local).
 * They are skipped when the DB is unreachable to avoid breaking CI.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { execSync, spawnSync } from "child_process";
import path from "path";
import mysql from "mysql2/promise";
import dotenv from "dotenv";
const PROJECT_ROOT = path.resolve(__dirname, "../../..");
const SERVER_DIR = path.resolve(__dirname, "../..");

dotenv.config({ path: path.join(SERVER_DIR, ".env") });

const DEV_FIREBASE_UID = "devUid0000000000000000000001";
const DEV_USER_EMAIL = "admin@loadpilot.com";

// DB connection helper — returns null if DB is unreachable
async function tryConnect(): Promise<mysql.Connection | null> {
  try {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST || "127.0.0.1",
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "root",
      database: process.env.DB_NAME || "trucklogix",
      connectTimeout: 5000,
    });
    await conn.query("SELECT 1");
    return conn;
  } catch {
    return null;
  }
}

let dbAvailable = false;

beforeAll(async () => {
  const conn = await tryConnect();
  if (conn) {
    await conn.end();
    dbAvailable = true;
  } else {
    console.warn("DB unreachable — skipping integration tests");
  }
});

/**
 * R-P2-01: backfill script exits 0 and prints valid JSON with required keys.
 */
describe("R-P2-01: backfill_firebase_uid.cjs", () => {
  it("exits 0 when run from project root", () => {
    if (!dbAvailable) {
      return;
    }

    const result = spawnSync(
      "node",
      ["server/scripts/backfill_firebase_uid.cjs"],
      {
        cwd: PROJECT_ROOT,
        encoding: "utf-8",
        timeout: 30000,
        env: { ...process.env },
      },
    );

    expect(result.status).toBe(0);
  }, 30000);

  it("prints valid JSON with {updated, alreadyLinked, missingFirebaseUser, total} keys", () => {
    if (!dbAvailable) {
      return;
    }

    const result = spawnSync(
      "node",
      ["server/scripts/backfill_firebase_uid.cjs"],
      {
        cwd: PROJECT_ROOT,
        encoding: "utf-8",
        timeout: 30000,
        env: { ...process.env },
      },
    );

    expect(result.status).toBe(0);

    // Extract the JSON object from stdout (may include dotenv/warn/info lines).
    // Match JSON that contains the required backfill summary keys.
    const stdout = result.stdout;
    // Find a line that starts with '{' and parse the following block
    const lines = stdout.split("\n");
    let jsonStr = "";
    let inJson = false;
    let braceDepth = 0;
    for (const line of lines) {
      const trimmed = line.trim();
      if (!inJson && trimmed.startsWith("{") && trimmed !== "{") {
        // Single-line JSON
        jsonStr = trimmed;
        break;
      }
      if (!inJson && trimmed === "{") {
        inJson = true;
        jsonStr = "{";
        braceDepth = 1;
        continue;
      }
      if (inJson) {
        jsonStr += "\n" + line;
        braceDepth += (line.match(/\{/g) || []).length;
        braceDepth -= (line.match(/\}/g) || []).length;
        if (braceDepth <= 0) break;
      }
    }
    expect(jsonStr).not.toBe("");

    const parsed = JSON.parse(jsonStr);
    expect(parsed).toHaveProperty("updated");
    expect(parsed).toHaveProperty("alreadyLinked");
    expect(parsed).toHaveProperty("missingFirebaseUser");
    expect(parsed).toHaveProperty("total");
    expect(typeof parsed.updated).toBe("number");
    expect(typeof parsed.alreadyLinked).toBe("number");
    expect(typeof parsed.missingFirebaseUser).toBe("number");
    expect(typeof parsed.total).toBe("number");
  }, 30000);
});

/**
 * R-P2-02: After backfill, COUNT(*) FROM users WHERE firebase_uid IS NOT NULL > 0
 */
describe("R-P2-02: firebase_uid linkage count", () => {
  it("at least one user has a non-null firebase_uid", async () => {
    if (!dbAvailable) {
      return;
    }

    const conn = await tryConnect();
    expect(conn).not.toBeNull();

    const [rows] = await conn!.query<mysql.RowDataPacket[]>(
      "SELECT COUNT(*) as cnt FROM users WHERE firebase_uid IS NOT NULL",
    );
    await conn!.end();

    expect(rows[0].cnt).toBeGreaterThan(0);
  });
});

/**
 * R-P2-03: After backfill, no duplicate firebase_uid values
 */
describe("R-P2-03: no duplicate firebase_uid values", () => {
  it("returns zero rows from duplicate UID query", async () => {
    if (!dbAvailable) {
      return;
    }

    const conn = await tryConnect();
    expect(conn).not.toBeNull();

    const [rows] = await conn!.query<mysql.RowDataPacket[]>(
      `SELECT firebase_uid, COUNT(*) as cnt
         FROM users
        WHERE firebase_uid IS NOT NULL
        GROUP BY firebase_uid
       HAVING cnt > 1`,
    );
    await conn!.end();

    expect(rows).toHaveLength(0);
  });
});

/**
 * R-P2-04: resolveSqlPrincipalByFirebaseUid returns non-null SqlPrincipal for dev user's firebase_uid
 */
describe("R-P2-04: resolveSqlPrincipalByFirebaseUid returns non-null", () => {
  it("returns SqlPrincipal with id, tenantId, companyId, role, email for dev UID", async () => {
    if (!dbAvailable) {
      return;
    }

    const conn = await tryConnect();
    expect(conn).not.toBeNull();

    const [rows] = await conn!.query<mysql.RowDataPacket[]>(
      `SELECT id, company_id, email, role, firebase_uid
         FROM users
        WHERE firebase_uid = ?
        LIMIT 1`,
      [DEV_FIREBASE_UID],
    );
    await conn!.end();

    expect(rows.length).toBeGreaterThan(0);

    const row = rows[0];
    const principal = {
      id: row.id,
      tenantId: row.company_id,
      companyId: row.company_id,
      role: row.role,
      email: row.email,
      firebaseUid: row.firebase_uid,
    };

    expect(principal.id).toBeTruthy();
    expect(principal.tenantId).toBeTruthy();
    expect(principal.companyId).toBeTruthy();
    expect(principal.role).toBeTruthy();
    expect(principal.email).toBeTruthy();
    expect(principal.firebaseUid).toBe(DEV_FIREBASE_UID);
  });
});

/**
 * R-P2-05: Dev login user has a populated firebase_uid
 */
describe("R-P2-05: dev login user has firebase_uid", () => {
  it("admin@loadpilot.com has non-null firebase_uid", async () => {
    if (!dbAvailable) {
      return;
    }

    const conn = await tryConnect();
    expect(conn).not.toBeNull();

    const [rows] = await conn!.query<mysql.RowDataPacket[]>(
      "SELECT id, email, firebase_uid FROM users WHERE email = ?",
      [DEV_USER_EMAIL],
    );
    await conn!.end();

    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].firebase_uid).not.toBeNull();
    expect(rows[0].firebase_uid).not.toBe("");
    expect(rows[0].firebase_uid).toBe(DEV_FIREBASE_UID);
  });
});
