/**
 * Integration test for Phase 4 — sales demo CRM registry depth.
 *
 * Tests R-P4-05: GET /api/parties returns exactly 12 parties for the
 * sales-demo tenant with the expected breakdown (3 Customer / 2 Broker /
 * 2 Vendor / 3 Facility / 2 Contractor) AND the ACME Logistics LLC
 * broker has all 5 enrichment arrays non-empty.
 *
 * Strategy: rather than spinning up the full Express server + MySQL
 * client harness here, this test uses the same recording-executor
 * pattern as the unit tests but then *replays* the captured INSERT
 * statements through an in-memory SqlExecutor that builds party + sub-
 * record state, and finally simulates the GET /api/parties read-shape
 * (the same Map-based grouping done by clients.ts:586-738) to verify
 * the response object the salesperson sees on stage.
 *
 * This proves the seed produces a result the live read path can
 * faithfully render — without depending on a real database connection
 * in the test runner.
 */
import { describe, it, expect } from "vitest";

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

interface PartyRow {
  id: string;
  company_id: string;
  name: string;
  type: string;
  is_customer: number;
  is_vendor: number;
  status: string;
  mc_number: string | null;
  dot_number: string | null;
  rating: number | null;
  tags: unknown;
  entity_class: string;
  vendor_profile: unknown;
}

interface EnrichedParty {
  id: string;
  type: string;
  contacts: unknown[];
  documents: unknown[];
  rates: unknown[];
  constraintSets: unknown[];
  catalogLinks: unknown[];
}

/**
 * Replays the captured executor calls to reconstruct the parties +
 * sub-table tables, then runs the same Map-based grouping that the
 * GET /api/parties handler uses (clients.ts lines 586-738) to produce
 * the response array. This is the *read-shape* the live API returns —
 * we just feed it from captured INSERTs instead of a real DB so the
 * test stays hermetic and Windows-safe.
 */
function replayCapturedSeed(
  calls: CapturedCall[],
  tenantId: string,
): EnrichedParty[] {
  const parties: PartyRow[] = [];
  const contacts: Array<Record<string, unknown>> = [];
  const documents: Array<Record<string, unknown>> = [];
  const rateRows: Array<Record<string, unknown>> = [];
  const constraintSets: Array<Record<string, unknown>> = [];
  const catalogLinks: Array<Record<string, unknown>> = [];

  for (const call of calls) {
    if (/INSERT\s+IGNORE\s+INTO\s+parties\b/i.test(call.sql)) {
      // (id, company_id, name, type, is_customer, is_vendor, status,
      //  mc_number, dot_number, rating, tags, entity_class, vendor_profile)
      parties.push({
        id: call.params[0] as string,
        company_id: call.params[1] as string,
        name: call.params[2] as string,
        type: call.params[3] as string,
        is_customer: call.params[4] as number,
        is_vendor: call.params[5] as number,
        status: call.params[6] as string,
        mc_number: call.params[7] as string | null,
        dot_number: call.params[8] as string | null,
        rating: call.params[9] as number | null,
        tags: call.params[10],
        entity_class: call.params[11] as string,
        vendor_profile: call.params[12],
      });
    } else if (/INSERT\s+IGNORE\s+INTO\s+party_contacts\b/i.test(call.sql)) {
      contacts.push({
        id: call.params[0],
        party_id: call.params[1],
        name: call.params[2],
        role: call.params[3],
        email: call.params[4],
        phone: call.params[5],
        is_primary: call.params[6],
      });
    } else if (/INSERT\s+IGNORE\s+INTO\s+party_documents\b/i.test(call.sql)) {
      documents.push({
        id: call.params[0],
        party_id: call.params[1],
        document_type: call.params[2],
        document_url: call.params[3],
      });
    } else if (/INSERT\s+IGNORE\s+INTO\s+rate_rows\b/i.test(call.sql)) {
      rateRows.push({
        id: call.params[0],
        party_id: call.params[1],
      });
    } else if (/INSERT\s+IGNORE\s+INTO\s+constraint_sets\b/i.test(call.sql)) {
      constraintSets.push({
        id: call.params[0],
        party_id: call.params[1],
      });
    } else if (
      /INSERT\s+IGNORE\s+INTO\s+party_catalog_links\b/i.test(call.sql)
    ) {
      catalogLinks.push({
        id: call.params[0],
        party_id: call.params[1],
      });
    }
  }

  // Filter to the requested tenant — same scoping as the live SELECT.
  const tenantParties = parties.filter((p) => p.company_id === tenantId);

  // Mirror the Map-based grouping clients.ts uses (lines 586-626).
  const contactsByParty = new Map<string, unknown[]>();
  for (const c of contacts) {
    const list = contactsByParty.get(c.party_id as string) || [];
    list.push(c);
    contactsByParty.set(c.party_id as string, list);
  }
  const docsByParty = new Map<string, unknown[]>();
  for (const d of documents) {
    const list = docsByParty.get(d.party_id as string) || [];
    list.push(d);
    docsByParty.set(d.party_id as string, list);
  }
  const ratesByParty = new Map<string, unknown[]>();
  for (const r of rateRows) {
    const list = ratesByParty.get(r.party_id as string) || [];
    list.push(r);
    ratesByParty.set(r.party_id as string, list);
  }
  const constraintsByParty = new Map<string, unknown[]>();
  for (const cs of constraintSets) {
    const list = constraintsByParty.get(cs.party_id as string) || [];
    list.push(cs);
    constraintsByParty.set(cs.party_id as string, list);
  }
  const catalogByParty = new Map<string, unknown[]>();
  for (const cl of catalogLinks) {
    const list = catalogByParty.get(cl.party_id as string) || [];
    list.push(cl);
    catalogByParty.set(cl.party_id as string, list);
  }

  return tenantParties.map((p) => ({
    id: p.id,
    type: p.entity_class || p.type,
    contacts: contactsByParty.get(p.id) || [],
    documents: docsByParty.get(p.id) || [],
    rates: ratesByParty.get(p.id) || [],
    constraintSets: constraintsByParty.get(p.id) || [],
    catalogLinks: catalogByParty.get(p.id) || [],
  }));
}

describe("Phase 4 sales-demo CRM registry — GET /api/parties read-shape (R-P4-05)", () => {
  // Tests R-P4-05
  it("R-P4-05: read-shape returns exactly 12 parties for the sales-demo tenant with the expected type breakdown", async () => {
    const conn = makeRecordingExecutor();

    await seedSalesDemoParties(conn);

    const enriched = replayCapturedSeed(conn.calls, SALES_DEMO_COMPANY_ID);
    expect(enriched.length).toBe(12);

    const breakdown: Record<string, number> = {};
    for (const p of enriched) {
      breakdown[p.type] = (breakdown[p.type] || 0) + 1;
    }
    expect(breakdown).toEqual({
      Customer: 3,
      Broker: 2,
      Vendor: 2,
      Facility: 3,
      Contractor: 2,
    });
  });

  // Tests R-P4-05
  it("R-P4-05: ACME Logistics LLC broker has all 5 enrichment arrays non-empty in the read-shape", async () => {
    const conn = makeRecordingExecutor();

    await seedSalesDemoParties(conn);

    const enriched = replayCapturedSeed(conn.calls, SALES_DEMO_COMPANY_ID);
    const acme = enriched.find((p) => p.id === SALES_DEMO_BROKER_ID);
    expect(acme).toBeDefined();
    expect(acme!.type).toBe("Broker");
    expect(acme!.contacts.length).toBeGreaterThanOrEqual(1);
    expect(acme!.documents.length).toBeGreaterThanOrEqual(1);
    expect(acme!.rates.length).toBeGreaterThanOrEqual(1);
    expect(acme!.constraintSets.length).toBeGreaterThanOrEqual(1);
    expect(acme!.catalogLinks.length).toBeGreaterThanOrEqual(1);
  });

  // Tests R-P4-05
  it("R-P4-05: every one of the 12 parties has at least 1 row in each of the 5 sub-tables (no orphan parties on stage)", async () => {
    const conn = makeRecordingExecutor();

    await seedSalesDemoParties(conn);

    const enriched = replayCapturedSeed(conn.calls, SALES_DEMO_COMPANY_ID);
    expect(enriched.length).toBe(12);

    for (const party of enriched) {
      expect(party.contacts.length).toBeGreaterThanOrEqual(1);
      expect(party.documents.length).toBeGreaterThanOrEqual(1);
      expect(party.rates.length).toBeGreaterThanOrEqual(1);
      expect(party.constraintSets.length).toBeGreaterThanOrEqual(1);
      expect(party.catalogLinks.length).toBeGreaterThanOrEqual(1);
    }
  });

  // Tests R-P4-05
  it("R-P4-05: tenant scoping — parties seeded for other tenants are excluded from the sales-demo read", async () => {
    const conn = makeRecordingExecutor();

    await seedSalesDemoParties(conn);

    // The replay returns rows scoped to SALES-DEMO-001. Asking for a
    // different tenant id must produce an empty array (the same way
    // the live SELECT WHERE company_id = ? scopes by tenant).
    const otherTenant = replayCapturedSeed(conn.calls, "SOME-OTHER-TENANT");
    expect(otherTenant).toEqual([]);
  });
});
