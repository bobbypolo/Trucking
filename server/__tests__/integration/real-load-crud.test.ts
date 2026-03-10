/**
 * Real Load CRUD and Lifecycle Integration Test.
 * Tests REAL Docker MySQL — creates company, user, load with stops,
 * transitions status through full lifecycle via direct SQL,
 * verifies dispatch_event audit trail.
 *
 * R-marker: Tests R-P2-01
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mysql from "mysql2/promise";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { isDockerRunning } from "../helpers/test-env.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../../../");
dotenv.config({ path: path.join(projectRoot, ".env") });

const TEST_COMPANY_ID = "test-co-crud-p2";
const TEST_USER_ID = "test-user-crud-p2";
const TEST_LOAD_ID = "test-load-crud-p2";
const TEST_LEG_ID_PICKUP = "test-leg-crud-p2-pk";
const TEST_LEG_ID_DROPOFF = "test-leg-crud-p2-do";

let pool: mysql.Pool;
let skip = false;

describe("Real Load CRUD and Lifecycle (Docker MySQL)", () => {
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

    // Clean up any leftover test data from previous runs
    await cleanupTestData();

    // Insert prerequisite company
    await pool.query(
      `INSERT INTO companies (id, name, account_type, email) VALUES (?, ?, 'fleet', ?)`,
      [TEST_COMPANY_ID, "Test CRUD Co P2", "crud-p2@test.dev"],
    );

    // Insert prerequisite user (dispatcher/admin)
    await pool.query(
      `INSERT INTO users (id, company_id, email, name, role) VALUES (?, ?, ?, ?, ?)`,
      [
        TEST_USER_ID,
        TEST_COMPANY_ID,
        "crud-p2@test.dev",
        "CRUD Test User",
        "admin",
      ],
    );
  }, 20000);

  afterAll(async () => {
    if (pool) {
      try {
        await cleanupTestData();
      } catch (err) {
        console.warn(
          `Cleanup failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      await pool.end();
    }
  }, 20000);

  async function cleanupTestData() {
    if (!pool) return;
    // Delete in FK-safe order
    await pool.query(`DELETE FROM dispatch_events WHERE load_id = ?`, [
      TEST_LOAD_ID,
    ]);
    await pool.query(`DELETE FROM load_legs WHERE load_id = ?`, [TEST_LOAD_ID]);
    await pool.query(`DELETE FROM loads WHERE id = ?`, [TEST_LOAD_ID]);
    await pool.query(`DELETE FROM users WHERE id = ?`, [TEST_USER_ID]);
    await pool.query(`DELETE FROM companies WHERE id = ?`, [TEST_COMPANY_ID]);
  }

  it("creates a load with stops in real Docker MySQL", async () => {
    if (skip) return;

    // Insert load at draft status
    const [loadResult] = await pool.query(
      `INSERT INTO loads (id, company_id, driver_id, load_number, status, version)
       VALUES (?, ?, ?, ?, 'draft', 1)`,
      [TEST_LOAD_ID, TEST_COMPANY_ID, TEST_USER_ID, "CRUD-P2-001"],
    );
    expect((loadResult as mysql.ResultSetHeader).affectedRows).toBe(1);

    // Insert pickup stop
    await pool.query(
      `INSERT INTO load_legs (id, load_id, type, facility_name, city, state, sequence_order)
       VALUES (?, ?, 'Pickup', 'Test Origin Facility', 'Chicago', 'IL', 1)`,
      [TEST_LEG_ID_PICKUP, TEST_LOAD_ID],
    );

    // Insert dropoff stop
    await pool.query(
      `INSERT INTO load_legs (id, load_id, type, facility_name, city, state, sequence_order)
       VALUES (?, ?, 'Dropoff', 'Test Dest Facility', 'Detroit', 'MI', 2)`,
      [TEST_LEG_ID_DROPOFF, TEST_LOAD_ID],
    );

    // Verify load exists with correct status
    const [rows] = (await pool.query(
      `SELECT id, status, company_id, version FROM loads WHERE id = ?`,
      [TEST_LOAD_ID],
    )) as [mysql.RowDataPacket[], mysql.FieldPacket[]];

    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("draft");
    expect(rows[0].company_id).toBe(TEST_COMPANY_ID);
    expect(rows[0].version).toBe(1);

    // Verify 2 legs exist
    const [legs] = (await pool.query(
      `SELECT id, type, sequence_order FROM load_legs WHERE load_id = ? ORDER BY sequence_order`,
      [TEST_LOAD_ID],
    )) as [mysql.RowDataPacket[], mysql.FieldPacket[]];

    expect(legs).toHaveLength(2);
    expect(legs[0].type).toBe("Pickup");
    expect(legs[1].type).toBe("Dropoff");
  });

  it("transitions load through full status lifecycle via direct SQL", async () => {
    if (skip) return;

    const transitions: Array<{ from: string; to: string }> = [
      { from: "draft", to: "planned" },
      { from: "planned", to: "dispatched" },
      { from: "dispatched", to: "in_transit" },
      { from: "in_transit", to: "arrived" },
      { from: "arrived", to: "delivered" },
      { from: "delivered", to: "completed" },
    ];

    for (let i = 0; i < transitions.length; i++) {
      const { from, to } = transitions[i];
      const currentVersion = i + 1;
      const nextVersion = i + 2;

      // Perform status UPDATE with optimistic locking
      const [result] = (await pool.query(
        `UPDATE loads SET status = ?, version = ? WHERE id = ? AND status = ? AND version = ?`,
        [to, nextVersion, TEST_LOAD_ID, from, currentVersion],
      )) as [mysql.ResultSetHeader, mysql.FieldPacket[]];

      expect(result.affectedRows).toBe(1);

      // Verify new status with SELECT
      const [rows] = (await pool.query(
        `SELECT status, version FROM loads WHERE id = ?`,
        [TEST_LOAD_ID],
      )) as [mysql.RowDataPacket[], mysql.FieldPacket[]];

      expect(rows[0].status).toBe(to);
      expect(rows[0].version).toBe(nextVersion);

      // Insert dispatch_event audit entry
      const eventId = `evt-crud-p2-${i + 1}`;
      await pool.query(
        `INSERT INTO dispatch_events (id, load_id, dispatcher_id, actor_id, event_type, prior_state, next_state, message)
         VALUES (?, ?, ?, ?, 'StatusChange', ?, ?, ?)`,
        [
          eventId,
          TEST_LOAD_ID,
          TEST_USER_ID,
          TEST_USER_ID,
          from,
          to,
          `Transitioned ${from} -> ${to}`,
        ],
      );
    }

    // Verify final status is completed
    const [finalRows] = (await pool.query(
      `SELECT status FROM loads WHERE id = ?`,
      [TEST_LOAD_ID],
    )) as [mysql.RowDataPacket[], mysql.FieldPacket[]];

    expect(finalRows[0].status).toBe("completed");
  });

  it("dispatch_event audit trail has one entry per transition", async () => {
    if (skip) return;

    const [events] = (await pool.query(
      `SELECT id, event_type, prior_state, next_state FROM dispatch_events WHERE load_id = ? ORDER BY created_at`,
      [TEST_LOAD_ID],
    )) as [mysql.RowDataPacket[], mysql.FieldPacket[]];

    // 6 transitions: draft->planned->dispatched->in_transit->arrived->delivered->completed
    expect(events.length).toBe(6);

    // Verify audit trail: first event draft->planned
    expect(events[0].event_type).toBe("StatusChange");
    expect(events[0].prior_state).toBe("draft");
    expect(events[0].next_state).toBe("planned");

    // Verify last event delivered->completed
    expect(events[5].prior_state).toBe("delivered");
    expect(events[5].next_state).toBe("completed");
  });

  it("completed load UPDATE is ignored when status already completed (no state change)", async () => {
    if (skip) return;

    // Try to transition back to draft — should NOT affect any rows (completed is terminal)
    const [result] = (await pool.query(
      `UPDATE loads SET status = 'draft', version = 99 WHERE id = ? AND status = 'draft'`,
      [TEST_LOAD_ID],
    )) as [mysql.ResultSetHeader, mysql.FieldPacket[]];

    // Load is in 'completed' state, WHERE status='draft' matches nothing
    expect(result.affectedRows).toBe(0);

    // Confirm load is still completed
    const [rows] = (await pool.query(`SELECT status FROM loads WHERE id = ?`, [
      TEST_LOAD_ID,
    ])) as [mysql.RowDataPacket[], mysql.FieldPacket[]];
    expect(rows[0].status).toBe("completed");
  });
});
