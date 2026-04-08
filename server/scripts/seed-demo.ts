/**
 * Demo Seed Script — LoadPilot (DisbatchMe)
 *
 * Populates a demo tenant with realistic trucking business data so that
 * dashboards, load boards, accounting views, and incident consoles all
 * render with meaningful content during a sales or QA demo.
 *
 * IMPORTANT:
 *   - All seeded records use the company name "Demo Freight Co" and IDs
 *     prefixed with "DEMO-" so they are clearly distinguishable from
 *     real production data. Never label seeded data as live.
 *   - This script is IDEMPOTENT: running it twice will not duplicate
 *     records. It uses INSERT IGNORE / REPLACE INTO as appropriate.
 *   - Only run against a development or staging database. Never run
 *     against a real customer tenant's production database.
 *
 * Usage (run from project root):
 *   npx ts-node server/scripts/seed-demo.ts
 *   npx ts-node server/scripts/seed-demo.ts --dry-run   (shows SQL without executing)
 *
 * Environment variables required (from .env):
 *   DB_HOST, DB_USER, DB_PASSWORD, DB_NAME
 *
 * Optional:
 *   DEMO_COMPANY_ID  — override the demo company UUID (default: DEMO-COMPANY-001)
 *
 * Exit codes:
 *   0 — seed completed successfully
 *   1 — seed failed (see error output)
 */

import * as path from "path";
import * as fs from "fs";
import dotenv from "dotenv";
import mysql from "mysql2/promise";
import type { RowDataPacket } from "mysql2/promise";

// Load .env from the project root (two levels up from server/scripts/)
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

// ─── Types ────────────────────────────────────────────────────────────────────

interface SeedData {
  _meta: Record<string, string>;
  company: CompanyRecord;
  users: UserRecord[];
  customers: CustomerRecord[];
  parties: PartyRecord[];
  loads: LoadRecord[];
  incidents: IncidentRecord[];
  ar_invoices: InvoiceRecord[];
  ap_bills: BillRecord[];
  gl_accounts: GlAccountRecord[];
}

interface CompanyRecord {
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
  subscription_status: string;
}

interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: string;
  pay_model: string;
  pay_rate: number;
  onboarding_status: string;
}

interface CustomerRecord {
  id: string;
  name: string;
  type: string;
  mc_number: string | null;
  dot_number: string | null;
  email: string;
  phone: string;
  address: string;
  payment_terms: string;
}

interface PartyRecord {
  id: string;
  name: string;
  type: string;
  is_customer: number;
  is_vendor: number;
  status: string;
  mc_number: string | null;
  dot_number: string | null;
  rating: number | null;
}

interface LoadLeg {
  type: string;
  facility_name: string;
  city: string;
  state: string;
  date: string;
  appointment_time: string;
  completed: boolean;
  sequence_order: number;
}

interface LoadRecord {
  id: string;
  load_number: string;
  status: string;
  customer_ref: string | null;
  driver_ref: string | null;
  dispatcher_ref: string | null;
  carrier_rate: number;
  driver_pay: number;
  pickup_date: string | null;
  freight_type: string;
  commodity: string;
  weight: number;
  bol_number: string | null;
  legs: LoadLeg[];
}

interface IncidentRecord {
  id: string;
  load_ref: string;
  type: string;
  severity: string;
  status: string;
  sla_deadline: string;
  description: string;
  location_lat: number;
  location_lng: number;
  recovery_plan: string;
}

interface InvoiceRecord {
  id: string;
  load_ref: string;
  customer_ref: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  status: string;
  total_amount: number;
  description: string;
}

interface BillRecord {
  id: string;
  vendor_ref: string;
  bill_number: string;
  bill_date: string;
  due_date: string;
  status: string;
  total_amount: number;
  description: string;
}

interface GlAccountRecord {
  id: string;
  account_number: string;
  name: string;
  type: string;
  sub_type: string;
  description: string;
  is_active: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const isDryRun = process.argv.includes("--dry-run");

let queryCount = 0;

async function exec(
  conn: mysql.Connection,
  sql: string,
  params: unknown[] = [],
): Promise<void> {
  queryCount++;
  if (isDryRun) {
    console.log(`[DRY-RUN] SQL: ${sql.replace(/\s+/g, " ").trim()}`);
    console.log(`          Params: ${JSON.stringify(params)}`);
    return;
  }
  await conn.execute(sql, params);
}

function log(msg: string): void {
  const ts = new Date().toISOString().substring(11, 19);
  console.log(`[${ts}] ${msg}`);
}

// ─── Seed Functions ───────────────────────────────────────────────────────────

async function seedCompany(
  conn: mysql.Connection,
  company: CompanyRecord,
): Promise<void> {
  log(`Seeding company: ${company.name} (${company.id})`);
  await exec(
    conn,
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
}

async function seedUsers(
  conn: mysql.Connection,
  companyId: string,
  users: UserRecord[],
): Promise<void> {
  for (const user of users) {
    log(`Seeding user: ${user.name} (${user.role})`);
    await exec(
      conn,
      `INSERT IGNORE INTO users
         (id, company_id, email, name, role, pay_model, pay_rate,
          onboarding_status, safety_score, compliance_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user.id,
        companyId,
        user.email,
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

async function seedCustomers(
  conn: mysql.Connection,
  companyId: string,
  customers: CustomerRecord[],
): Promise<void> {
  for (const customer of customers) {
    log(`Seeding customer: ${customer.name}`);
    await exec(
      conn,
      `INSERT IGNORE INTO customers
         (id, company_id, name, type, mc_number, dot_number, email,
          phone, address, payment_terms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        customer.id,
        companyId,
        customer.name,
        customer.type,
        customer.mc_number,
        customer.dot_number,
        customer.email,
        customer.phone,
        customer.address,
        customer.payment_terms,
      ],
    );
  }
}

async function seedParties(
  conn: mysql.Connection,
  companyId: string,
  parties: PartyRecord[],
): Promise<void> {
  for (const party of parties) {
    log(`Seeding party: ${party.name} (${party.type})`);
    await exec(
      conn,
      `INSERT IGNORE INTO parties
         (id, company_id, name, type, is_customer, is_vendor, status,
          mc_number, dot_number, rating)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        party.id,
        companyId,
        party.name,
        party.type,
        party.is_customer,
        party.is_vendor,
        party.status,
        party.mc_number,
        party.dot_number,
        party.rating,
      ],
    );
  }
}

async function seedLoads(
  conn: mysql.Connection,
  companyId: string,
  loads: LoadRecord[],
): Promise<void> {
  for (const load of loads) {
    log(`Seeding load: ${load.load_number} (status: ${load.status})`);
    await exec(
      conn,
      `INSERT IGNORE INTO loads
         (id, company_id, customer_id, driver_id, dispatcher_id,
          load_number, status, carrier_rate, driver_pay, pickup_date,
          freight_type, commodity, weight, bol_number,
          notification_emails, gps_history, pod_urls)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        load.id,
        companyId,
        load.customer_ref,
        load.driver_ref,
        load.dispatcher_ref,
        load.load_number,
        load.status,
        load.carrier_rate,
        load.driver_pay,
        load.pickup_date,
        load.freight_type,
        load.commodity,
        load.weight,
        load.bol_number,
        JSON.stringify([]),
        JSON.stringify([]),
        JSON.stringify([]),
      ],
    );

    // Seed load legs (stops)
    for (const leg of load.legs) {
      const legId = `DEMO-LEG-${load.id}-${leg.sequence_order}`;
      await exec(
        conn,
        `INSERT IGNORE INTO load_legs
           (id, load_id, type, facility_name, city, state,
            date, appointment_time, completed, sequence_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          legId,
          load.id,
          leg.type,
          leg.facility_name,
          leg.city,
          leg.state,
          leg.date,
          leg.appointment_time,
          leg.completed ? 1 : 0,
          leg.sequence_order,
        ],
      );
    }
  }
}

async function seedIncidents(
  conn: mysql.Connection,
  companyId: string,
  incidents: IncidentRecord[],
): Promise<void> {
  for (const incident of incidents) {
    log(`Seeding incident: ${incident.id} (${incident.type})`);
    await exec(
      conn,
      `INSERT IGNORE INTO incidents
         (id, company_id, load_id, type, severity, status,
          sla_deadline, description, location_lat, location_lng,
          recovery_plan)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        incident.id,
        companyId,
        incident.load_ref,
        incident.type,
        incident.severity,
        incident.status,
        incident.sla_deadline,
        incident.description,
        incident.location_lat,
        incident.location_lng,
        incident.recovery_plan,
      ],
    );
  }
}

async function seedGlAccounts(
  conn: mysql.Connection,
  companyId: string,
  accounts: GlAccountRecord[],
): Promise<void> {
  for (const account of accounts) {
    log(`Seeding GL account: ${account.account_number} — ${account.name}`);
    await exec(
      conn,
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
        account.is_active ? 1 : 0,
      ],
    );
  }
}

async function seedArInvoices(
  conn: mysql.Connection,
  companyId: string,
  invoices: InvoiceRecord[],
  glAccounts: GlAccountRecord[],
): Promise<void> {
  const arAccountId =
    glAccounts.find((a) => a.account_number === "1200")?.id ?? "DEMO-GL-1200";
  const revenueAccountId =
    glAccounts.find((a) => a.account_number === "4000")?.id ?? "DEMO-GL-4000";

  for (const invoice of invoices) {
    log(`Seeding AR invoice: ${invoice.invoice_number} ($${invoice.total_amount})`);

    // Insert invoice header (INSERT IGNORE for idempotency)
    await exec(
      conn,
      `INSERT IGNORE INTO ar_invoices
         (id, company_id, customer_id, load_id, invoice_number,
          invoice_date, due_date, status, total_amount, balance_due, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        invoice.id,
        companyId,
        invoice.customer_ref,
        invoice.load_ref,
        invoice.invoice_number,
        invoice.invoice_date,
        invoice.due_date,
        invoice.status,
        invoice.total_amount,
        invoice.status === "Paid" ? 0 : invoice.total_amount,
        invoice.description,
      ],
    );

    // Insert a single AR invoice line
    const lineId = `DEMO-INVLINE-${invoice.id}`;
    await exec(
      conn,
      `INSERT IGNORE INTO ar_invoice_lines
         (id, invoice_id, description, quantity, unit_price, total_amount, gl_account_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        lineId,
        invoice.id,
        invoice.description,
        1,
        invoice.total_amount,
        invoice.total_amount,
        revenueAccountId,
      ],
    );

    // Auto-post GL journal entry (double-entry bookkeeping)
    const jeId = `DEMO-JE-${invoice.id}`;
    await exec(
      conn,
      `INSERT IGNORE INTO journal_entries
         (id, company_id, entry_date, reference_number, description,
          source_document_type, source_document_id, posted_at, created_by)
       VALUES (?, ?, ?, ?, ?, 'Invoice', ?, NOW(), 'DEMO-SEED')`,
      [
        jeId,
        companyId,
        invoice.invoice_date,
        invoice.invoice_number,
        `[DEMO] Invoice ${invoice.invoice_number}`,
        invoice.id,
      ],
    );

    // Debit AR
    await exec(
      conn,
      `INSERT IGNORE INTO journal_lines
         (id, journal_entry_id, gl_account_id, debit, credit,
          allocation_type, allocation_id, notes)
       VALUES (?, ?, ?, ?, ?, 'Load', ?, ?)`,
      [
        `DEMO-JL-${invoice.id}-AR`,
        jeId,
        arAccountId,
        invoice.total_amount,
        0,
        invoice.load_ref,
        `AR: ${invoice.invoice_number}`,
      ],
    );

    // Credit Revenue
    await exec(
      conn,
      `INSERT IGNORE INTO journal_lines
         (id, journal_entry_id, gl_account_id, debit, credit,
          allocation_type, allocation_id, notes)
       VALUES (?, ?, ?, ?, ?, 'Load', ?, ?)`,
      [
        `DEMO-JL-${invoice.id}-REV`,
        jeId,
        revenueAccountId,
        0,
        invoice.total_amount,
        invoice.load_ref,
        `Revenue: ${invoice.invoice_number}`,
      ],
    );
  }
}

async function seedApBills(
  conn: mysql.Connection,
  companyId: string,
  bills: BillRecord[],
  glAccounts: GlAccountRecord[],
): Promise<void> {
  const apAccountId =
    glAccounts.find((a) => a.account_number === "2000")?.id ?? "DEMO-GL-2000";
  const carrierCostAccountId =
    glAccounts.find((a) => a.account_number === "6100")?.id ?? "DEMO-GL-6100";

  for (const bill of bills) {
    log(`Seeding AP bill: ${bill.bill_number} ($${bill.total_amount})`);

    // Insert bill header
    await exec(
      conn,
      `INSERT IGNORE INTO ap_bills
         (id, company_id, vendor_id, bill_number, bill_date, due_date,
          status, total_amount, balance_due, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        bill.id,
        companyId,
        bill.vendor_ref,
        bill.bill_number,
        bill.bill_date,
        bill.due_date,
        bill.status,
        bill.total_amount,
        bill.status === "Paid" ? 0 : bill.total_amount,
        bill.description,
      ],
    );

    // Insert AP bill line
    const lineId = `DEMO-BILLLINE-${bill.id}`;
    await exec(
      conn,
      `INSERT IGNORE INTO ap_bill_lines
         (id, bill_id, description, amount, gl_account_id,
          allocation_type, allocation_id)
       VALUES (?, ?, ?, ?, ?, 'Overhead', NULL)`,
      [
        lineId,
        bill.id,
        bill.description,
        bill.total_amount,
        carrierCostAccountId,
      ],
    );

    // Auto-post GL journal entry
    const jeId = `DEMO-JE-${bill.id}`;
    await exec(
      conn,
      `INSERT IGNORE INTO journal_entries
         (id, company_id, entry_date, reference_number, description,
          source_document_type, source_document_id, posted_at, created_by)
       VALUES (?, ?, ?, ?, ?, 'Bill', ?, NOW(), 'DEMO-SEED')`,
      [
        jeId,
        companyId,
        bill.bill_date,
        bill.bill_number,
        `[DEMO] Bill ${bill.bill_number}`,
        bill.id,
      ],
    );

    // Credit AP (liability)
    await exec(
      conn,
      `INSERT IGNORE INTO journal_lines
         (id, journal_entry_id, gl_account_id, debit, credit, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        `DEMO-JL-${bill.id}-AP`,
        jeId,
        apAccountId,
        0,
        bill.total_amount,
        `AP: ${bill.bill_number}`,
      ],
    );

    // Debit Carrier Cost (expense)
    await exec(
      conn,
      `INSERT IGNORE INTO journal_lines
         (id, journal_entry_id, gl_account_id, debit, credit, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        `DEMO-JL-${bill.id}-EXP`,
        jeId,
        carrierCostAccountId,
        bill.total_amount,
        0,
        `Cost: ${bill.bill_number}`,
      ],
    );
  }
}

// ─── Verification ─────────────────────────────────────────────────────────────

async function verifySeed(
  conn: mysql.Connection,
  companyId: string,
): Promise<void> {
  if (isDryRun) {
    log("[DRY-RUN] Skipping verification.");
    return;
  }

  const checks: Array<{ label: string; sql: string; expected: number }> = [
    {
      label: "companies",
      sql: "SELECT COUNT(*) AS n FROM companies WHERE id = ?",
      expected: 1,
    },
    {
      label: "users",
      sql: "SELECT COUNT(*) AS n FROM users WHERE company_id = ?",
      expected: 4,
    },
    {
      label: "customers",
      sql: "SELECT COUNT(*) AS n FROM customers WHERE company_id = ?",
      expected: 4,
    },
    {
      label: "parties",
      sql: "SELECT COUNT(*) AS n FROM parties WHERE company_id = ?",
      expected: 2,
    },
    {
      label: "loads",
      sql: "SELECT COUNT(*) AS n FROM loads WHERE company_id = ?",
      expected: 11,
    },
    {
      label: "load_legs",
      sql: "SELECT COUNT(*) AS n FROM load_legs WHERE load_id LIKE 'DEMO-LOAD-%'",
      expected: 22,
    },
    {
      label: "incidents",
      sql: "SELECT COUNT(*) AS n FROM incidents WHERE company_id = ?",
      expected: 5,
    },
    {
      label: "gl_accounts",
      sql: "SELECT COUNT(*) AS n FROM gl_accounts WHERE company_id = ?",
      expected: 5,
    },
    {
      label: "ar_invoices",
      sql: "SELECT COUNT(*) AS n FROM ar_invoices WHERE company_id = ?",
      expected: 5,
    },
    {
      label: "ap_bills",
      sql: "SELECT COUNT(*) AS n FROM ap_bills WHERE company_id = ?",
      expected: 5,
    },
    {
      label: "journal_entries",
      sql: "SELECT COUNT(*) AS n FROM journal_entries WHERE company_id = ? AND created_by = 'DEMO-SEED'",
      expected: 10,
    },
  ];

  log("--- Verification ---");
  let allPassed = true;
  for (const check of checks) {
    const param = check.sql.includes("LIKE") ? [] : [companyId];
    const [rows] = await conn.execute<RowDataPacket[]>(check.sql, param);
    const actual: number = rows[0].n;
    const passed = actual >= check.expected;
    const status = passed ? "PASS" : "FAIL";
    if (!passed) allPassed = false;
    log(`  ${status}  ${check.label}: found ${actual} (expected >= ${check.expected})`);
  }

  if (!allPassed) {
    throw new Error("Verification failed: one or more record counts are below expected minimums.");
  }
  log("All verification checks passed.");
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  log("=== LoadPilot Demo Seed Script ===");
  if (isDryRun) {
    log("Mode: DRY RUN — no data will be written.");
  }

  // Load seed data from JSON file (sibling of this script)
  const dataPath = path.resolve(__dirname, "seed-demo-data.json");
  if (!fs.existsSync(dataPath)) {
    console.error(`ERROR: Seed data file not found: ${dataPath}`);
    process.exit(1);
  }
  const seedData: SeedData = JSON.parse(fs.readFileSync(dataPath, "utf-8"));

  const companyId =
    process.env.DEMO_COMPANY_ID || seedData.company.id;

  log(`Demo tenant ID: ${companyId}`);
  log(`Seed data version: ${seedData._meta.version}`);

  // Validate required env vars
  const requiredEnv = ["DB_HOST", "DB_USER", "DB_PASSWORD", "DB_NAME"] as const;
  for (const envVar of requiredEnv) {
    if (!process.env[envVar]) {
      console.error(`ERROR: Missing required environment variable: ${envVar}`);
      console.error("Ensure your .env file is present and contains all DB_ variables.");
      process.exit(1);
    }
  }

  const socketPath = process.env.DB_SOCKET_PATH;
  const connConfig: mysql.ConnectionOptions = {
    ...(socketPath
      ? { socketPath }
      : {
          host: process.env.DB_HOST!,
          port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
        }),
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
    database: process.env.DB_NAME!,
  };

  const conn = await mysql.createConnection(connConfig);

  try {
    log("Connected to database.");

    // Run seed operations in dependency order (parent before child)
    await seedCompany(conn, { ...seedData.company, id: companyId });
    await seedUsers(conn, companyId, seedData.users);
    await seedCustomers(conn, companyId, seedData.customers);
    await seedParties(conn, companyId, seedData.parties);
    await seedGlAccounts(conn, companyId, seedData.gl_accounts);
    await seedLoads(conn, companyId, seedData.loads);
    await seedIncidents(conn, companyId, seedData.incidents);
    await seedArInvoices(conn, companyId, seedData.ar_invoices, seedData.gl_accounts);
    await seedApBills(conn, companyId, seedData.ap_bills, seedData.gl_accounts);

    await verifySeed(conn, companyId);

    log(`=== Seed complete. ${queryCount} SQL statements executed. ===`);
    log(`Demo tenant ID: ${companyId}`);
    log("Log in using any Firebase user linked to this company_id.");
    log("Suggested pages to visit:");
    log("  /loads            — Load Board (11 loads across all statuses)");
    log("  /schedule         — Calendar (loads with pickup_date)");
    log("  /operations       — Operations Center / Intelligence Hub");
    log("  /exceptions       — Issues & Alerts (auto-linked from incidents)");
    log("  /accounting       — Accounting Portal (AR/AP/GL)");
    log("  /network          — Broker Network (customers + parties)");
  } catch (err) {
    console.error("ERROR: Seed script failed:", err);
    await conn.end();
    process.exit(1);
  }

  await conn.end();
  process.exit(0);
}

main();
