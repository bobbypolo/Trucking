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

// ─── Phase 6: Fleet richness data ────────────────────────────────────────────
//
// Adds 10 loads across all 8 statuses, 4 drivers, 6 equipment, 8 AR invoices,
// 5 AP bills, journal entries, 6 incidents with timelines, 8 GPS positions,
// 12 exceptions, and 6 compliance records.

export async function seedFleetLoadsAndEquipment(
  conn: SqlExecutor,
): Promise<void> {
  const companyId = SALES_DEMO_COMPANY_ID;

  // ── 4 additional drivers ───────────────────────────────────────────────────

  const fleetDrivers = [
    {
      id: "DEMO-DRV-003",
      email: "demo.driver.3@salesdemo-loadpilot.invalid",
      name: "Marcus Johnson",
      firebase_uid: "demo-firebase-uid-driver-3",
      pay_model: "Per Load",
      pay_rate: 1900,
    },
    {
      id: "DEMO-DRV-004",
      email: "demo.driver.4@salesdemo-loadpilot.invalid",
      name: "Sarah Chen",
      firebase_uid: "demo-firebase-uid-driver-4",
      pay_model: "Per Load",
      pay_rate: 2100,
    },
    {
      id: "DEMO-DRV-005",
      email: "demo.driver.5@salesdemo-loadpilot.invalid",
      name: "James Williams",
      firebase_uid: "demo-firebase-uid-driver-5",
      pay_model: "Per Mile",
      pay_rate: 0.58,
    },
    {
      id: "DEMO-DRV-006",
      email: "demo.driver.6@salesdemo-loadpilot.invalid",
      name: "Elena Rodriguez",
      firebase_uid: "demo-firebase-uid-driver-6",
      pay_model: "Per Mile",
      pay_rate: 0.55,
    },
  ] as const;

  for (const drv of fleetDrivers) {
    await conn.execute(
      `INSERT IGNORE INTO users
         (id, company_id, email, name, role, firebase_uid, pay_model, pay_rate, onboarding_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        drv.id,
        companyId,
        drv.email,
        drv.name,
        "driver",
        drv.firebase_uid,
        drv.pay_model,
        drv.pay_rate,
        "complete",
      ],
    );
  }

  // ── 6 equipment rows ───────────────────────────────────────────────────────

  const equipment = [
    {
      id: "DEMO-EQ-001",
      unit_number: "T-001",
      type: "Truck",
      status: "Active",
      ownership_type: "Company Owned",
      provider_name: "Volvo VNL 860",
      daily_cost: 185.0,
    },
    {
      id: "DEMO-EQ-002",
      unit_number: "T-002",
      type: "Truck",
      status: "Active",
      ownership_type: "Company Owned",
      provider_name: "Freightliner Cascadia",
      daily_cost: 175.0,
    },
    {
      id: "DEMO-EQ-003",
      unit_number: "T-003",
      type: "Truck",
      status: "Active",
      ownership_type: "Lease-to-Own",
      provider_name: "Kenworth T680",
      daily_cost: 195.0,
    },
    {
      id: "DEMO-EQ-004",
      unit_number: "T-004",
      type: "Truck",
      status: "Out of Service",
      ownership_type: "Company Owned",
      provider_name: "Peterbilt 579",
      daily_cost: 0,
    },
    {
      id: "DEMO-EQ-005",
      unit_number: "TR-001",
      type: "Trailer",
      status: "Active",
      ownership_type: "Company Owned",
      provider_name: "Wabash DuraPlate",
      daily_cost: 85.0,
    },
    {
      id: "DEMO-EQ-006",
      unit_number: "TR-002",
      type: "Trailer",
      status: "Active",
      ownership_type: "Rental",
      provider_name: "Utility 3000R Reefer",
      daily_cost: 125.0,
    },
  ] as const;

  for (const eq of equipment) {
    await conn.execute(
      `INSERT IGNORE INTO equipment
         (id, company_id, unit_number, type, status, ownership_type, provider_name, daily_cost)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        eq.id,
        companyId,
        eq.unit_number,
        eq.type,
        eq.status,
        eq.ownership_type,
        eq.provider_name,
        eq.daily_cost,
      ],
    );
  }

  // ── 10 fleet loads ─────────────────────────────────────────────────────────

  const fleetLoads = [
    {
      id: "LP-DEMO-FLT-001",
      driver_id: "DEMO-DRV-003",
      status: "planned",
      carrier_rate: 2800,
      driver_pay: 1900,
      date_offset: 7,
      freight_type: "Flatbed",
      commodity: "Structural Steel Beams",
      weight: 44000,
      bol_number: "BOL-FLT-0001",
    },
    {
      id: "LP-DEMO-FLT-002",
      driver_id: "DEMO-DRV-004",
      status: "planned",
      carrier_rate: 3100,
      driver_pay: 2100,
      date_offset: 10,
      freight_type: "Dry Van",
      commodity: "Consumer Electronics",
      weight: 36000,
      bol_number: "BOL-FLT-0002",
    },
    {
      id: "LP-DEMO-FLT-003",
      driver_id: "DEMO-DRV-005",
      status: "dispatched",
      carrier_rate: 1950,
      driver_pay: 1200,
      date_offset: 1,
      freight_type: "Intermodal",
      commodity: "Auto Parts",
      weight: 32000,
      bol_number: "BOL-FLT-0003",
    },
    {
      id: "LP-DEMO-FLT-004",
      driver_id: "DEMO-DRV-006",
      status: "dispatched",
      carrier_rate: 2600,
      driver_pay: 1800,
      date_offset: 0,
      freight_type: "Reefer",
      commodity: "Fresh Produce",
      weight: 41000,
      bol_number: "BOL-FLT-0004",
    },
    {
      id: "LP-DEMO-FLT-005",
      driver_id: "DEMO-DRV-003",
      status: "in_transit",
      carrier_rate: 1800,
      driver_pay: 1100,
      date_offset: -1,
      freight_type: "Dry Van",
      commodity: "Packaged Foods",
      weight: 38000,
      bol_number: "BOL-FLT-0005",
    },
    {
      id: "LP-DEMO-FLT-006",
      driver_id: "DEMO-DRV-004",
      status: "in_transit",
      carrier_rate: 3400,
      driver_pay: 2200,
      date_offset: -1,
      freight_type: "Flatbed",
      commodity: "Wind Turbine Components",
      weight: 47000,
      bol_number: "BOL-FLT-0006",
    },
    {
      id: "LP-DEMO-FLT-007",
      driver_id: "DEMO-DRV-005",
      status: "arrived",
      carrier_rate: 2200,
      driver_pay: 1500,
      date_offset: -2,
      freight_type: "Reefer",
      commodity: "Pharmaceutical Supplies",
      weight: 28000,
      bol_number: "BOL-FLT-0007",
    },
    {
      id: "LP-DEMO-FLT-008",
      driver_id: "DEMO-DRV-006",
      status: "delivered",
      carrier_rate: 1600,
      driver_pay: 1000,
      date_offset: -5,
      freight_type: "Dry Van",
      commodity: "Retail Merchandise",
      weight: 35000,
      bol_number: "BOL-FLT-0008",
    },
    {
      id: "LP-DEMO-FLT-009",
      driver_id: "SALES-DEMO-DRIVER",
      status: "delivered",
      carrier_rate: 2900,
      driver_pay: 1900,
      date_offset: -7,
      freight_type: "Intermodal",
      commodity: "Industrial Machinery",
      weight: 43000,
      bol_number: "BOL-FLT-0009",
    },
    {
      id: "LP-DEMO-FLT-010",
      driver_id: "DEMO-DRV-003",
      status: "completed",
      carrier_rate: 1400,
      driver_pay: 900,
      date_offset: -14,
      freight_type: "Dry Van",
      commodity: "Paper Products",
      weight: 30000,
      bol_number: "BOL-FLT-0010",
    },
  ] as const;

  for (const load of fleetLoads) {
    await conn.execute(
      `INSERT IGNORE INTO loads
         (id, company_id, customer_id, driver_id, load_number, status,
          carrier_rate, driver_pay, pickup_date, freight_type, commodity, weight, bol_number)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, DATE_ADD(CURDATE(), INTERVAL ? DAY), ?, ?, ?, ?)`,
      [
        load.id,
        companyId,
        SALES_DEMO_BROKER_ID,
        load.driver_id,
        load.id,
        load.status,
        load.carrier_rate,
        load.driver_pay,
        load.date_offset,
        load.freight_type,
        load.commodity,
        load.weight,
        load.bol_number,
      ],
    );
  }

  // ── 20 load legs (pickup + dropoff per load) ──────────────────────────────

  const legPairs = [
    {
      load_id: "LP-DEMO-FLT-001",
      p_off: 7,
      d_off: 9,
      p_fac: "Atlanta Freight Terminal",
      p_city: "Atlanta",
      p_st: "GA",
      d_fac: "Miami Port Warehouse",
      d_city: "Miami",
      d_st: "FL",
      done: 0,
    },
    {
      load_id: "LP-DEMO-FLT-002",
      p_off: 10,
      d_off: 12,
      p_fac: "Los Angeles Intermodal Yard",
      p_city: "Los Angeles",
      p_st: "CA",
      d_fac: "Phoenix Distribution Hub",
      d_city: "Phoenix",
      d_st: "AZ",
      done: 0,
    },
    {
      load_id: "LP-DEMO-FLT-003",
      p_off: 1,
      d_off: 2,
      p_fac: "Detroit Intermodal Yard",
      p_city: "Detroit",
      p_st: "MI",
      d_fac: "Indianapolis Cross-Dock",
      d_city: "Indianapolis",
      d_st: "IN",
      done: 0,
    },
    {
      load_id: "LP-DEMO-FLT-004",
      p_off: 0,
      d_off: 1,
      p_fac: "Seattle Cold Storage Facility",
      p_city: "Seattle",
      p_st: "WA",
      d_fac: "Portland Reefer Terminal",
      d_city: "Portland",
      d_st: "OR",
      done: 0,
    },
    {
      load_id: "LP-DEMO-FLT-005",
      p_off: -1,
      d_off: 0,
      p_fac: "Nashville Consolidation Center",
      p_city: "Nashville",
      p_st: "TN",
      d_fac: "Louisville Distribution Park",
      d_city: "Louisville",
      d_st: "KY",
      done: 0,
    },
    {
      load_id: "LP-DEMO-FLT-006",
      p_off: -1,
      d_off: 1,
      p_fac: "Denver Industrial Complex",
      p_city: "Denver",
      p_st: "CO",
      d_fac: "Kansas City Freight Hub",
      d_city: "Kansas City",
      d_st: "MO",
      done: 0,
    },
    {
      load_id: "LP-DEMO-FLT-007",
      p_off: -2,
      d_off: -1,
      p_fac: "Boston Harbor Terminal",
      p_city: "Boston",
      p_st: "MA",
      d_fac: "New York Metro Warehouse",
      d_city: "New York",
      d_st: "NY",
      done: 0,
    },
    {
      load_id: "LP-DEMO-FLT-008",
      p_off: -5,
      d_off: -3,
      p_fac: "Jacksonville Port Authority",
      p_city: "Jacksonville",
      p_st: "FL",
      d_fac: "Charlotte Regional Depot",
      d_city: "Charlotte",
      d_st: "NC",
      done: 1,
    },
    {
      load_id: "LP-DEMO-FLT-009",
      p_off: -7,
      d_off: -5,
      p_fac: "Minneapolis Rail Terminal",
      p_city: "Minneapolis",
      p_st: "MN",
      d_fac: "Milwaukee Transfer Station",
      d_city: "Milwaukee",
      d_st: "WI",
      done: 1,
    },
    {
      load_id: "LP-DEMO-FLT-010",
      p_off: -14,
      d_off: -13,
      p_fac: "San Antonio Logistics Park",
      p_city: "San Antonio",
      p_st: "TX",
      d_fac: "El Paso Border Crossing Depot",
      d_city: "El Paso",
      d_st: "TX",
      done: 1,
    },
  ] as const;

  for (let i = 0; i < legPairs.length; i++) {
    const leg = legPairs[i];
    const idx = String(i + 1).padStart(3, "0");
    await conn.execute(
      `INSERT IGNORE INTO load_legs (id, load_id, type, facility_name, city, state, date, appointment_time, completed, sequence_order)
       VALUES (?, ?, ?, ?, ?, ?, DATE_ADD(CURDATE(), INTERVAL ? DAY), ?, ?, ?)`,
      [
        `DEMO-LEG-P-FLT-${idx}`,
        leg.load_id,
        "Pickup",
        leg.p_fac,
        leg.p_city,
        leg.p_st,
        leg.p_off,
        "08:00",
        leg.done,
        1,
      ],
    );
    await conn.execute(
      `INSERT IGNORE INTO load_legs (id, load_id, type, facility_name, city, state, date, appointment_time, completed, sequence_order)
       VALUES (?, ?, ?, ?, ?, ?, DATE_ADD(CURDATE(), INTERVAL ? DAY), ?, ?, ?)`,
      [
        `DEMO-LEG-D-FLT-${idx}`,
        leg.load_id,
        "Dropoff",
        leg.d_fac,
        leg.d_city,
        leg.d_st,
        leg.d_off,
        "14:00",
        leg.done,
        2,
      ],
    );
  }
}

export async function seedFinancialData(conn: SqlExecutor): Promise<void> {
  const companyId = SALES_DEMO_COMPANY_ID;
  const customerId = SALES_DEMO_BROKER_ID;

  // ── AR Invoices ────────────────────────────────────────────────────────────

  const arInvoices = [
    {
      id: "DEMO-INV-001",
      num: "INV-2026-001",
      loadId: "LP-DEMO-RC-001",
      status: "Paid",
      total: 3250.0,
      balance: 0.0,
      dateOff: -30,
      dueOff: 0,
      notes: "Hero load — Frozen Beef Houston to Chicago",
    },
    {
      id: "DEMO-INV-002",
      num: "INV-2026-002",
      loadId: "LP-DEMO-FLT-010",
      status: "Paid",
      total: 1400.0,
      balance: 0.0,
      dateOff: -20,
      dueOff: 10,
      notes: "Fleet load FLT-010",
    },
    {
      id: "DEMO-INV-003",
      num: "INV-2026-003",
      loadId: "LP-DEMO-FLT-009",
      status: "Partial",
      total: 2900.0,
      balance: 1450.0,
      dateOff: -12,
      dueOff: 18,
      notes: "Fleet load FLT-009 — partial payment received",
    },
    {
      id: "DEMO-INV-004",
      num: "INV-2026-004",
      loadId: "LP-DEMO-FLT-008",
      status: "Sent",
      total: 1600.0,
      balance: 1600.0,
      dateOff: -8,
      dueOff: 22,
      notes: "Fleet load FLT-008",
    },
    {
      id: "DEMO-INV-005",
      num: "INV-2026-005",
      loadId: "LP-DEMO-FLT-007",
      status: "Sent",
      total: 2200.0,
      balance: 2200.0,
      dateOff: -5,
      dueOff: 25,
      notes: "Fleet load FLT-007",
    },
    {
      id: "DEMO-INV-006",
      num: "INV-2026-006",
      loadId: "LP-DEMO-FLT-006",
      status: "Sent",
      total: 3400.0,
      balance: 3400.0,
      dateOff: -3,
      dueOff: 27,
      notes: "Fleet load FLT-006",
    },
    {
      id: "DEMO-INV-007",
      num: "INV-2026-007",
      loadId: "LP-DEMO-FLT-005",
      status: "Overdue",
      total: 1800.0,
      balance: 1800.0,
      dateOff: -15,
      dueOff: -5,
      notes: "Fleet load FLT-005 — OVERDUE",
    },
    {
      id: "DEMO-INV-008",
      num: "INV-2026-008",
      loadId: "LP-DEMO-FLT-003",
      status: "Draft",
      total: 1950.0,
      balance: 1950.0,
      dateOff: 0,
      dueOff: 30,
      notes: "Fleet load FLT-003 — draft",
    },
  ] as const;

  for (const inv of arInvoices) {
    await conn.execute(
      `INSERT IGNORE INTO ar_invoices
         (id, company_id, customer_id, load_id, invoice_number, invoice_date, due_date, status, total_amount, balance_due, notes)
       VALUES (?, ?, ?, ?, ?, DATE_ADD(CURDATE(), INTERVAL ? DAY), DATE_ADD(CURDATE(), INTERVAL ? DAY), ?, ?, ?, ?)`,
      [
        inv.id,
        companyId,
        customerId,
        inv.loadId,
        inv.num,
        inv.dateOff,
        inv.dueOff,
        inv.status,
        inv.total,
        inv.balance,
        inv.notes,
      ],
    );
  }

  // ── AP Bills ───────────────────────────────────────────────────────────────

  const apBills = [
    {
      id: "DEMO-BILL-001",
      num: "BILL-F-001",
      status: "Paid",
      total: 1875.5,
      balance: 0.0,
      dateOff: -25,
      notes: "Fuel — 500 gal diesel",
    },
    {
      id: "DEMO-BILL-002",
      num: "BILL-M-001",
      status: "Paid",
      total: 2340.0,
      balance: 0.0,
      dateOff: -18,
      notes: "Maintenance — brake replacement T-004",
    },
    {
      id: "DEMO-BILL-003",
      num: "BILL-F-002",
      status: "Pending",
      total: 2156.75,
      balance: 2156.75,
      dateOff: -5,
      notes: "Fuel — 575 gal diesel",
    },
    {
      id: "DEMO-BILL-004",
      num: "BILL-T-001",
      status: "Approved",
      total: 1680.0,
      balance: 1680.0,
      dateOff: -3,
      notes: "Tire replacement — 4 steer tires T-001",
    },
    {
      id: "DEMO-BILL-005",
      num: "BILL-P-001",
      status: "Pending",
      total: 945.0,
      balance: 945.0,
      dateOff: -1,
      notes: "Parts — air compressor rebuild TR-001",
    },
  ] as const;

  for (const bill of apBills) {
    await conn.execute(
      `INSERT IGNORE INTO ap_bills
         (id, company_id, vendor_id, bill_number, bill_date, due_date, status, total_amount, balance_due, notes)
       VALUES (?, ?, NULL, ?, DATE_ADD(CURDATE(), INTERVAL ? DAY), DATE_ADD(CURDATE(), INTERVAL ? DAY), ?, ?, ?, ?)`,
      [
        bill.id,
        companyId,
        bill.num,
        bill.dateOff,
        bill.dateOff + 30,
        bill.status,
        bill.total,
        bill.balance,
        bill.notes,
      ],
    );
  }

  // ── Journal Entries + Lines ────────────────────────────────────────────────

  const journalEntries = [
    {
      id: "DEMO-JE-001",
      dateOff: -30,
      ref: "INV-2026-001",
      desc: "Invoice INV-2026-001 — AR recognition",
      srcType: "Invoice",
      srcId: "DEMO-INV-001",
    },
    {
      id: "DEMO-JE-002",
      dateOff: -20,
      ref: "INV-2026-002",
      desc: "Invoice INV-2026-002 — AR recognition",
      srcType: "Invoice",
      srcId: "DEMO-INV-002",
    },
    {
      id: "DEMO-JE-003",
      dateOff: -12,
      ref: "INV-2026-003",
      desc: "Invoice INV-2026-003 — AR recognition",
      srcType: "Invoice",
      srcId: "DEMO-INV-003",
    },
    {
      id: "DEMO-JE-004",
      dateOff: -20,
      ref: "PMT-INV-001",
      desc: "Payment received for INV-2026-001",
      srcType: "Payment",
      srcId: "DEMO-INV-001",
    },
    {
      id: "DEMO-JE-005",
      dateOff: -10,
      ref: "PMT-INV-002",
      desc: "Payment received for INV-2026-002",
      srcType: "Payment",
      srcId: "DEMO-INV-002",
    },
    {
      id: "DEMO-JE-006",
      dateOff: -7,
      ref: "PMT-INV-003",
      desc: "Partial payment for INV-2026-003",
      srcType: "Payment",
      srcId: "DEMO-INV-003",
    },
    {
      id: "DEMO-JE-007",
      dateOff: -25,
      ref: "BILL-F-001",
      desc: "Bill BILL-F-001 — fuel expense",
      srcType: "Bill",
      srcId: "DEMO-BILL-001",
    },
    {
      id: "DEMO-JE-008",
      dateOff: -18,
      ref: "BILL-M-001",
      desc: "Bill BILL-M-001 — maintenance expense",
      srcType: "Bill",
      srcId: "DEMO-BILL-002",
    },
    {
      id: "DEMO-JE-009",
      dateOff: -15,
      ref: "PMT-BILL-F-001",
      desc: "Payment for BILL-F-001",
      srcType: "Payment",
      srcId: "DEMO-BILL-001",
    },
    {
      id: "DEMO-JE-010",
      dateOff: -10,
      ref: "PMT-BILL-M-001",
      desc: "Payment for BILL-M-001",
      srcType: "Payment",
      srcId: "DEMO-BILL-002",
    },
  ] as const;

  for (const je of journalEntries) {
    await conn.execute(
      `INSERT IGNORE INTO journal_entries
         (id, company_id, entry_date, reference_number, description, source_document_type, source_document_id, posted_at, created_by)
       VALUES (?, ?, DATE_ADD(CURDATE(), INTERVAL ? DAY), ?, ?, ?, ?, NOW(), 'DEMO-SEED')`,
      [je.id, companyId, je.dateOff, je.ref, je.desc, je.srcType, je.srcId],
    );
  }

  // Journal lines: 2 per entry (debit + credit)
  const lines: Array<[string, string, string, number, number, string]> = [
    ["DEMO-JL-001", "DEMO-JE-001", "GL-1200", 3250, 0, "AR: INV-001"],
    ["DEMO-JL-002", "DEMO-JE-001", "GL-4000", 0, 3250, "Revenue: INV-001"],
    ["DEMO-JL-003", "DEMO-JE-002", "GL-1200", 1400, 0, "AR: INV-002"],
    ["DEMO-JL-004", "DEMO-JE-002", "GL-4000", 0, 1400, "Revenue: INV-002"],
    ["DEMO-JL-005", "DEMO-JE-003", "GL-1200", 2900, 0, "AR: INV-003"],
    ["DEMO-JL-006", "DEMO-JE-003", "GL-4000", 0, 2900, "Revenue: INV-003"],
    ["DEMO-JL-007", "DEMO-JE-004", "GL-4000", 3250, 0, "Cash receipt: INV-001"],
    ["DEMO-JL-008", "DEMO-JE-004", "GL-1200", 0, 3250, "Clear AR: INV-001"],
    ["DEMO-JL-009", "DEMO-JE-005", "GL-4000", 1400, 0, "Cash receipt: INV-002"],
    ["DEMO-JL-010", "DEMO-JE-005", "GL-1200", 0, 1400, "Clear AR: INV-002"],
    [
      "DEMO-JL-011",
      "DEMO-JE-006",
      "GL-4000",
      1450,
      0,
      "Partial receipt: INV-003",
    ],
    [
      "DEMO-JL-012",
      "DEMO-JE-006",
      "GL-1200",
      0,
      1450,
      "Partial clear AR: INV-003",
    ],
    [
      "DEMO-JL-013",
      "DEMO-JE-007",
      "GL-6200",
      1875.5,
      0,
      "Fuel expense: BILL-F-001",
    ],
    ["DEMO-JL-014", "DEMO-JE-007", "GL-2000", 0, 1875.5, "AP: BILL-F-001"],
    [
      "DEMO-JL-015",
      "DEMO-JE-008",
      "GL-6100",
      2340,
      0,
      "Maintenance: BILL-M-001",
    ],
    ["DEMO-JL-016", "DEMO-JE-008", "GL-2000", 0, 2340, "AP: BILL-M-001"],
    [
      "DEMO-JL-017",
      "DEMO-JE-009",
      "GL-2000",
      1875.5,
      0,
      "Clear AP: BILL-F-001",
    ],
    [
      "DEMO-JL-018",
      "DEMO-JE-009",
      "GL-6200",
      0,
      1875.5,
      "Cash paid: BILL-F-001",
    ],
    ["DEMO-JL-019", "DEMO-JE-010", "GL-2000", 2340, 0, "Clear AP: BILL-M-001"],
    ["DEMO-JL-020", "DEMO-JE-010", "GL-6100", 0, 2340, "Cash paid: BILL-M-001"],
  ];

  for (const [id, jeId, glId, debit, credit, notes] of lines) {
    await conn.execute(
      `INSERT IGNORE INTO journal_lines (id, journal_entry_id, gl_account_id, debit, credit, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, jeId, glId, debit, credit, notes],
    );
  }
}

export async function seedIncidentsAndGps(conn: SqlExecutor): Promise<void> {
  const companyId = SALES_DEMO_COMPANY_ID;

  // ── 6 Incidents ────────────────────────────────────────────────────────────

  const incidents = [
    {
      id: "DEMO-INC-001",
      load_id: "LP-DEMO-FLT-005",
      type: "Breakdown",
      severity: "Critical",
      status: "Open",
      hrs_ago: 3,
      sla_hrs: 1,
      desc: "Engine overheating — driver pulled over I-65 southbound mile marker 89",
      lat: 36.1627,
      lng: -86.7816,
      plan: "Mobile mechanic dispatched. Backup truck staged in Nashville yard.",
    },
    {
      id: "DEMO-INC-002",
      load_id: "LP-DEMO-FLT-006",
      type: "Accident",
      severity: "Critical",
      status: "In_Progress",
      hrs_ago: 2,
      sla_hrs: 1,
      desc: "Minor fender bender at truck stop — no injuries, documenting damage",
      lat: 38.8339,
      lng: -104.8214,
      plan: "Police report filed. Insurance adjuster reviewing photos.",
    },
    {
      id: "DEMO-INC-003",
      load_id: "LP-DEMO-FLT-004",
      type: "Reefer Temp",
      severity: "High",
      status: "Open",
      hrs_ago: 1,
      sla_hrs: 6,
      desc: "Reefer unit reading 38F — set point 32F, rising 1F per hour",
      lat: 47.6062,
      lng: -122.3321,
      plan: "Driver inspecting unit. Reefer maintenance vendor on standby.",
    },
    {
      id: "DEMO-INC-004",
      load_id: "LP-DEMO-FLT-005",
      type: "HOS Risk",
      severity: "High",
      status: "Open",
      hrs_ago: 1,
      sla_hrs: 6,
      desc: "Driver approaching 10.5 hours on duty — 30 minutes remaining",
      lat: 36.1627,
      lng: -86.7816,
      plan: "Relay driver pre-positioned at Nashville terminal.",
    },
    {
      id: "DEMO-INC-005",
      load_id: "LP-DEMO-FLT-007",
      type: "Cargo Issue",
      severity: "Medium",
      status: "Open",
      hrs_ago: 4,
      sla_hrs: 24,
      desc: "Customer reports 2 pallets short — 48 received of 50 ordered",
      lat: 40.7128,
      lng: -74.006,
      plan: "Cross-referencing BOL with warehouse load-out records.",
    },
    {
      id: "DEMO-INC-006",
      load_id: "LP-DEMO-FLT-003",
      type: "Weather Shutdown",
      severity: "Medium",
      status: "In_Progress",
      hrs_ago: 6,
      sla_hrs: 24,
      desc: "Severe thunderstorm warning — driver holding at rest area",
      lat: 42.3314,
      lng: -83.0458,
      plan: "Monitoring NWS radar. Driver safe at rest area.",
    },
  ] as const;

  for (const inc of incidents) {
    await conn.execute(
      `INSERT IGNORE INTO incidents
         (id, load_id, type, severity, status, reported_at, sla_deadline, description, location_lat, location_lng, recovery_plan)
       VALUES (?, ?, ?, ?, ?, DATE_SUB(NOW(), INTERVAL ? HOUR), DATE_ADD(DATE_SUB(NOW(), INTERVAL ? HOUR), INTERVAL ? HOUR), ?, ?, ?, ?)`,
      [
        inc.id,
        inc.load_id,
        inc.type,
        inc.severity,
        inc.status,
        inc.hrs_ago,
        inc.hrs_ago,
        inc.sla_hrs,
        inc.desc,
        inc.lat,
        inc.lng,
        inc.plan,
      ],
    );
  }

  // ── Incident Actions (15 total) ────────────────────────────────────────────

  const actions: Array<[string, string, string, string, string, number]> = [
    [
      "DEMO-IA-001",
      "DEMO-INC-001",
      "System",
      "ALERT_GENERATED",
      "Engine temp critical alert triggered",
      180,
    ],
    [
      "DEMO-IA-002",
      "DEMO-INC-001",
      "Demo Driver",
      "DRIVER_REPORTED",
      "Pulled over safely, engine smoking",
      150,
    ],
    [
      "DEMO-IA-003",
      "DEMO-INC-001",
      "Dispatch Admin",
      "ROADSIDE_DISPATCHED",
      "Mobile mechanic dispatched — ETA 45 min",
      120,
    ],
    [
      "DEMO-IA-004",
      "DEMO-INC-002",
      "System",
      "ALERT_GENERATED",
      "Impact event detected",
      120,
    ],
    [
      "DEMO-IA-005",
      "DEMO-INC-002",
      "Sarah Chen",
      "DRIVER_REPORTED",
      "Low speed parking lot contact, other driver at fault",
      90,
    ],
    [
      "DEMO-IA-006",
      "DEMO-INC-002",
      "Dispatch Admin",
      "STAKEHOLDERS_NOTIFIED",
      "Insurance notified, police report #CR-2026-4412",
      60,
    ],
    [
      "DEMO-IA-007",
      "DEMO-INC-003",
      "System",
      "ALERT_GENERATED",
      "Reefer temperature deviation +6F above set point",
      60,
    ],
    [
      "DEMO-IA-008",
      "DEMO-INC-003",
      "Dispatch Admin",
      "ACKNOWLEDGED",
      "Monitoring — driver instructed to check unit",
      30,
    ],
    [
      "DEMO-IA-009",
      "DEMO-INC-004",
      "System",
      "ALERT_GENERATED",
      "HOS violation risk — driver at 10.5 of 11 hours",
      55,
    ],
    [
      "DEMO-IA-010",
      "DEMO-INC-004",
      "Dispatch Admin",
      "ACKNOWLEDGED",
      "Relay driver confirmed en route to Nashville terminal",
      40,
    ],
    [
      "DEMO-IA-011",
      "DEMO-INC-005",
      "System",
      "ALERT_GENERATED",
      "Customer shortage claim — 2 pallets",
      240,
    ],
    [
      "DEMO-IA-012",
      "DEMO-INC-005",
      "Dispatch Admin",
      "ACKNOWLEDGED",
      "Requested BOL photos and warehouse manifest",
      200,
    ],
    [
      "DEMO-IA-013",
      "DEMO-INC-005",
      "Dispatch Admin",
      "STAKEHOLDERS_NOTIFIED",
      "Shipper contacted for recount at origin",
      160,
    ],
    [
      "DEMO-IA-014",
      "DEMO-INC-006",
      "System",
      "ALERT_GENERATED",
      "NWS severe thunderstorm warning Wayne County MI",
      360,
    ],
    [
      "DEMO-IA-015",
      "DEMO-INC-006",
      "Dispatch Admin",
      "ACKNOWLEDGED",
      "Driver holding at rest area until warning expires",
      330,
    ],
  ];

  for (const [id, incId, actor, action, notes, minsAgo] of actions) {
    await conn.execute(
      `INSERT IGNORE INTO incident_actions (id, incident_id, actor_name, action, notes, timestamp)
       VALUES (?, ?, ?, ?, ?, DATE_SUB(NOW(), INTERVAL ? MINUTE))`,
      [id, incId, actor, action, notes, minsAgo],
    );
  }

  // ── 8 GPS Positions ────────────────────────────────────────────────────────

  const gps: Array<
    [string, string, string, number, number, number, number, number, string]
  > = [
    [
      "DEMO-GPS-001",
      "DEMO-EQ-001",
      "DEMO-DRV-003",
      36.1627,
      -86.7816,
      0,
      180,
      5,
      "001",
    ],
    [
      "DEMO-GPS-002",
      "DEMO-EQ-002",
      "DEMO-DRV-004",
      38.8339,
      -104.8214,
      0,
      270,
      10,
      "002",
    ],
    [
      "DEMO-GPS-003",
      "DEMO-EQ-003",
      "DEMO-DRV-005",
      40.7128,
      -74.006,
      0,
      90,
      15,
      "003",
    ],
    [
      "DEMO-GPS-004",
      "DEMO-EQ-004",
      "DEMO-DRV-006",
      47.6062,
      -122.3321,
      0,
      180,
      8,
      "004",
    ],
    [
      "DEMO-GPS-005",
      "DEMO-EQ-005",
      "SALES-DEMO-DRIVER",
      44.9778,
      -93.265,
      62,
      90,
      20,
      "005",
    ],
    [
      "DEMO-GPS-006",
      "DEMO-EQ-001",
      "DEMO-DRV-003",
      38.2527,
      -85.7585,
      58,
      45,
      30,
      "006",
    ],
    [
      "DEMO-GPS-007",
      "DEMO-EQ-002",
      "DEMO-DRV-004",
      39.7392,
      -104.9903,
      65,
      180,
      45,
      "007",
    ],
    [
      "DEMO-GPS-008",
      "DEMO-EQ-003",
      "DEMO-DRV-005",
      42.3314,
      -83.0458,
      0,
      0,
      60,
      "008",
    ],
  ];

  for (const [
    id,
    vehId,
    drvId,
    lat,
    lng,
    speed,
    heading,
    minsAgo,
    num,
  ] of gps) {
    await conn.execute(
      `INSERT IGNORE INTO gps_positions
         (id, company_id, vehicle_id, driver_id, latitude, longitude, speed, heading, recorded_at, provider, provider_vehicle_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, DATE_SUB(NOW(), INTERVAL ? MINUTE), ?, ?)`,
      [
        id,
        companyId,
        vehId,
        drvId,
        lat,
        lng,
        speed,
        heading,
        minsAgo,
        "Samsara",
        `samsara-demo-${num}`,
      ],
    );
  }
}

export async function seedExceptionsAndSafety(
  conn: SqlExecutor,
): Promise<void> {
  const companyId = SALES_DEMO_COMPANY_ID;

  // ── 12 Exceptions ──────────────────────────────────────────────────────────

  const exceptions = [
    {
      id: "DEMO-EXC-004",
      type: "SAFETY_INCIDENT",
      status: "OPEN",
      severity: 4,
      eType: "DRIVER",
      eId: "DEMO-DRV-003",
      team: "Safety",
      impact: 500,
      desc: "Speeding alert — 78mph in 65mph zone on I-40",
    },
    {
      id: "DEMO-EXC-005",
      type: "SAFETY_INCIDENT",
      status: "TRIAGED",
      severity: 3,
      eType: "DRIVER",
      eId: "DEMO-DRV-005",
      team: "Safety",
      impact: 0,
      desc: "Hard braking event detected — investigating",
    },
    {
      id: "DEMO-EXC-006",
      type: "SAFETY_INCIDENT",
      status: "OPEN",
      severity: 3,
      eType: "DRIVER",
      eId: "DEMO-DRV-004",
      team: "Safety",
      impact: 250,
      desc: "Near-miss report filed by driver — merging incident",
    },
    {
      id: "DEMO-EXC-007",
      type: "MAINTENANCE_REQUEST",
      status: "OPEN",
      severity: 3,
      eType: "TRUCK",
      eId: "DEMO-EQ-001",
      team: "Fleet/Maint",
      impact: 1200,
      desc: "Brake pad replacement due — 85% wear detected",
    },
    {
      id: "DEMO-EXC-008",
      type: "MAINTENANCE_REQUEST",
      status: "TRIAGED",
      severity: 2,
      eType: "TRUCK",
      eId: "DEMO-EQ-003",
      team: "Fleet/Maint",
      impact: 500,
      desc: "Tire pressure low — right rear steer 85 PSI (spec: 105)",
    },
    {
      id: "DEMO-EXC-009",
      type: "BREAKDOWN",
      status: "ESCALATED",
      severity: 3,
      eType: "TRUCK",
      eId: "DEMO-EQ-004",
      team: "Fleet/Maint",
      impact: 3000,
      desc: "Reefer compressor intermittent failure — unit out of service",
    },
    {
      id: "DEMO-EXC-010",
      type: "COMPLIANCE_RESTRICTED",
      status: "OPEN",
      severity: 3,
      eType: "DRIVER",
      eId: "DEMO-DRV-006",
      team: "Safety",
      impact: 0,
      desc: "Medical card expires in 25 days — renewal required",
    },
    {
      id: "DEMO-EXC-011",
      type: "COMPLIANCE_RESTRICTED",
      status: "TRIAGED",
      severity: 2,
      eType: "DRIVER",
      eId: "DEMO-DRV-003",
      team: "Safety",
      impact: 0,
      desc: "Annual insurance verification pending",
    },
    {
      id: "DEMO-EXC-012",
      type: "BILLING_DISPUTE",
      status: "OPEN",
      severity: 2,
      eType: "LOAD",
      eId: "LP-DEMO-FLT-008",
      team: "Accounting",
      impact: 350,
      desc: "Customer disputing $350 detention charge",
    },
    {
      id: "DEMO-EXC-013",
      type: "DETENTION_ALERT",
      status: "OPEN",
      severity: 1,
      eType: "LOAD",
      eId: "LP-DEMO-FLT-007",
      team: "Dispatch",
      impact: 100,
      desc: "4.5 hours at facility — approaching detention threshold",
    },
    {
      id: "DEMO-EXC-014",
      type: "DOCUMENT_MISSING",
      status: "OPEN",
      severity: 2,
      eType: "LOAD",
      eId: "LP-DEMO-FLT-008",
      team: "Accounting",
      impact: 200,
      desc: "POD not yet received from consignee",
    },
    {
      id: "DEMO-EXC-015",
      type: "DOCUMENT_MISSING",
      status: "TRIAGED",
      severity: 1,
      eType: "LOAD",
      eId: "LP-DEMO-FLT-009",
      team: "Accounting",
      impact: 0,
      desc: "Lumper receipt scan needed for reimbursement",
    },
  ] as const;

  for (const exc of exceptions) {
    await conn.execute(
      `INSERT IGNORE INTO exceptions
         (id, company_id, type, status, severity, entity_type, entity_id, team, workflow_step, financial_impact_est, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        exc.id,
        companyId,
        exc.type,
        exc.status,
        exc.severity,
        exc.eType,
        exc.eId,
        exc.team,
        "triage",
        exc.impact,
        exc.desc,
      ],
    );
  }

  // ── 6 Compliance Records ───────────────────────────────────────────────────

  const complianceRecords = [
    {
      id: "DEMO-CR-001",
      userId: "SALES-DEMO-DRIVER",
      type: "CDL",
      offsetDays: 365,
      status: "Valid",
    },
    {
      id: "DEMO-CR-002",
      userId: "DEMO-DRV-003",
      type: "CDL",
      offsetDays: 180,
      status: "Valid",
    },
    {
      id: "DEMO-CR-003",
      userId: "DEMO-DRV-004",
      type: "Medical_Card",
      offsetDays: 25,
      status: "Valid",
    },
    {
      id: "DEMO-CR-004",
      userId: "DEMO-DRV-005",
      type: "Medical_Card",
      offsetDays: -10,
      status: "Expired",
    },
    {
      id: "DEMO-CR-005",
      userId: "DEMO-DRV-006",
      type: "Drug_Test",
      offsetDays: 300,
      status: "Valid",
    },
    {
      id: "DEMO-CR-006",
      userId: "DEMO-DRV-003",
      type: "Drug_Test",
      offsetDays: 250,
      status: "Valid",
    },
  ] as const;

  for (const cr of complianceRecords) {
    await conn.execute(
      `INSERT IGNORE INTO compliance_records
         (id, user_id, type, expiry_date, status, document_url, is_mandatory)
       VALUES (?, ?, ?, DATE_ADD(CURDATE(), INTERVAL ? DAY), ?, NULL, 1)`,
      [cr.id, cr.userId, cr.type, cr.offsetDays, cr.status],
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
  await seedSalesDemoLoads(conn, env);
  // Phase 3: trip-based IFTA Q4 2025 evidence seed.
  await seedSalesDemoIfta(conn);
  // Phase 4: CRM registry depth seed — 12 parties + sub-records.
  await seedSalesDemoParties(conn);
  // Phase 5: Demo exceptions + future-dated load.
  await seedSalesDemoExceptionsAndFutureLoad(conn);
  // Phase 6: Fleet richness data — loads, financials, incidents, safety.
  await seedFleetLoadsAndEquipment(conn);
  await seedFinancialData(conn);
  await seedIncidentsAndGps(conn);
  await seedExceptionsAndSafety(conn);
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
