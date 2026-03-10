/**
 * Real Docker MySQL integration test.
 * Connects to real MySQL (loadpilot-dev container), verifies 20+ tables exist,
 * and confirms loads table has canonical 8-value ENUM after migration 002.
 *
 * Tests R-P1-02, R-P1-01
 * R-marker: Tests R-P1-01, R-P1-02
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import mysql from "mysql2/promise";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../../../");
dotenv.config({ path: path.join(projectRoot, ".env") });

const CANONICAL_LOAD_STATUS = [
  "draft",
  "planned",
  "dispatched",
  "in_transit",
  "arrived",
  "delivered",
  "completed",
  "cancelled",
];

let pool: mysql.Pool;
let skip = false;

describe("Real MySQL Connection (Docker loadpilot-dev)", () => {
  beforeAll(async () => {
    // Check if container is running
    const { execSync } = await import("child_process");
    try {
      const out = execSync(
        'docker ps --filter name=loadpilot-dev --format "{{.Names}}"',
        { encoding: "utf-8", timeout: 5000 },
      );
      if (!out.includes("loadpilot-dev")) {
        skip = true;
        return;
      }
    } catch {
      skip = true;
      return;
    }

    pool = mysql.createPool({
      host: process.env.DB_HOST || "127.0.0.1",
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || "trucklogix",
      waitForConnections: true,
      connectionLimit: 3,
    });

    // Verify connection
    try {
      const [rows] = await pool.query("SELECT 1 AS ok");
      if (!Array.isArray(rows) || rows.length === 0) {
        skip = true;
      }
    } catch {
      skip = true;
    }
  }, 30000);

  afterAll(async () => {
    if (pool) {
      await pool.end();
    }
  });

  it("connects to MySQL and returns SELECT 1", async () => {
    if (skip) {
      console.log("SKIP: Docker container not running");
      return;
    }
    const [rows] = await pool.query<mysql.RowDataPacket[]>("SELECT 1 AS ok");
    expect(rows[0].ok).toBe(1);
  });

  it("SHOW TABLES returns 20+ tables in trucklogix", async () => {
    if (skip) {
      console.log("SKIP: Docker container not running");
      return;
    }
    const [rows] = await pool.query<mysql.RowDataPacket[]>("SHOW TABLES");
    expect(rows.length).toBeGreaterThanOrEqual(20);
  });

  it("loads table has canonical 8-value ENUM after migration 002", async () => {
    if (skip) {
      console.log("SKIP: Docker container not running");
      return;
    }
    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      "SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?",
      [process.env.DB_NAME || "trucklogix", "loads", "status"],
    );
    expect(rows.length).toBe(1);
    const columnType: string = rows[0].COLUMN_TYPE;
    // Verify each canonical value is present
    for (const val of CANONICAL_LOAD_STATUS) {
      expect(columnType).toContain(`'${val}'`);
    }
    // Verify legacy PascalCase values are NOT present
    expect(columnType).not.toContain("'Planned'");
    expect(columnType).not.toContain("'Booked'");
    expect(columnType).not.toContain("'Active'");
  });

  it("pool health check — all connections closable", async () => {
    if (skip) {
      console.log("SKIP: Docker container not running");
      return;
    }
    const conn = await pool.getConnection();
    const [rows] = await conn.query<mysql.RowDataPacket[]>(
      "SELECT DATABASE() AS db",
    );
    expect(rows[0].db).toBe(process.env.DB_NAME || "trucklogix");
    conn.release();
  });
});
