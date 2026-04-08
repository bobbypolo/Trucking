/**
 * Sales Demo Seed Script — LoadPilot (DisbatchMe)
 *
 * Independent seed pipeline for the Bulletproof Sales Demo sprint.
 * Does NOT import, call, or modify server/scripts/seed-demo.ts.
 *
 * Loads env exclusively from .env.local (single source of truth across
 * seed, reset, and certify scripts). Fail-fast validation of all
 * required env vars — both DB credentials AND Firebase UIDs that must
 * be provisioned manually via Firebase Console before running.
 *
 * Usage (run from project root):
 *   npm run demo:seed:sales
 *
 * Required env vars in .env.local:
 *   DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
 *   SALES_DEMO_ADMIN_FIREBASE_UID
 *   SALES_DEMO_DRIVER_FIREBASE_UID
 *
 * Exit codes:
 *   0 — seed completed successfully
 *   1 — seed failed (see error output)
 */

import * as path from "path";
import * as fs from "fs";
import dotenv from "dotenv";
import mysql from "mysql2/promise";

// SINGLE ENV CONTRACT: .env.local is the ONLY env file consumed by
// seed, reset, and certify scripts. .env (without .local) is reserved
// for the existing SaaS dev workflow and is NOT touched.
dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SalesDemoCompanyRecord {
  id: string;
  name: string;
  account_type: string;
  email: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  tax_id: string;
  phone: string;
  mc_number: string;
  dot_number: string;
  subscription_tier: string;
  subscription_status: string;
}

export interface SalesDemoUserRecord {
  id: string;
  email: string;
  name: string;
  role: string;
  pay_model: string;
  pay_rate: number;
  onboarding_status: string;
}

export interface SalesDemoGlAccountRecord {
  id: string;
  account_number: string;
  name: string;
  type: string;
  sub_type: string;
  description: string;
}

export interface SalesDemoFixtureData {
  _meta: Record<string, string>;
  company: SalesDemoCompanyRecord;
  users: SalesDemoUserRecord[];
  gl_accounts: SalesDemoGlAccountRecord[];
}

// Minimal connection-like interface so tests can pass mock objects that
// capture executed SQL without spinning up a real DB.
export interface SqlExecutor {
  execute(sql: string, params?: unknown[]): Promise<unknown>;
}

export const SALES_DEMO_COMPANY_ID = "SALES-DEMO-001";

// ─── Fixture loader ───────────────────────────────────────────────────────────

export function loadSalesDemoFixture(): SalesDemoFixtureData {
  const fixturePath = path.resolve(
    __dirname,
    "sales-demo-fixtures",
    "sales-demo-data.json",
  );
  const raw = fs.readFileSync(fixturePath, "utf-8");
  const parsed = JSON.parse(raw) as SalesDemoFixtureData;
  return parsed;
}

// ─── Env validation ───────────────────────────────────────────────────────────

export function validateSalesDemoEnv(
  env: NodeJS.ProcessEnv = process.env,
): void {
  if (!env.SALES_DEMO_ADMIN_FIREBASE_UID) {
    throw new Error("SALES_DEMO_ADMIN_FIREBASE_UID required");
  }
  if (!env.SALES_DEMO_DRIVER_FIREBASE_UID) {
    throw new Error("SALES_DEMO_DRIVER_FIREBASE_UID required");
  }
  const dbKeys = ["DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD", "DB_NAME"];
  for (const key of dbKeys) {
    if (!env[key]) {
      throw new Error(`${key} required`);
    }
  }
}

// ─── Seed helpers ─────────────────────────────────────────────────────────────

export async function seedCompany(
  conn: SqlExecutor,
  company: SalesDemoCompanyRecord,
): Promise<void> {
  // Step 1: INSERT IGNORE the company row with the full column set.
  await conn.execute(
    `INSERT IGNORE INTO companies
       (id, name, account_type, email, address, city, state, zip,
        tax_id, phone, mc_number, dot_number, subscription_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      company.id,
      company.name,
      company.account_type,
      company.email,
      company.address,
      company.city,
      company.state,
      company.zip,
      company.tax_id,
      company.phone,
      company.mc_number,
      company.dot_number,
      company.subscription_status,
    ],
  );

  // Step 2: Explicitly set subscription_tier + status. Phase 1 guarantees
  // SALES-DEMO-001 always ends up on Fleet Core with status=active, even
  // if the company row already existed (INSERT IGNORE is a no-op). This
  // is the R-P1-01 contract.
  await conn.execute(
    `UPDATE companies
        SET subscription_tier = 'Fleet Core',
            subscription_status = 'active'
      WHERE id = ?`,
    [company.id],
  );
}

export async function seedUsers(
  conn: SqlExecutor,
  companyId: string,
  users: SalesDemoUserRecord[],
  env: NodeJS.ProcessEnv,
): Promise<void> {
  for (const user of users) {
    const firebaseUid =
      user.role === "admin"
        ? env.SALES_DEMO_ADMIN_FIREBASE_UID
        : env.SALES_DEMO_DRIVER_FIREBASE_UID;
    await conn.execute(
      `INSERT IGNORE INTO users
         (id, company_id, email, firebase_uid, name, role, pay_model,
          pay_rate, onboarding_status, safety_score, compliance_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user.id,
        companyId,
        user.email,
        firebaseUid,
        user.name,
        user.role,
        user.pay_model,
        user.pay_rate,
        user.onboarding_status,
        100,
        "Eligible",
      ],
    );
  }
}

export async function seedGlAccounts(
  conn: SqlExecutor,
  companyId: string,
  accounts: SalesDemoGlAccountRecord[],
): Promise<void> {
  for (const account of accounts) {
    await conn.execute(
      `INSERT IGNORE INTO gl_accounts
         (id, company_id, account_number, name, type, sub_type,
          description, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        account.id,
        companyId,
        account.account_number,
        account.name,
        account.type,
        account.sub_type,
        account.description,
        1,
      ],
    );
  }
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function seedSalesDemo(
  conn: SqlExecutor,
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  validateSalesDemoEnv(env);
  const fixture = loadSalesDemoFixture();
  const companyId = SALES_DEMO_COMPANY_ID;

  if (fixture.company.id !== companyId) {
    throw new Error(
      `Sales demo fixture company id mismatch: expected ${companyId}, got ${fixture.company.id}`,
    );
  }

  await seedCompany(conn, fixture.company);
  await seedUsers(conn, companyId, fixture.users, env);
  await seedGlAccounts(conn, companyId, fixture.gl_accounts);
}

// ─── CLI entry point ──────────────────────────────────────────────────────────

async function main(): Promise<void> {
  try {
    validateSalesDemoEnv();
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      multipleStatements: false,
    });
    try {
      await seedSalesDemo(conn as unknown as SqlExecutor);
    } finally {
      await conn.end();
    }
    process.exit(0);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.error(`seed-sales-demo failed: ${msg}`);
    process.exit(1);
  }
}

// Only run main() when executed directly (not during tests that import symbols).
if (require.main === module) {
  void main();
}
