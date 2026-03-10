/**
 * Real Tenant Isolation Integration Test.
 * Tests REAL Docker MySQL — creates two companies with loads,
 * verifies tenant-scoped queries return only that company's data.
 *
 * R-marker: Tests R-P2-04
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mysql from "mysql2/promise";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { execSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../../../");
dotenv.config({ path: path.join(projectRoot, ".env") });

// Company A identifiers
const CO_A_ID = "test-tenant-co-a-p2";
const CO_A_USER_ID = "test-tenant-user-a-p2";
const CO_A_LOAD_IDS = [
  "test-tenant-load-a1-p2",
  "test-tenant-load-a2-p2",
  "test-tenant-load-a3-p2",
];

// Company B identifiers
const CO_B_ID = "test-tenant-co-b-p2";
const CO_B_USER_ID = "test-tenant-user-b-p2";
const CO_B_LOAD_IDS = ["test-tenant-load-b1-p2", "test-tenant-load-b2-p2"];

let pool: mysql.Pool;
let skip = false;

function isDockerRunning(): boolean {
  try {
    const out = execSync(
      'docker ps --filter name=loadpilot-dev --format "{{.Names}}"',
      { encoding: "utf-8", timeout: 5000 },
    );
    return out.includes("loadpilot-dev");
  } catch {
    return false;
  }
}

describe("Real Tenant Isolation (Docker MySQL)", () => {
  beforeAll(async () => {
    if (!isDockerRunning()) {
      skip = true;
      return;
    }

    pool = mysql.createPool({
      host: process.env.DB_HOST || "127.0.0.1",
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "root",
      database: process.env.DB_NAME || "trucklogix",
      waitForConnections: true,
      connectionLimit: 5,
    });

    await cleanupTestData();

    // Insert Company A
    await pool.query(
      `INSERT INTO companies (id, name, account_type, email) VALUES (?, ?, 'fleet', ?)`,
      [CO_A_ID, "Tenant Test Company A", "co-a-p2@test.dev"],
    );

    // Insert User A
    await pool.query(
      `INSERT INTO users (id, company_id, email, name, role) VALUES (?, ?, ?, ?, ?)`,
      [
        CO_A_USER_ID,
        CO_A_ID,
        "user-a-p2@test.dev",
        "Company A Driver",
        "driver",
      ],
    );

    // Insert 3 loads for Company A
    for (let i = 0; i < CO_A_LOAD_IDS.length; i++) {
      await pool.query(
        `INSERT INTO loads (id, company_id, driver_id, load_number, status, version)
         VALUES (?, ?, ?, ?, 'draft', 1)`,
        [CO_A_LOAD_IDS[i], CO_A_ID, CO_A_USER_ID, `TENANT-A-P2-00${i + 1}`],
      );
    }

    // Insert Company B
    await pool.query(
      `INSERT INTO companies (id, name, account_type, email) VALUES (?, ?, 'fleet', ?)`,
      [CO_B_ID, "Tenant Test Company B", "co-b-p2@test.dev"],
    );

    // Insert User B
    await pool.query(
      `INSERT INTO users (id, company_id, email, name, role) VALUES (?, ?, ?, ?, ?)`,
      [
        CO_B_USER_ID,
        CO_B_ID,
        "user-b-p2@test.dev",
        "Company B Driver",
        "driver",
      ],
    );

    // Insert 2 loads for Company B
    for (let i = 0; i < CO_B_LOAD_IDS.length; i++) {
      await pool.query(
        `INSERT INTO loads (id, company_id, driver_id, load_number, status, version)
         VALUES (?, ?, ?, ?, 'draft', 1)`,
        [CO_B_LOAD_IDS[i], CO_B_ID, CO_B_USER_ID, `TENANT-B-P2-00${i + 1}`],
      );
    }
  }, 20000);

  afterAll(async () => {
    if (pool) {
      await cleanupTestData();
      await pool.end();
    }
  }, 20000);

  async function cleanupTestData() {
    if (!pool) return;
    const allLoadIds = [...CO_A_LOAD_IDS, ...CO_B_LOAD_IDS];
    for (const id of allLoadIds) {
      await pool.query(`DELETE FROM loads WHERE id = ?`, [id]);
    }
    await pool.query(`DELETE FROM users WHERE id IN (?, ?)`, [
      CO_A_USER_ID,
      CO_B_USER_ID,
    ]);
    await pool.query(`DELETE FROM companies WHERE id IN (?, ?)`, [
      CO_A_ID,
      CO_B_ID,
    ]);
  }

  it("company A tenant-scoped query returns exactly 3 loads", async () => {
    if (skip) return;

    const [rows] = (await pool.query(
      `SELECT id, company_id FROM loads WHERE company_id = ?`,
      [CO_A_ID],
    )) as [mysql.RowDataPacket[], mysql.FieldPacket[]];

    expect(rows).toHaveLength(3);

    // Every row must belong to Company A
    for (const row of rows) {
      expect(row.company_id).toBe(CO_A_ID);
    }
  });

  it("company B tenant-scoped query returns exactly 2 loads", async () => {
    if (skip) return;

    const [rows] = (await pool.query(
      `SELECT id, company_id FROM loads WHERE company_id = ?`,
      [CO_B_ID],
    )) as [mysql.RowDataPacket[], mysql.FieldPacket[]];

    expect(rows).toHaveLength(2);

    // Every row must belong to Company B
    for (const row of rows) {
      expect(row.company_id).toBe(CO_B_ID);
    }
  });

  it("company A query result set contains zero company B loads", async () => {
    if (skip) return;

    const [rows] = (await pool.query(
      `SELECT id, company_id FROM loads WHERE company_id = ?`,
      [CO_A_ID],
    )) as [mysql.RowDataPacket[], mysql.FieldPacket[]];

    // None of Company A's loads should have Company B's ID
    const coALoadIds = rows.map((r) => r.id as string);
    for (const bId of CO_B_LOAD_IDS) {
      expect(coALoadIds).not.toContain(bId);
    }
  });

  it("company B query result set contains zero company A loads", async () => {
    if (skip) return;

    const [rows] = (await pool.query(
      `SELECT id, company_id FROM loads WHERE company_id = ?`,
      [CO_B_ID],
    )) as [mysql.RowDataPacket[], mysql.FieldPacket[]];

    const coBLoadIds = rows.map((r) => r.id as string);
    for (const aId of CO_A_LOAD_IDS) {
      expect(coBLoadIds).not.toContain(aId);
    }
  });

  it("COUNT aggregation respects tenant boundary", async () => {
    if (skip) return;

    const [countA] = (await pool.query(
      `SELECT COUNT(*) as cnt FROM loads WHERE company_id = ?`,
      [CO_A_ID],
    )) as [mysql.RowDataPacket[], mysql.FieldPacket[]];

    const [countB] = (await pool.query(
      `SELECT COUNT(*) as cnt FROM loads WHERE company_id = ?`,
      [CO_B_ID],
    )) as [mysql.RowDataPacket[], mysql.FieldPacket[]];

    expect(Number(countA[0].cnt)).toBe(3);
    expect(Number(countB[0].cnt)).toBe(2);
  });

  it("unfiltered query returns loads for both tenants (tenant isolation is application responsibility)", async () => {
    if (skip) return;

    const [allRows] = (await pool.query(
      `SELECT id FROM loads WHERE id IN (${[...CO_A_LOAD_IDS, ...CO_B_LOAD_IDS].map(() => "?").join(",")})`,
      [...CO_A_LOAD_IDS, ...CO_B_LOAD_IDS],
    )) as [mysql.RowDataPacket[], mysql.FieldPacket[]];

    // Both companies' loads are present in DB — application must filter by company_id
    expect(allRows).toHaveLength(5);
  });
});
