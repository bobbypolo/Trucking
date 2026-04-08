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

import { seedSalesDemoIfta } from "./seed-sales-demo-ifta";

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
export const SALES_DEMO_BROKER_ID = "SALES-DEMO-CUST-001";
export const SALES_DEMO_HERO_LOAD_ID = "LP-DEMO-RC-001";

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

// ─── Phase 2: hero load + broker + documents + artifact copy ────────────────
//
// Continuity objects (must match PLAN.md Continuity Objects table verbatim):
//   - Broker: SALES-DEMO-CUST-001 / ACME Logistics LLC
//   - Hero load: LP-DEMO-RC-001
//   - Commodity: Frozen Beef, weight 42500 lbs
//   - Route: Houston TX -> Chicago IL
//   - Rate: $3,250 carrier rate
//   - Driver: SALES-DEMO-DRIVER-001 (seeded by Phase 1)
//   - Document artifacts: rate-con.pdf, bol.pdf, lumper-receipt.pdf

interface HeroDocumentRecord {
  readonly id: string;
  readonly fixture_filename: string;
  readonly sanitized_filename: string;
  readonly document_type: string;
  readonly mime_type: string;
  readonly description: string;
}

const HERO_BROKER_NAME = "ACME Logistics LLC";
const HERO_COMMODITY = "Frozen Beef";
const HERO_WEIGHT_LBS = 42500;
const HERO_CARRIER_RATE = 3250;
const HERO_DRIVER_PAY = 2100;
const HERO_PICKUP_CITY = "Houston";
const HERO_PICKUP_STATE = "TX";
const HERO_PICKUP_FACILITY = "Gulf Coast Meatpacking";
const HERO_DROPOFF_CITY = "Chicago";
const HERO_DROPOFF_STATE = "IL";
const HERO_DROPOFF_FACILITY = "Midwest Cold Storage";
const HERO_DRIVER_ID = "SALES-DEMO-DRIVER-001";
const HERO_PICKUP_DATE = "2025-11-10";
const HERO_DROPOFF_DATE = "2025-11-12";

const HERO_DOCUMENTS: ReadonlyArray<HeroDocumentRecord> = [
  {
    id: "SALES-DEMO-DOC-RATECON-001",
    fixture_filename: "rate-con.pdf",
    sanitized_filename: "rate-con.pdf",
    document_type: "rate_confirmation",
    mime_type: "application/pdf",
    description: "Rate confirmation for LP-DEMO-RC-001",
  },
  {
    id: "SALES-DEMO-DOC-BOL-001",
    fixture_filename: "bol.pdf",
    sanitized_filename: "bol.pdf",
    document_type: "bill_of_lading",
    mime_type: "application/pdf",
    description: "Signed BOL for LP-DEMO-RC-001",
  },
  {
    id: "SALES-DEMO-DOC-LUMPER-001",
    fixture_filename: "lumper-receipt.pdf",
    sanitized_filename: "lumper-receipt.pdf",
    document_type: "lumper_receipt",
    mime_type: "application/pdf",
    description: "Lumper receipt for LP-DEMO-RC-001",
  },
];

/**
 * Returns the absolute path to the sales-demo artifact upload directory
 * that the live document download handler reads from. Mirrors the path
 * shape used by server/routes/documents.ts: UPLOAD_DIR + storage_path.
 */
function heroUploadDir(env: NodeJS.ProcessEnv): string {
  const baseDir = env.UPLOAD_DIR || "./uploads";
  return path.resolve(baseDir, "sales-demo", SALES_DEMO_HERO_LOAD_ID);
}

/**
 * Copies the 3 canonical hero PDF artifacts from the fixtures directory
 * into the live upload directory. Idempotent: skips the copy when the
 * destination file already exists with the same byte size.
 */
export async function copyHeroArtifacts(
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  const sourceDir = path.resolve(__dirname, "sales-demo-fixtures");
  const destDir = heroUploadDir(env);
  await fs.promises.mkdir(destDir, { recursive: true });

  for (const doc of HERO_DOCUMENTS) {
    const src = path.join(sourceDir, doc.fixture_filename);
    const dst = path.join(destDir, doc.fixture_filename);
    const srcStat = await fs.promises.stat(src);

    let destExists = false;
    try {
      const dstStat = await fs.promises.stat(dst);
      destExists = dstStat.size === srcStat.size;
    } catch {
      destExists = false;
    }

    if (!destExists) {
      await fs.promises.copyFile(src, dst);
    }
  }
}

/**
 * Phase 2 seed — inserts exactly 1 customers row (broker), 1 loads row
 * (hero load LP-DEMO-RC-001), 2 load_legs rows, and 3 documents rows into
 * the sales-demo tenant using only INSERT IGNORE. Additionally copies the
 * 3 hero PDF fixtures into the live upload directory so the unmodified
 * production GET /api/documents/:id/download handler can return them.
 */
export async function seedSalesDemoLoads(
  conn: SqlExecutor,
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  const companyId = SALES_DEMO_COMPANY_ID;

  // Step 1: customers (broker) — resolved by getBrokers → /api/clients.
  await conn.execute(
    `INSERT IGNORE INTO customers
       (id, company_id, name, type, mc_number, dot_number, email, phone,
        address, payment_terms)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      SALES_DEMO_BROKER_ID,
      companyId,
      HERO_BROKER_NAME,
      "Broker",
      "MC-ACME-4421",
      "DOT-ACME-8891",
      "dispatch@acme-logistics.invalid",
      "555-0199",
      "1200 Freight Way, Chicago, IL 60601",
      "Net 30",
    ],
  );

  // Step 2: loads — hero load LP-DEMO-RC-001 wired to the broker via
  // customer_id. load_number is the column name in migration 001; the
  // columns carrier_rate, driver_pay, pickup_date, freight_type,
  // commodity, and weight are what LoadDetailView renders.
  await conn.execute(
    `INSERT IGNORE INTO loads
       (id, company_id, customer_id, driver_id, load_number, status,
        carrier_rate, driver_pay, pickup_date, freight_type, commodity,
        weight, bol_number)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      SALES_DEMO_HERO_LOAD_ID,
      companyId,
      SALES_DEMO_BROKER_ID,
      HERO_DRIVER_ID,
      SALES_DEMO_HERO_LOAD_ID,
      "delivered",
      HERO_CARRIER_RATE,
      HERO_DRIVER_PAY,
      HERO_PICKUP_DATE,
      "Reefer",
      HERO_COMMODITY,
      HERO_WEIGHT_LBS,
      "BOL-DEMO-0001",
    ],
  );

  // Step 3: load_legs — 2 rows (Pickup then Dropoff), canonical Houston
  // -> Chicago route.
  await conn.execute(
    `INSERT IGNORE INTO load_legs
       (id, load_id, type, facility_name, city, state, date,
        appointment_time, completed, sequence_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      "SALES-DEMO-LEG-PICKUP-001",
      SALES_DEMO_HERO_LOAD_ID,
      "Pickup",
      HERO_PICKUP_FACILITY,
      HERO_PICKUP_CITY,
      HERO_PICKUP_STATE,
      HERO_PICKUP_DATE,
      "08:00",
      1,
      1,
    ],
  );
  await conn.execute(
    `INSERT IGNORE INTO load_legs
       (id, load_id, type, facility_name, city, state, date,
        appointment_time, completed, sequence_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      "SALES-DEMO-LEG-DROPOFF-001",
      SALES_DEMO_HERO_LOAD_ID,
      "Dropoff",
      HERO_DROPOFF_FACILITY,
      HERO_DROPOFF_CITY,
      HERO_DROPOFF_STATE,
      HERO_DROPOFF_DATE,
      "14:00",
      1,
      2,
    ],
  );

  // Step 4: documents — 3 rows linked to the hero load. storage_path
  // uses the same shape the live disk download handler expects
  // (UPLOAD_DIR + storage_path joined). status 'ready' so the UI does
  // not show a "processing" spinner on stage.
  for (const doc of HERO_DOCUMENTS) {
    const storagePath = `sales-demo/${SALES_DEMO_HERO_LOAD_ID}/${doc.fixture_filename}`;
    await conn.execute(
      `INSERT IGNORE INTO documents
         (id, company_id, load_id, original_filename, sanitized_filename,
          mime_type, file_size_bytes, storage_path, document_type, status,
          description, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        doc.id,
        companyId,
        SALES_DEMO_HERO_LOAD_ID,
        doc.fixture_filename,
        doc.sanitized_filename,
        doc.mime_type,
        1400,
        storagePath,
        doc.document_type,
        "ready",
        doc.description,
        "SALES-DEMO-ADMIN-001",
      ],
    );
  }

  // Step 5: copy artifact files into the live upload directory so the
  // unmodified production download handler can stream real bytes.
  await copyHeroArtifacts(env);
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
  await seedSalesDemoLoads(conn, env);
  // Phase 3: trip-based IFTA Q4 2025 evidence seed. Depends on the hero
  // load row from Phase 2 existing first.
  await seedSalesDemoIfta(conn);
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
