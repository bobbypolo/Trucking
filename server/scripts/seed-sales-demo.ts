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

// ─── Phase 4: CRM Registry Depth (12 parties + sub-records) ─────────────────
//
// Seeds the live parties, party_contacts, party_documents, rate_rows,
// rate_tiers, constraint_sets, constraint_rules, and party_catalog_links
// tables with 12 parties (3 Customer / 2 Broker / 2 Vendor / 3 Facility /
// 2 Contractor), each enriched with at least 1 contact, 1 document, 1
// rate row + tier, 1 constraint set + rule, and 1 catalog link.
//
// One of the 2 brokers IS the same broker the salesperson already saw on
// the Phase 2 hero load (SALES-DEMO-CUST-001 / ACME Logistics LLC). The
// Playwright walkthrough drills into ACME Logistics LLC by name to prove
// the buyer recognizes the continuity object.
//
// Direct SQL via SqlExecutor only. Does NOT call the buggy CRM REST
// create endpoint (it has a known schema bug — see PLAN.md Phase 4
// correction #9). Does NOT touch the three legacy CRM tables that were
// referenced by the original design but never made it into the schema
// (the test file enumerates them by name).

interface PartyFixture {
  readonly id: string;
  readonly name: string;
  readonly type: "Customer" | "Broker" | "Vendor" | "Facility" | "Contractor";
  readonly mc_number: string | null;
  readonly dot_number: string | null;
  readonly rating: number | null;
  readonly contact_name: string;
  readonly contact_role: string;
  readonly contact_email: string;
  readonly contact_phone: string;
  readonly document_type: string;
  readonly document_url: string;
  readonly rate_direction: string;
  readonly rate_unit_type: string;
  readonly rate_base_amount: number;
  readonly rate_unit_amount: number;
  readonly tier_start: number;
  readonly tier_end: number;
  readonly constraint_applies_to: string;
  readonly constraint_priority: number;
  readonly rule_type: string;
  readonly rule_field: string;
  readonly rule_operator: string;
  readonly rule_value: string;
  readonly rule_message: string;
  readonly catalog_item_id: string;
}

const SALES_DEMO_PARTIES: ReadonlyArray<PartyFixture> = [
  // ── 3 Customers ──────────────────────────────────────────────────────────
  {
    id: "SALES-DEMO-PARTY-CUST-001",
    name: "Lone Star Distribution Co",
    type: "Customer",
    mc_number: "MC-LSDC-1010",
    dot_number: "DOT-LSDC-2020",
    rating: 4.8,
    contact_name: "Maria Rodriguez",
    contact_role: "Logistics Manager",
    contact_email: "maria@lonestar-distribution.invalid",
    contact_phone: "713-555-0101",
    document_type: "msa",
    document_url: "https://docs.invalid/lonestar/msa.pdf",
    rate_direction: "INBOUND",
    rate_unit_type: "PER_MILE",
    rate_base_amount: 0,
    rate_unit_amount: 2.85,
    tier_start: 0,
    tier_end: 500,
    constraint_applies_to: "loads",
    constraint_priority: 10,
    rule_type: "schedule",
    rule_field: "delivery_window",
    rule_operator: "EQ",
    rule_value: "08:00-17:00 CT",
    rule_message: "Receiving hours 8am-5pm Central",
    catalog_item_id: "CAT-LSDC-DRYVAN-001",
  },
  {
    id: "SALES-DEMO-PARTY-CUST-002",
    name: "Heartland Grocery Wholesalers",
    type: "Customer",
    mc_number: "MC-HGW-2002",
    dot_number: "DOT-HGW-3003",
    rating: 4.6,
    contact_name: "Daniel O'Brien",
    contact_role: "Purchasing Director",
    contact_email: "dobrien@heartland-wholesale.invalid",
    contact_phone: "319-555-0202",
    document_type: "credit_application",
    document_url: "https://docs.invalid/heartland/credit.pdf",
    rate_direction: "INBOUND",
    rate_unit_type: "FLAT",
    rate_base_amount: 1850,
    rate_unit_amount: 0,
    tier_start: 0,
    tier_end: 1,
    constraint_applies_to: "loads",
    constraint_priority: 20,
    rule_type: "appointment",
    rule_field: "advance_notice_hours",
    rule_operator: "GTE",
    rule_value: "24",
    rule_message: "24-hour advance booking required",
    catalog_item_id: "CAT-HGW-REEFER-001",
  },
  {
    id: "SALES-DEMO-PARTY-CUST-003",
    name: "Pacific Northwest Lumber Mills",
    type: "Customer",
    mc_number: "MC-PNL-3030",
    dot_number: "DOT-PNL-4040",
    rating: 4.4,
    contact_name: "Jennifer Chen",
    contact_role: "Shipping Coordinator",
    contact_email: "jchen@pnw-lumber.invalid",
    contact_phone: "503-555-0303",
    document_type: "insurance_certificate",
    document_url: "https://docs.invalid/pnw/coi.pdf",
    rate_direction: "INBOUND",
    rate_unit_type: "PER_MILE",
    rate_base_amount: 0,
    rate_unit_amount: 3.1,
    tier_start: 500,
    tier_end: 2000,
    constraint_applies_to: "loads",
    constraint_priority: 15,
    rule_type: "cargo",
    rule_field: "max_weight_lbs",
    rule_operator: "LTE",
    rule_value: "48000",
    rule_message: "Flatbed max 48k lbs per load",
    catalog_item_id: "CAT-PNL-FLATBED-001",
  },

  // ── 2 Brokers (one is the Phase 2 hero broker — continuity object) ───────
  {
    // CONTINUITY: same broker the salesperson saw on hero load LP-DEMO-RC-001
    id: SALES_DEMO_BROKER_ID,
    name: "ACME Logistics LLC",
    type: "Broker",
    mc_number: "MC-ACME-4421",
    dot_number: "DOT-ACME-8891",
    rating: 4.9,
    contact_name: "Thomas Wright",
    contact_role: "Senior Broker",
    contact_email: "twright@acme-logistics.invalid",
    contact_phone: "555-0199",
    document_type: "broker_authority",
    document_url: "https://docs.invalid/acme/authority.pdf",
    rate_direction: "OUTBOUND",
    rate_unit_type: "PERCENT",
    rate_base_amount: 0,
    rate_unit_amount: 0.12,
    tier_start: 0,
    tier_end: 5000,
    constraint_applies_to: "loads",
    constraint_priority: 5,
    rule_type: "payment",
    rule_field: "payment_terms_days",
    rule_operator: "EQ",
    rule_value: "30",
    rule_message: "Net 30 payment terms",
    catalog_item_id: "CAT-ACME-BROKERAGE-001",
  },
  {
    id: "SALES-DEMO-PARTY-BRK-002",
    name: "Continental Freight Brokerage",
    type: "Broker",
    mc_number: "MC-CFB-5005",
    dot_number: "DOT-CFB-6006",
    rating: 4.5,
    contact_name: "Susan Martinez",
    contact_role: "Operations Manager",
    contact_email: "smartinez@continental-freight.invalid",
    contact_phone: "404-555-0505",
    document_type: "broker_authority",
    document_url: "https://docs.invalid/continental/authority.pdf",
    rate_direction: "OUTBOUND",
    rate_unit_type: "PERCENT",
    rate_base_amount: 0,
    rate_unit_amount: 0.1,
    tier_start: 0,
    tier_end: 3000,
    constraint_applies_to: "loads",
    constraint_priority: 12,
    rule_type: "payment",
    rule_field: "payment_terms_days",
    rule_operator: "LTE",
    rule_value: "45",
    rule_message: "Net 45 max",
    catalog_item_id: "CAT-CFB-BROKERAGE-001",
  },

  // ── 2 Vendors ────────────────────────────────────────────────────────────
  {
    id: "SALES-DEMO-PARTY-VEN-001",
    name: "Big Rig Maintenance Services",
    type: "Vendor",
    mc_number: null,
    dot_number: null,
    rating: 4.7,
    contact_name: "Robert Garcia",
    contact_role: "Service Manager",
    contact_email: "rgarcia@bigrig-maint.invalid",
    contact_phone: "281-555-0606",
    document_type: "service_agreement",
    document_url: "https://docs.invalid/bigrig/sla.pdf",
    rate_direction: "OUTBOUND",
    rate_unit_type: "PER_HOUR",
    rate_base_amount: 0,
    rate_unit_amount: 145,
    tier_start: 0,
    tier_end: 8,
    constraint_applies_to: "vendor_orders",
    constraint_priority: 10,
    rule_type: "lead_time",
    rule_field: "scheduling_days",
    rule_operator: "GTE",
    rule_value: "2",
    rule_message: "48-hour scheduling window",
    catalog_item_id: "CAT-BIGRIG-MAINT-001",
  },
  {
    id: "SALES-DEMO-PARTY-VEN-002",
    name: "Pilot Travel Centers",
    type: "Vendor",
    mc_number: null,
    dot_number: null,
    rating: 4.3,
    contact_name: "Karen Phillips",
    contact_role: "Account Manager",
    contact_email: "kphillips@pilot-fleet.invalid",
    contact_phone: "865-555-0707",
    document_type: "fleet_card_agreement",
    document_url: "https://docs.invalid/pilot/agreement.pdf",
    rate_direction: "OUTBOUND",
    rate_unit_type: "PER_GALLON",
    rate_base_amount: 0,
    rate_unit_amount: 3.59,
    tier_start: 0,
    tier_end: 200,
    constraint_applies_to: "vendor_orders",
    constraint_priority: 20,
    rule_type: "billing",
    rule_field: "invoice_frequency",
    rule_operator: "EQ",
    rule_value: "weekly",
    rule_message: "Weekly fleet card billing",
    catalog_item_id: "CAT-PILOT-FUEL-001",
  },

  // ── 3 Facilities ─────────────────────────────────────────────────────────
  {
    id: "SALES-DEMO-PARTY-FAC-001",
    name: "Gulf Coast Meatpacking",
    type: "Facility",
    mc_number: null,
    dot_number: null,
    rating: 4.8,
    contact_name: "Frank Sullivan",
    contact_role: "Dock Supervisor",
    contact_email: "fsullivan@gulfcoast-meat.invalid",
    contact_phone: "713-555-0808",
    document_type: "facility_safety_protocol",
    document_url: "https://docs.invalid/gulfcoast/safety.pdf",
    rate_direction: "INBOUND",
    rate_unit_type: "FLAT",
    rate_base_amount: 75,
    rate_unit_amount: 0,
    tier_start: 0,
    tier_end: 1,
    constraint_applies_to: "facility_visits",
    constraint_priority: 5,
    rule_type: "safety",
    rule_field: "ppe_required",
    rule_operator: "EQ",
    rule_value: "hardhat,vest,gloves",
    rule_message: "Full PPE required at receiving dock",
    catalog_item_id: "CAT-GCM-DOCK-001",
  },
  {
    id: "SALES-DEMO-PARTY-FAC-002",
    name: "Midwest Cold Storage",
    type: "Facility",
    mc_number: null,
    dot_number: null,
    rating: 4.6,
    contact_name: "Linda Anderson",
    contact_role: "Receiving Manager",
    contact_email: "landerson@midwest-cold.invalid",
    contact_phone: "312-555-0909",
    document_type: "facility_safety_protocol",
    document_url: "https://docs.invalid/midwest/safety.pdf",
    rate_direction: "INBOUND",
    rate_unit_type: "FLAT",
    rate_base_amount: 110,
    rate_unit_amount: 0,
    tier_start: 0,
    tier_end: 1,
    constraint_applies_to: "facility_visits",
    constraint_priority: 8,
    rule_type: "temperature",
    rule_field: "reefer_temp_f",
    rule_operator: "LTE",
    rule_value: "32",
    rule_message: "Frozen storage 32F or below at gate",
    catalog_item_id: "CAT-MCS-DOCK-001",
  },
  {
    id: "SALES-DEMO-PARTY-FAC-003",
    name: "Phoenix Cross-Dock Terminal",
    type: "Facility",
    mc_number: null,
    dot_number: null,
    rating: 4.5,
    contact_name: "James Thompson",
    contact_role: "Terminal Manager",
    contact_email: "jthompson@phoenix-xdock.invalid",
    contact_phone: "602-555-1010",
    document_type: "terminal_handbook",
    document_url: "https://docs.invalid/phoenix/handbook.pdf",
    rate_direction: "INBOUND",
    rate_unit_type: "FLAT",
    rate_base_amount: 95,
    rate_unit_amount: 0,
    tier_start: 0,
    tier_end: 1,
    constraint_applies_to: "facility_visits",
    constraint_priority: 12,
    rule_type: "appointment",
    rule_field: "dock_window_minutes",
    rule_operator: "LTE",
    rule_value: "120",
    rule_message: "2-hour dock window per appointment",
    catalog_item_id: "CAT-PXT-DOCK-001",
  },

  // ── 2 Contractors ────────────────────────────────────────────────────────
  {
    id: "SALES-DEMO-PARTY-CTR-001",
    name: "Cascade Owner-Operator Group",
    type: "Contractor",
    mc_number: "MC-COG-7007",
    dot_number: "DOT-COG-8008",
    rating: 4.9,
    contact_name: "Michael Brown",
    contact_role: "Lead Owner-Operator",
    contact_email: "mbrown@cascade-oo.invalid",
    contact_phone: "206-555-1111",
    document_type: "lease_agreement",
    document_url: "https://docs.invalid/cascade/lease.pdf",
    rate_direction: "OUTBOUND",
    rate_unit_type: "PER_MILE",
    rate_base_amount: 0,
    rate_unit_amount: 1.45,
    tier_start: 0,
    tier_end: 1500,
    constraint_applies_to: "settlements",
    constraint_priority: 5,
    rule_type: "settlement",
    rule_field: "pay_frequency",
    rule_operator: "EQ",
    rule_value: "weekly",
    rule_message: "Weekly settlement runs Friday",
    catalog_item_id: "CAT-COG-OWNERPAY-001",
  },
  {
    id: "SALES-DEMO-PARTY-CTR-002",
    name: "Lone Wolf Hauling LLC",
    type: "Contractor",
    mc_number: "MC-LWH-9009",
    dot_number: "DOT-LWH-1212",
    rating: 4.7,
    contact_name: "David Jackson",
    contact_role: "Owner",
    contact_email: "djackson@lonewolf-haul.invalid",
    contact_phone: "210-555-1212",
    document_type: "lease_agreement",
    document_url: "https://docs.invalid/lonewolf/lease.pdf",
    rate_direction: "OUTBOUND",
    rate_unit_type: "PER_MILE",
    rate_base_amount: 0,
    rate_unit_amount: 1.55,
    tier_start: 0,
    tier_end: 2000,
    constraint_applies_to: "settlements",
    constraint_priority: 8,
    rule_type: "settlement",
    rule_field: "fuel_advance_pct",
    rule_operator: "LTE",
    rule_value: "40",
    rule_message: "Fuel advance capped at 40%",
    catalog_item_id: "CAT-LWH-OWNERPAY-001",
  },
];

/**
 * Phase 4 seed — inserts the 12 sales-demo parties plus their full
 * sub-record enrichment via direct SQL INSERT IGNORE. Idempotent: a
 * second invocation re-runs the same INSERT IGNOREs which the DB
 * treats as no-ops because every row has a deterministic primary key.
 *
 * Continuity contract: ACME Logistics LLC (SALES-DEMO-CUST-001) is one
 * of the 2 brokers — the buyer will recognize it from the Phase 2 hero
 * load walkthrough.
 */
export async function seedSalesDemoParties(conn: SqlExecutor): Promise<void> {
  const companyId = SALES_DEMO_COMPANY_ID;

  for (const party of SALES_DEMO_PARTIES) {
    const isCustomer = party.type === "Customer" ? 1 : 0;
    const isVendor = party.type === "Vendor" ? 1 : 0;

    // Step 1: parties row. Column order matches PartyInsertParams in the
    // unit tests: (id, company_id, name, type, is_customer, is_vendor,
    // status, mc_number, dot_number, rating, tags, entity_class,
    // vendor_profile). entity_class mirrors type so the live read shape
    // resolves the canonical class without normalization.
    await conn.execute(
      `INSERT IGNORE INTO parties
         (id, company_id, name, type, is_customer, is_vendor, status,
          mc_number, dot_number, rating, tags, entity_class, vendor_profile)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        party.id,
        companyId,
        party.name,
        party.type,
        isCustomer,
        isVendor,
        "active",
        party.mc_number,
        party.dot_number,
        party.rating,
        JSON.stringify([party.type.toLowerCase()]),
        party.type,
        null,
      ],
    );

    // Step 2: party_contacts — 1 contact per party. Column order:
    // (id, party_id, name, role, email, phone, is_primary).
    await conn.execute(
      `INSERT IGNORE INTO party_contacts
         (id, party_id, name, role, email, phone, is_primary)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        `${party.id}-CONTACT-001`,
        party.id,
        party.contact_name,
        party.contact_role,
        party.contact_email,
        party.contact_phone,
        1,
      ],
    );

    // Step 3: party_documents — 1 document per party. Column order:
    // (id, party_id, document_type, document_url).
    await conn.execute(
      `INSERT IGNORE INTO party_documents
         (id, party_id, document_type, document_url)
       VALUES (?, ?, ?, ?)`,
      [
        `${party.id}-DOC-001`,
        party.id,
        party.document_type,
        party.document_url,
      ],
    );

    // Step 4: rate_rows — 1 rate row per party. Column order:
    // (id, party_id, company_id, catalog_item_id, variant_id, direction,
    //  currency, price_type, unit_type, base_amount, unit_amount,
    //  min_charge, max_charge, free_units, effective_start, effective_end,
    //  taxable_flag, rounding_rule, notes_internal, approval_required).
    const rateId = `${party.id}-RATE-001`;
    await conn.execute(
      `INSERT IGNORE INTO rate_rows
         (id, party_id, company_id, catalog_item_id, variant_id, direction,
          currency, price_type, unit_type, base_amount, unit_amount,
          min_charge, max_charge, free_units, effective_start, effective_end,
          taxable_flag, rounding_rule, notes_internal, approval_required)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        rateId,
        party.id,
        companyId,
        party.catalog_item_id,
        null,
        party.rate_direction,
        "USD",
        "STANDARD",
        party.rate_unit_type,
        party.rate_base_amount,
        party.rate_unit_amount,
        null,
        null,
        null,
        "2025-01-01",
        "2025-12-31",
        1,
        "NEAREST_CENT",
        `Sales-demo seeded rate for ${party.name}`,
        0,
      ],
    );

    // Step 5: rate_tiers — 1 tier per rate row. Column order:
    // (id, rate_row_id, tier_start, tier_end, unit_amount, base_amount).
    await conn.execute(
      `INSERT IGNORE INTO rate_tiers
         (id, rate_row_id, tier_start, tier_end, unit_amount, base_amount)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        `${rateId}-TIER-001`,
        rateId,
        party.tier_start,
        party.tier_end,
        party.rate_unit_amount,
        party.rate_base_amount,
      ],
    );

    // Step 6: constraint_sets — 1 set per party. Column order:
    // (id, party_id, company_id, applies_to, priority, status,
    //  effective_start, effective_end).
    const constraintSetId = `${party.id}-CSET-001`;
    await conn.execute(
      `INSERT IGNORE INTO constraint_sets
         (id, party_id, company_id, applies_to, priority, status,
          effective_start, effective_end)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        constraintSetId,
        party.id,
        companyId,
        party.constraint_applies_to,
        party.constraint_priority,
        "active",
        "2025-01-01",
        "2025-12-31",
      ],
    );

    // Step 7: constraint_rules — 1 rule per constraint set. Column order:
    // (id, constraint_set_id, rule_type, field_key, operator, value_text,
    //  enforcement, message).
    await conn.execute(
      `INSERT IGNORE INTO constraint_rules
         (id, constraint_set_id, rule_type, field_key, operator, value_text,
          enforcement, message)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        `${constraintSetId}-RULE-001`,
        constraintSetId,
        party.rule_type,
        party.rule_field,
        party.rule_operator,
        party.rule_value,
        "BLOCK",
        party.rule_message,
      ],
    );

    // Step 8: party_catalog_links — 1 link per party. Column order:
    // (id, party_id, catalog_item_id).
    await conn.execute(
      `INSERT IGNORE INTO party_catalog_links
         (id, party_id, catalog_item_id)
       VALUES (?, ?, ?)`,
      [`${party.id}-LINK-001`, party.id, party.catalog_item_id],
    );
  }
}

// ─── Phase 5: Demo exceptions + future-dated load ────────────────────────────
//
// Seeds 3 exceptions (Issues & Alerts page) and 1 future-dated load with
// load_legs (Schedule / Calendar page) so neither page is empty during the
// sales demo.

export const SALES_DEMO_FUTURE_LOAD_ID = "LP-DEMO-FUT-001";

export const SALES_DEMO_EXCEPTION_IDS = [
  "SALES-DEMO-EXC-001",
  "SALES-DEMO-EXC-002",
  "SALES-DEMO-EXC-003",
] as const;

export async function seedSalesDemoExceptionsAndFutureLoad(
  conn: SqlExecutor,
): Promise<void> {
  const companyId = SALES_DEMO_COMPANY_ID;

  // ── 3 demo exceptions linked to company_id = SALES-DEMO-001 ──────────────

  await conn.execute(
    `INSERT IGNORE INTO exceptions
       (id, company_id, type, status, severity, entity_type, entity_id,
        team, workflow_step, financial_impact_est, description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      SALES_DEMO_EXCEPTION_IDS[0],
      companyId,
      "DELAY_REPORTED",
      "OPEN",
      3,
      "LOAD",
      SALES_DEMO_HERO_LOAD_ID,
      "Dispatch",
      "triage",
      250.0,
      "Late delivery warning — LP-DEMO-RC-001 approaching deadline",
    ],
  );

  await conn.execute(
    `INSERT IGNORE INTO exceptions
       (id, company_id, type, status, severity, entity_type, entity_id,
        team, workflow_step, financial_impact_est, description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      SALES_DEMO_EXCEPTION_IDS[1],
      companyId,
      "COMPLIANCE_RESTRICTED",
      "TRIAGED",
      2,
      "DRIVER",
      HERO_DRIVER_ID,
      "Safety",
      "triage",
      0.0,
      "Driver HOS approaching limit — Demo Driver",
    ],
  );

  await conn.execute(
    `INSERT IGNORE INTO exceptions
       (id, company_id, type, status, severity, entity_type, entity_id,
        team, workflow_step, financial_impact_est, description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      SALES_DEMO_EXCEPTION_IDS[2],
      companyId,
      "BREAKDOWN",
      "OPEN",
      1,
      "LOAD",
      SALES_DEMO_HERO_LOAD_ID,
      "Fleet/Maint",
      "triage",
      150.0,
      "Temperature variance on reefer load",
    ],
  );

  // ── 1 future-dated load for the Schedule / Calendar page ──────────────────

  await conn.execute(
    `INSERT IGNORE INTO loads
       (id, company_id, customer_id, driver_id, load_number, status,
        carrier_rate, driver_pay, pickup_date, freight_type, commodity,
        weight, bol_number)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, DATE_ADD(CURDATE(), INTERVAL 3 DAY), ?, ?, ?, ?)`,
    [
      SALES_DEMO_FUTURE_LOAD_ID,
      companyId,
      SALES_DEMO_BROKER_ID,
      HERO_DRIVER_ID,
      SALES_DEMO_FUTURE_LOAD_ID,
      "Planned",
      2800,
      1800,
      "Dry Van",
      "Electronics",
      38000,
      "BOL-DEMO-0002",
    ],
  );

  // ── load_legs for the future load (pickup + dropoff) ──────────────────────

  await conn.execute(
    `INSERT IGNORE INTO load_legs
       (id, load_id, type, facility_name, city, state, date,
        appointment_time, completed, sequence_order)
     VALUES (?, ?, ?, ?, ?, ?, DATE_ADD(CURDATE(), INTERVAL 3 DAY), ?, ?, ?)`,
    [
      "SALES-DEMO-LEG-PICKUP-FUT",
      SALES_DEMO_FUTURE_LOAD_ID,
      "Pickup",
      "Southwest Electronics Depot",
      "Dallas",
      "TX",
      "10:00",
      0,
      1,
    ],
  );

  await conn.execute(
    `INSERT IGNORE INTO load_legs
       (id, load_id, type, facility_name, city, state, date,
        appointment_time, completed, sequence_order)
     VALUES (?, ?, ?, ?, ?, ?, DATE_ADD(CURDATE(), INTERVAL 5 DAY), ?, ?, ?)`,
    [
      "SALES-DEMO-LEG-DROPOFF-FUT",
      SALES_DEMO_FUTURE_LOAD_ID,
      "Dropoff",
      "Memphis Distribution Center",
      "Memphis",
      "TN",
      "14:00",
      0,
      2,
    ],
  );
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
  // Phase 4: CRM registry depth seed — 12 parties + sub-records.
  // ACME Logistics LLC reuses SALES_DEMO_BROKER_ID from Phase 2 so the
  // INSERT IGNORE is a no-op for that row and the rest seed cleanly.
  await seedSalesDemoParties(conn);
  // Phase 5: Demo exceptions + future-dated load for Issues & Schedule pages.
  await seedSalesDemoExceptionsAndFutureLoad(conn);
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
