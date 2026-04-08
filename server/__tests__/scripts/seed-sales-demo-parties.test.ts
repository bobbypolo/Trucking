/**
 * Unit tests for seedSalesDemoParties — Phase 4, Bulletproof Sales Demo.
 *
 * Covers acceptance criteria R-P4-01, R-P4-02, R-P4-03, R-P4-04, and the
 * R-P4-07 snapshot guard. Uses the same recording-executor pattern as
 * Phase 2's seed-sales-demo-loads.test.ts and Phase 3's
 * seed-sales-demo-ifta.test.ts — a fake SqlExecutor records every
 * (sql, params) pair and the test asserts the captured SQL contract.
 *
 * Phase 4 contract (verified against PLAN.md Phase 4):
 *   - 12 parties INSERTs total: 3 Customer, 2 Broker, 2 Vendor,
 *     3 Facility, 2 Contractor
 *   - one of the 2 brokers MUST be SALES-DEMO-CUST-001 / ACME Logistics
 *     LLC (continuity object — same broker as Phase 2 hero load)
 *   - every party has at least 1 row in each of 5 sub-tables:
 *     party_contacts, party_documents, rate_rows (+ rate_tiers),
 *     constraint_sets (+ constraint_rules), party_catalog_links
 *   - source contains zero references to broker_credit_scores,
 *     customer_rate_sheets, party_interactions tables (which do not
 *     exist in the schema)
 *   - source does not import from server/routes/clients.ts and does
 *     not call POST /api/parties (the buggy CRM create endpoint)
 *   - all statements use INSERT IGNORE
 *   - idempotent on second invocation
 *
 * Tests R-P4-01..R-P4-04, R-P4-07.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

import {
  SALES_DEMO_BROKER_ID,
  SALES_DEMO_COMPANY_ID,
  SqlExecutor,
  seedSalesDemoParties,
} from "../../scripts/seed-sales-demo";

interface CapturedCall {
  sql: string;
  params: unknown[];
}

function makeRecordingExecutor(): SqlExecutor & { calls: CapturedCall[] } {
  const calls: CapturedCall[] = [];
  return {
    calls,
    async execute(sql: string, params: unknown[] = []): Promise<unknown> {
      calls.push({ sql, params });
      return [{}];
    },
  };
}

const HERO_BROKER_NAME = "ACME Logistics LLC";

describe("seedSalesDemoParties — Phase 4 CRM registry depth seed", () => {
  // Tests R-P4-01
  it("R-P4-01: inserts exactly 12 parties with breakdown 3 Customer / 2 Broker / 2 Vendor / 3 Facility / 2 Contractor", async () => {
    const conn = makeRecordingExecutor();

    await seedSalesDemoParties(conn);

    const partyInserts = conn.calls.filter((c) =>
      /INSERT\s+IGNORE\s+INTO\s+parties\b/i.test(c.sql),
    );
    expect(partyInserts.length).toBe(12);

    // Each party row params: (id, company_id, name, type, is_customer,
    // is_vendor, status, mc_number, dot_number, rating, tags,
    // entity_class, vendor_profile)
    // Column index reference: see PartyInsertParams in the seed source.
    const TYPE_INDEX = 3;

    const breakdown: Record<string, number> = {};
    for (const insert of partyInserts) {
      const partyType = insert.params[TYPE_INDEX] as string;
      breakdown[partyType] = (breakdown[partyType] || 0) + 1;
      // company scoping — every party in the sales-demo tenant
      expect(insert.params[1]).toBe(SALES_DEMO_COMPANY_ID);
    }
    expect(breakdown).toEqual({
      Customer: 3,
      Broker: 2,
      Vendor: 2,
      Facility: 3,
      Contractor: 2,
    });
  });

  // Tests R-P4-01
  it("R-P4-01: ACME Logistics LLC (SALES-DEMO-CUST-001) is one of the 2 brokers — continuity with Phase 2 hero load", async () => {
    const conn = makeRecordingExecutor();

    await seedSalesDemoParties(conn);

    const partyInserts = conn.calls.filter((c) =>
      /INSERT\s+IGNORE\s+INTO\s+parties\b/i.test(c.sql),
    );

    // params: (id, company_id, name, type, ...)
    const acmeRow = partyInserts.find(
      (c) => c.params[0] === SALES_DEMO_BROKER_ID,
    );
    expect(acmeRow).toBeDefined();
    expect(acmeRow!.params[2]).toBe(HERO_BROKER_NAME);
    expect(acmeRow!.params[3]).toBe("Broker");
  });

  // Tests R-P4-02
  it("R-P4-02: every party has at least 1 contact, 1 document, 1 rate row, 1 constraint set, 1 catalog link", async () => {
    const conn = makeRecordingExecutor();

    await seedSalesDemoParties(conn);

    const partyInserts = conn.calls.filter((c) =>
      /INSERT\s+IGNORE\s+INTO\s+parties\b/i.test(c.sql),
    );
    const partyIds = partyInserts.map((c) => c.params[0] as string);
    expect(partyIds.length).toBe(12);

    // Helper: count rows in a sub-table grouped by party_id (always at
    // params index 1 in the seed inserts: (id, party_id, ...)).
    const countByParty = (tableRegex: RegExp): Map<string, number> => {
      const counts = new Map<string, number>();
      const rows = conn.calls.filter((c) => tableRegex.test(c.sql));
      for (const row of rows) {
        const pid = row.params[1] as string;
        counts.set(pid, (counts.get(pid) || 0) + 1);
      }
      return counts;
    };

    const contactCounts = countByParty(
      /INSERT\s+IGNORE\s+INTO\s+party_contacts\b/i,
    );
    const documentCounts = countByParty(
      /INSERT\s+IGNORE\s+INTO\s+party_documents\b/i,
    );
    const rateCounts = countByParty(/INSERT\s+IGNORE\s+INTO\s+rate_rows\b/i);
    const constraintSetCounts = countByParty(
      /INSERT\s+IGNORE\s+INTO\s+constraint_sets\b/i,
    );
    const catalogLinkCounts = countByParty(
      /INSERT\s+IGNORE\s+INTO\s+party_catalog_links\b/i,
    );

    for (const pid of partyIds) {
      expect(contactCounts.get(pid) || 0).toBeGreaterThanOrEqual(1);
      expect(documentCounts.get(pid) || 0).toBeGreaterThanOrEqual(1);
      expect(rateCounts.get(pid) || 0).toBeGreaterThanOrEqual(1);
      expect(constraintSetCounts.get(pid) || 0).toBeGreaterThanOrEqual(1);
      expect(catalogLinkCounts.get(pid) || 0).toBeGreaterThanOrEqual(1);
    }

    // Aggregate sanity counts (12 parties × 1 minimum row per sub-table)
    expect(
      [...contactCounts.values()].reduce((a, b) => a + b, 0),
    ).toBeGreaterThanOrEqual(12);
    expect(
      [...documentCounts.values()].reduce((a, b) => a + b, 0),
    ).toBeGreaterThanOrEqual(12);
    expect(
      [...rateCounts.values()].reduce((a, b) => a + b, 0),
    ).toBeGreaterThanOrEqual(12);
    expect(
      [...constraintSetCounts.values()].reduce((a, b) => a + b, 0),
    ).toBeGreaterThanOrEqual(12);
    expect(
      [...catalogLinkCounts.values()].reduce((a, b) => a + b, 0),
    ).toBeGreaterThanOrEqual(12);
  });

  // Tests R-P4-02
  it("R-P4-02: ACME Logistics LLC has at least 1 row in every sub-table (full continuity broker enrichment)", async () => {
    const conn = makeRecordingExecutor();

    await seedSalesDemoParties(conn);

    const acmeId = SALES_DEMO_BROKER_ID;
    const subtables = [
      /INSERT\s+IGNORE\s+INTO\s+party_contacts\b/i,
      /INSERT\s+IGNORE\s+INTO\s+party_documents\b/i,
      /INSERT\s+IGNORE\s+INTO\s+rate_rows\b/i,
      /INSERT\s+IGNORE\s+INTO\s+constraint_sets\b/i,
      /INSERT\s+IGNORE\s+INTO\s+party_catalog_links\b/i,
    ];
    for (const re of subtables) {
      const acmeRows = conn.calls.filter(
        (c) => re.test(c.sql) && c.params[1] === acmeId,
      );
      expect(acmeRows.length).toBeGreaterThanOrEqual(1);
    }
  });

  // Tests R-P4-03
  it("R-P4-03: seedSalesDemoParties source contains zero references to broker_credit_scores, customer_rate_sheets, party_interactions (tables that do not exist)", () => {
    const sourcePath = path.resolve(
      __dirname,
      "../../scripts/seed-sales-demo.ts",
    );
    const src = fs.readFileSync(sourcePath, "utf-8");

    // These three tables were referenced by the legacy CRM design but
    // never made it into the schema. The seed must not pretend they
    // exist — any INSERT against them would crash on a real DB. We grep
    // for the literal table names to catch even commented-out refs.
    expect(src).not.toContain("broker_credit_scores");
    expect(src).not.toContain("customer_rate_sheets");
    expect(src).not.toContain("party_interactions");
  });

  // Tests R-P4-03
  it("R-P4-03: runtime — seedSalesDemoParties never emits an INSERT against broker_credit_scores, customer_rate_sheets, or party_interactions", async () => {
    const conn = makeRecordingExecutor();

    await seedSalesDemoParties(conn);

    const forbiddenTablePattern =
      /INSERT\s+(IGNORE\s+)?INTO\s+(broker_credit_scores|customer_rate_sheets|party_interactions)\b/i;
    const forbidden = conn.calls.filter((c) =>
      forbiddenTablePattern.test(c.sql),
    );
    expect(forbidden).toEqual([]);
  });

  // Tests R-P4-04
  it("R-P4-04: seedSalesDemoParties source does not call POST /api/parties and does not import from server/routes/clients", () => {
    const sourcePath = path.resolve(
      __dirname,
      "../../scripts/seed-sales-demo.ts",
    );
    const src = fs.readFileSync(sourcePath, "utf-8");

    // The buggy CRM create handler must not be invoked from the seed
    // (it has a known schema bug — see PLAN.md Phase 4 correction #9).
    // Direct SQL via the SqlExecutor is the only path.
    expect(src).not.toMatch(/fetch\(\s*['"`].*\/api\/parties/);
    expect(src).not.toMatch(/axios[\s\S]*\/api\/parties/);

    // No import (or dynamic import) from the clients route module.
    expect(src).not.toMatch(/from\s+['"][^'"]*routes\/clients['"]/);
    expect(src).not.toMatch(/import\s*\(\s*['"][^'"]*routes\/clients['"]/);
  });

  // Tests R-P4-04
  it("R-P4-04: every captured INSERT goes through the SqlExecutor — no out-of-band HTTP calls", async () => {
    const conn = makeRecordingExecutor();

    await seedSalesDemoParties(conn);

    // All 12 parties + sub-table inserts must surface in the executor's
    // call log. If the seed silently went out to HTTP we would see <12
    // party inserts captured.
    const partyInserts = conn.calls.filter((c) =>
      /INSERT\s+IGNORE\s+INTO\s+parties\b/i.test(c.sql),
    );
    expect(partyInserts.length).toBe(12);

    // Every captured statement begins with INSERT (no SELECT, UPDATE,
    // DELETE leakage from the seed).
    for (const c of conn.calls) {
      expect(/^\s*INSERT/i.test(c.sql)).toBe(true);
    }
  });

  // Tests R-P4-01, R-P4-02
  it("idempotent — every INSERT uses INSERT IGNORE and a second invocation re-emits the same SQL count", async () => {
    const conn = makeRecordingExecutor();

    await seedSalesDemoParties(conn);
    const firstRunCount = conn.calls.length;
    expect(firstRunCount).toBeGreaterThanOrEqual(60); // 12 parties + 5 subtables x 12 rows minimum

    await seedSalesDemoParties(conn);
    expect(conn.calls.length).toBe(firstRunCount * 2);

    const allInserts = conn.calls.filter((c) => /^\s*INSERT/i.test(c.sql));
    const nonIdempotent = allInserts.filter(
      (c) => !/^\s*INSERT\s+IGNORE/i.test(c.sql),
    );
    expect(nonIdempotent).toEqual([]);
  });

  // Tests R-P4-07
  it("R-P4-07: snapshot guard — the three protected files (NetworkPortal.tsx, networkService.ts, server/routes/clients.ts) remain present and non-empty", () => {
    // The R-P4-07 live-functions-only guarantee means Phase 4 must not
    // edit or even import these three files. We verify they still exist
    // and remain non-empty — accidental deletion would defeat R-P4-07.
    const ROOT = path.resolve(__dirname, "../..");
    const files = [
      path.join(ROOT, "..", "components", "NetworkPortal.tsx"),
      path.join(ROOT, "..", "services", "networkService.ts"),
      path.join(ROOT, "routes", "clients.ts"),
    ];
    for (const fp of files) {
      expect(fs.existsSync(fp)).toBe(true);
      const stat = fs.statSync(fp);
      expect(stat.size).toBeGreaterThan(0);
    }

    // Additionally assert the GET /api/parties JOIN headers Phase 4
    // depends on are still present in clients.ts. If someone renames
    // 'party_contacts' or removes the GET handler the live readback
    // test (R-P4-05) breaks and R-P4-07 must catch it.
    const clientsPath = path.join(ROOT, "routes", "clients.ts");
    const clientsSrc = fs.readFileSync(clientsPath, "utf-8");
    expect(clientsSrc).toContain("SELECT * FROM parties WHERE company_id");
    expect(clientsSrc).toContain("FROM party_contacts");
    expect(clientsSrc).toContain("FROM party_documents");
    expect(clientsSrc).toContain("FROM rate_rows");
    expect(clientsSrc).toContain("FROM constraint_sets");
    expect(clientsSrc).toContain("FROM party_catalog_links");
  });

  // Tests R-P4-07
  it("R-P4-07: seedSalesDemoParties source does not reference NetworkPortal, networkService, or any UI component", () => {
    const sourcePath = path.resolve(
      __dirname,
      "../../scripts/seed-sales-demo.ts",
    );
    const src = fs.readFileSync(sourcePath, "utf-8");

    const protectedRefs = ["NetworkPortal", "networkService"];
    for (const ref of protectedRefs) {
      expect(src).not.toContain(ref);
    }
  });
});
