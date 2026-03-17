/**
 * Per-suite DB seeding and cleanup helper.
 *
 * Each test suite should use a unique tenantId to prevent cross-suite
 * interference. Use the helper functions below to insert minimal test
 * data and clean up after tests.
 *
 * Usage:
 *   import { seedTestData, cleanupTestData, generateTenantId } from "../helpers/seed";
 *   import { getPool } from "../helpers/test-env";
 *
 *   const tenantId = generateTenantId("clients");
 *   let pool: mysql.Pool;
 *
 *   beforeAll(async () => {
 *     pool = getPool();
 *     await seedTestData(pool, tenantId);
 *   });
 *
 *   afterAll(async () => {
 *     await cleanupTestData(pool, tenantId);
 *     await pool.end();
 *   });
 */
import type { Pool } from "mysql2/promise";

/**
 * Generate a unique tenant ID for a test suite.
 * Includes a random suffix to prevent collisions between parallel runs.
 */
export function generateTenantId(suiteName: string): string {
  const suffix = Math.random().toString(36).substring(2, 8);
  return `test-${suiteName}-${suffix}`;
}

/**
 * Seed data shape returned by seedTestData for use in assertions.
 */
export interface SeedResult {
  tenantId: string;
  companyId: string;
  users: {
    admin: { id: string; email: string; firebaseUid: string };
    dispatcher: { id: string; email: string; firebaseUid: string };
    driver: { id: string; email: string; firebaseUid: string };
  };
  customer: { id: string; name: string };
  equipment: { id: string; unitNumber: string };
  load: { id: string; loadNumber: string };
}

/**
 * Insert minimal test rows for a given tenant.
 *
 * Creates: 1 company, 3 users (admin, dispatcher, driver), 1 customer,
 * 1 equipment, 1 load. All rows belong to the given tenantId.
 *
 * Returns the IDs of all created entities for use in test assertions.
 */
export async function seedTestData(
  pool: Pool,
  tenantId: string,
): Promise<SeedResult> {
  const companyId = tenantId;
  const adminId = `${tenantId}-admin`;
  const dispatcherId = `${tenantId}-dispatcher`;
  const driverId = `${tenantId}-driver`;
  const customerId = `${tenantId}-customer-1`;
  const equipmentId = `${tenantId}-equip-1`;
  const loadId = `${tenantId}-load-1`;

  const adminFbUid = `fb-${adminId}`;
  const dispatcherFbUid = `fb-${dispatcherId}`;
  const driverFbUid = `fb-${driverId}`;

  // 1. Company
  await pool.query(
    `INSERT INTO companies (id, name, account_type, email, subscription_status)
     VALUES (?, ?, 'fleet', ?, 'active')
     ON DUPLICATE KEY UPDATE name = VALUES(name)`,
    [companyId, `Test Company ${tenantId}`, `admin@${tenantId}.test`],
  );

  // 2. Users
  await pool.query(
    `INSERT INTO users (id, company_id, email, name, role, firebase_uid, onboarding_status)
     VALUES (?, ?, ?, ?, 'admin', ?, 'Completed')
     ON DUPLICATE KEY UPDATE name = VALUES(name)`,
    [adminId, companyId, `admin@${tenantId}.test`, "Test Admin", adminFbUid],
  );

  await pool.query(
    `INSERT INTO users (id, company_id, email, name, role, firebase_uid, onboarding_status)
     VALUES (?, ?, ?, ?, 'dispatcher', ?, 'Completed')
     ON DUPLICATE KEY UPDATE name = VALUES(name)`,
    [
      dispatcherId,
      companyId,
      `dispatcher@${tenantId}.test`,
      "Test Dispatcher",
      dispatcherFbUid,
    ],
  );

  await pool.query(
    `INSERT INTO users (id, company_id, email, name, role, firebase_uid, onboarding_status)
     VALUES (?, ?, ?, ?, 'driver', ?, 'Completed')
     ON DUPLICATE KEY UPDATE name = VALUES(name)`,
    [
      driverId,
      companyId,
      `driver@${tenantId}.test`,
      "Test Driver",
      driverFbUid,
    ],
  );

  // 3. Customer
  await pool.query(
    `INSERT INTO customers (id, company_id, name, type)
     VALUES (?, ?, ?, 'Broker')
     ON DUPLICATE KEY UPDATE name = VALUES(name)`,
    [customerId, companyId, `Test Broker ${tenantId}`],
  );

  // 4. Equipment
  await pool.query(
    `INSERT INTO equipment (id, company_id, unit_number, type, status)
     VALUES (?, ?, ?, 'Truck', 'Active')
     ON DUPLICATE KEY UPDATE unit_number = VALUES(unit_number)`,
    [equipmentId, companyId, `UNIT-${tenantId.substring(0, 8)}`],
  );

  // 5. Load
  await pool.query(
    `INSERT INTO loads (id, company_id, customer_id, driver_id, dispatcher_id, load_number, status, carrier_rate)
     VALUES (?, ?, ?, ?, ?, ?, 'Planned', 1500.00)
     ON DUPLICATE KEY UPDATE load_number = VALUES(load_number)`,
    [
      loadId,
      companyId,
      customerId,
      driverId,
      dispatcherId,
      `LD-${tenantId.substring(0, 8)}`,
    ],
  );

  return {
    tenantId,
    companyId,
    users: {
      admin: { id: adminId, email: `admin@${tenantId}.test`, firebaseUid: adminFbUid },
      dispatcher: {
        id: dispatcherId,
        email: `dispatcher@${tenantId}.test`,
        firebaseUid: dispatcherFbUid,
      },
      driver: { id: driverId, email: `driver@${tenantId}.test`, firebaseUid: driverFbUid },
    },
    customer: { id: customerId, name: `Test Broker ${tenantId}` },
    equipment: { id: equipmentId, unitNumber: `UNIT-${tenantId.substring(0, 8)}` },
    load: { id: loadId, loadNumber: `LD-${tenantId.substring(0, 8)}` },
  };
}

/**
 * Delete all rows for a given tenant. Deletes in dependency order
 * (children before parents) to respect foreign key constraints.
 */
export async function cleanupTestData(
  pool: Pool,
  tenantId: string,
): Promise<void> {
  const companyId = tenantId;

  // Delete in reverse dependency order.
  // Most child tables cascade on company_id, but explicit delete is safer
  // and works even if ON DELETE CASCADE is not configured on all FKs.
  const deleteQueries = [
    // Deep children first
    "DELETE FROM incident_actions WHERE incident_id IN (SELECT id FROM incidents WHERE load_id IN (SELECT id FROM loads WHERE company_id = ?))",
    "DELETE FROM emergency_charges WHERE incident_id IN (SELECT id FROM incidents WHERE load_id IN (SELECT id FROM loads WHERE company_id = ?))",
    "DELETE FROM incidents WHERE load_id IN (SELECT id FROM loads WHERE company_id = ?)",
    "DELETE FROM dispatch_events WHERE load_id IN (SELECT id FROM loads WHERE company_id = ?)",
    "DELETE FROM load_legs WHERE load_id IN (SELECT id FROM loads WHERE company_id = ?)",
    "DELETE FROM expenses WHERE company_id = ?",
    "DELETE FROM bookings WHERE company_id = ?",
    "DELETE FROM quotes WHERE company_id = ?",
    "DELETE FROM leads WHERE company_id = ?",
    "DELETE FROM work_items WHERE company_id = ?",
    "DELETE FROM loads WHERE company_id = ?",
    "DELETE FROM equipment WHERE company_id = ?",
    "DELETE FROM customer_contracts WHERE customer_id IN (SELECT id FROM customers WHERE company_id = ?)",
    "DELETE FROM customers WHERE company_id = ?",
    "DELETE FROM compliance_records WHERE user_id IN (SELECT id FROM users WHERE company_id = ?)",
    "DELETE FROM driver_time_logs WHERE user_id IN (SELECT id FROM users WHERE company_id = ?)",
    "DELETE FROM users WHERE company_id = ?",
    "DELETE FROM companies WHERE id = ?",
  ];

  for (const sql of deleteQueries) {
    try {
      await pool.query(sql, [companyId]);
    } catch {
      // Ignore errors from tables that may not exist yet (migrations not run)
      // or rows that don't exist
    }
  }
}
