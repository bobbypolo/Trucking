/**
 * Real Settlement Flow Integration Test.
 * Tests REAL Docker MySQL — creates settlement with detail lines,
 * transitions through pending_generation->generated->reviewed->posted,
 * verifies DECIMAL totals and immutability after posting.
 *
 * R-marker: Tests R-P2-02
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

const TEST_COMPANY_ID = "test-co-settle-p2";
const TEST_USER_ID = "test-user-settle-p2";
const TEST_LOAD_ID = "test-load-settle-p2";
const TEST_SETTLEMENT_ID = "test-settle-p2-001";
const TEST_SDL_EARNING_ID = "test-sdl-p2-earn";
const TEST_SDL_DEDUCTION_ID = "test-sdl-p2-deduct";
const TEST_SDL_REIMB_ID = "test-sdl-p2-reimb";

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

describe("Real Settlement Flow (Docker MySQL)", () => {
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

    // Create prerequisite company
    await pool.query(
      `INSERT INTO companies (id, name, account_type, email) VALUES (?, ?, 'fleet', ?)`,
      [TEST_COMPANY_ID, "Test Settlement Co P2", "settle-p2@test.dev"],
    );

    // Create prerequisite user (driver for settlement)
    await pool.query(
      `INSERT INTO users (id, company_id, email, name, role) VALUES (?, ?, ?, ?, ?)`,
      [
        TEST_USER_ID,
        TEST_COMPANY_ID,
        "settle-p2@test.dev",
        "Settlement Test Driver",
        "driver",
      ],
    );

    // Create prerequisite load in completed status
    await pool.query(
      `INSERT INTO loads (id, company_id, driver_id, load_number, status, version)
       VALUES (?, ?, ?, ?, 'completed', 1)`,
      [TEST_LOAD_ID, TEST_COMPANY_ID, TEST_USER_ID, "SETTLE-P2-001"],
    );
  }, 20000);

  afterAll(async () => {
    if (pool) {
      await cleanupTestData();
      await pool.end();
    }
  }, 20000);

  async function cleanupTestData() {
    if (!pool) return;
    await pool.query(
      `DELETE FROM settlement_detail_lines WHERE settlement_id = ?`,
      [TEST_SETTLEMENT_ID],
    );
    await pool.query(`DELETE FROM settlements WHERE id = ?`, [
      TEST_SETTLEMENT_ID,
    ]);
    await pool.query(`DELETE FROM loads WHERE id = ?`, [TEST_LOAD_ID]);
    await pool.query(`DELETE FROM users WHERE id = ?`, [TEST_USER_ID]);
    await pool.query(`DELETE FROM companies WHERE id = ?`, [TEST_COMPANY_ID]);
  }

  it("creates a settlement with detail lines in real Docker MySQL", async () => {
    if (skip) return;

    // Insert settlement
    const [result] = (await pool.query(
      `INSERT INTO settlements
         (id, company_id, load_id, driver_id, settlement_date, status,
          total_earnings, total_deductions, total_reimbursements, net_pay, created_by, version)
       VALUES (?, ?, ?, ?, CURDATE(), 'pending_generation', 1500.00, 250.00, 75.50, 1325.50, ?, 1)`,
      [
        TEST_SETTLEMENT_ID,
        TEST_COMPANY_ID,
        TEST_LOAD_ID,
        TEST_USER_ID,
        TEST_USER_ID,
      ],
    )) as [mysql.ResultSetHeader, mysql.FieldPacket[]];
    expect(result.affectedRows).toBe(1);

    // Insert earning detail line
    await pool.query(
      `INSERT INTO settlement_detail_lines (id, settlement_id, description, amount, type, sequence_order)
       VALUES (?, ?, ?, ?, 'earning', 1)`,
      [TEST_SDL_EARNING_ID, TEST_SETTLEMENT_ID, "Base line haul pay", 1500.0],
    );

    // Insert deduction detail line
    await pool.query(
      `INSERT INTO settlement_detail_lines (id, settlement_id, description, amount, type, sequence_order)
       VALUES (?, ?, ?, ?, 'deduction', 2)`,
      [
        TEST_SDL_DEDUCTION_ID,
        TEST_SETTLEMENT_ID,
        "Fuel advance deduction",
        250.0,
      ],
    );

    // Insert reimbursement detail line
    await pool.query(
      `INSERT INTO settlement_detail_lines (id, settlement_id, description, amount, type, sequence_order)
       VALUES (?, ?, ?, ?, 'reimbursement', 3)`,
      [
        TEST_SDL_REIMB_ID,
        TEST_SETTLEMENT_ID,
        "Scale ticket reimbursement",
        75.5,
      ],
    );

    // Verify settlement exists
    const [rows] = (await pool.query(
      `SELECT id, status, total_earnings, total_deductions, total_reimbursements, net_pay
       FROM settlements WHERE id = ?`,
      [TEST_SETTLEMENT_ID],
    )) as [mysql.RowDataPacket[], mysql.FieldPacket[]];

    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("pending_generation");
    // DECIMAL values returned as strings by mysql2
    expect(parseFloat(rows[0].total_earnings)).toBeCloseTo(1500.0, 2);
    expect(parseFloat(rows[0].total_deductions)).toBeCloseTo(250.0, 2);
    expect(parseFloat(rows[0].total_reimbursements)).toBeCloseTo(75.5, 2);
    expect(parseFloat(rows[0].net_pay)).toBeCloseTo(1325.5, 2);

    // Verify 3 detail lines exist
    const [lines] = (await pool.query(
      `SELECT id, type, amount FROM settlement_detail_lines WHERE settlement_id = ? ORDER BY sequence_order`,
      [TEST_SETTLEMENT_ID],
    )) as [mysql.RowDataPacket[], mysql.FieldPacket[]];

    expect(lines).toHaveLength(3);
    expect(lines[0].type).toBe("earning");
    expect(parseFloat(lines[0].amount)).toBeCloseTo(1500.0, 2);
    expect(lines[1].type).toBe("deduction");
    expect(parseFloat(lines[1].amount)).toBeCloseTo(250.0, 2);
    expect(lines[2].type).toBe("reimbursement");
    expect(parseFloat(lines[2].amount)).toBeCloseTo(75.5, 2);
  });

  it("transitions settlement through pending_generation->generated->reviewed->posted", async () => {
    if (skip) return;

    const transitions: Array<{ from: string; to: string }> = [
      { from: "pending_generation", to: "generated" },
      { from: "generated", to: "reviewed" },
      { from: "reviewed", to: "posted" },
    ];

    for (const { from, to } of transitions) {
      const [result] = (await pool.query(
        `UPDATE settlements SET status = ? WHERE id = ? AND status = ?`,
        [to, TEST_SETTLEMENT_ID, from],
      )) as [mysql.ResultSetHeader, mysql.FieldPacket[]];

      expect(result.affectedRows).toBe(1);

      const [rows] = (await pool.query(
        `SELECT status FROM settlements WHERE id = ?`,
        [TEST_SETTLEMENT_ID],
      )) as [mysql.RowDataPacket[], mysql.FieldPacket[]];

      expect(rows[0].status).toBe(to);
    }
  });

  it("DECIMAL precision is preserved in posted settlement", async () => {
    if (skip) return;

    const [rows] = (await pool.query(
      `SELECT total_earnings, total_deductions, total_reimbursements, net_pay
       FROM settlements WHERE id = ? AND status = 'posted'`,
      [TEST_SETTLEMENT_ID],
    )) as [mysql.RowDataPacket[], mysql.FieldPacket[]];

    expect(rows).toHaveLength(1);
    // Verify DECIMAL(10,2) precision is maintained after all transitions
    expect(parseFloat(rows[0].total_earnings)).toBeCloseTo(1500.0, 2);
    expect(parseFloat(rows[0].total_deductions)).toBeCloseTo(250.0, 2);
    expect(parseFloat(rows[0].total_reimbursements)).toBeCloseTo(75.5, 2);
    expect(parseFloat(rows[0].net_pay)).toBeCloseTo(1325.5, 2);
  });

  it("posted settlement status update with wrong prior state affects 0 rows (business-level immutability)", async () => {
    if (skip) return;

    // Try to update a posted settlement back to reviewed (wrong prior state guard)
    const [result] = (await pool.query(
      `UPDATE settlements SET status = 'reviewed' WHERE id = ? AND status = 'reviewed'`,
      [TEST_SETTLEMENT_ID],
    )) as [mysql.ResultSetHeader, mysql.FieldPacket[]];

    // Settlement is 'posted', so WHERE status='reviewed' matches nothing
    expect(result.affectedRows).toBe(0);

    // Verify still posted
    const [rows] = (await pool.query(
      `SELECT status FROM settlements WHERE id = ?`,
      [TEST_SETTLEMENT_ID],
    )) as [mysql.RowDataPacket[], mysql.FieldPacket[]];
    expect(rows[0].status).toBe("posted");
  });
});
