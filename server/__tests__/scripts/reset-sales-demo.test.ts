/**
 * Unit tests for server/scripts/reset-sales-demo.ts (Phase 1 — Bulletproof Sales Demo).
 *
 * Tests R-P1-03, R-P1-09, R-P1-10.
 */
import { describe, it, expect } from "vitest";

import { SqlExecutor } from "../../scripts/seed-sales-demo";
import {
  SALES_DEMO_DELETE_SEQUENCE,
  assertNotProduction,
  resetSalesDemo,
} from "../../scripts/reset-sales-demo";

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

function makeEnv(
  overrides: Partial<NodeJS.ProcessEnv> = {},
): NodeJS.ProcessEnv {
  return {
    DB_HOST: "127.0.0.1",
    DB_PORT: "3306",
    DB_USER: "test",
    DB_PASSWORD: "test",
    DB_NAME: "salesdemo_dev",
    SALES_DEMO_ADMIN_FIREBASE_UID: "fb-admin-uid-abc",
    SALES_DEMO_DRIVER_FIREBASE_UID: "fb-driver-uid-xyz",
    ...overrides,
  } as NodeJS.ProcessEnv;
}

const EXPECTED_DELETE_TABLES = [
  "ifta_trips_audit",
  "ifta_trip_evidence",
  "mileage_jurisdiction",
  "fuel_ledger",
  "journal_lines",
  "journal_entries",
  "ar_invoices",
  "ap_bills",
  "gl_accounts",
  "documents",
  "exceptions",
];

describe("reset-sales-demo — Phase 1 reset pipeline", () => {
  // Tests R-P1-03 — resetSalesDemo throws when DB_NAME='production-loadpilot'.
  it("R-P1-03: throws when DB_NAME='production-loadpilot'", async () => {
    const conn = makeRecordingExecutor();
    const env = makeEnv({ DB_NAME: "production-loadpilot" });

    await expect(resetSalesDemo(conn, env)).rejects.toThrow(
      /Refusing to run.*production-loadpilot/,
    );

    // Ensure not a single SQL statement was executed before the refusal.
    expect(conn.calls).toEqual([]);
  });

  it("R-P1-03: assertNotProduction rejects other production-like names", () => {
    expect(() =>
      assertNotProduction(makeEnv({ DB_NAME: "prod_db" })),
    ).toThrow();
    expect(() =>
      assertNotProduction(makeEnv({ DB_NAME: "PROD-loadpilot" })),
    ).toThrow();
    expect(() =>
      assertNotProduction(makeEnv({ DB_NAME: "loadpilot-production" })),
    ).toThrow();
    // Non-production name is allowed.
    expect(() =>
      assertNotProduction(makeEnv({ DB_NAME: "salesdemo_dev" })),
    ).not.toThrow();
  });

  // Tests R-P1-09 — resetSalesDemo issues DELETE statements against ALL 10 non-cascading
  // tables in verified order BEFORE the DELETE FROM companies.
  it("R-P1-09: issues DELETE against all 10 tables in verified order, then DELETE companies last", async () => {
    const conn = makeRecordingExecutor();

    await resetSalesDemo(conn, makeEnv());

    const deleteCalls = conn.calls.filter((c) =>
      /^\s*DELETE\s+FROM/i.test(c.sql),
    );
    // 11 non-cascading tables + final companies row = 12 total DELETE steps.
    expect(deleteCalls.length).toBeGreaterThanOrEqual(12);
    expect(deleteCalls.length).toBe(SALES_DEMO_DELETE_SEQUENCE.length);

    // Every expected table appears in order.
    for (let i = 0; i < EXPECTED_DELETE_TABLES.length; i++) {
      const table = EXPECTED_DELETE_TABLES[i];
      const call = deleteCalls[i];
      expect(call.sql).toMatch(new RegExp(`DELETE\\s+FROM\\s+${table}`, "i"));
    }

    // Final DELETE must target companies.
    const lastDelete = deleteCalls[deleteCalls.length - 1];
    expect(lastDelete.sql).toMatch(
      /DELETE\s+FROM\s+companies\s+WHERE\s+id\s*=/i,
    );
    expect(lastDelete.params).toEqual(["SALES-DEMO-001"]);
  });

  it("R-P1-09: every DELETE is tenant-scoped to SALES-DEMO-001", async () => {
    const conn = makeRecordingExecutor();

    await resetSalesDemo(conn, makeEnv());

    const deleteCalls = conn.calls.filter((c) =>
      /^\s*DELETE\s+FROM/i.test(c.sql),
    );
    for (const call of deleteCalls) {
      // Every DELETE must take exactly one bound param equal to the demo tenant id.
      expect(call.params).toEqual(["SALES-DEMO-001"]);
    }
  });

  // Tests R-P1-10 — resetSalesDemo is idempotent (second invocation exits 0 with 0 new rows).
  it("R-P1-10: second invocation is idempotent (no throw, full DELETE sequence re-issued)", async () => {
    const conn = makeRecordingExecutor();
    const env = makeEnv();

    await resetSalesDemo(conn, env);
    const firstRunDeleteCount = conn.calls.filter((c) =>
      /^\s*DELETE\s+FROM/i.test(c.sql),
    ).length;

    // Second invocation — the recording executor always returns empty
    // results so this simulates "already empty tenant". It must not
    // throw and must not change behavior (same DELETE sequence re-issued
    // because DELETE on no-rows is a safe no-op in SQL).
    await expect(resetSalesDemo(conn, env)).resolves.toBeUndefined();

    const totalDeletes = conn.calls.filter((c) =>
      /^\s*DELETE\s+FROM/i.test(c.sql),
    ).length;
    // Second run should have issued the same number of deletes as the first.
    expect(totalDeletes).toBe(firstRunDeleteCount * 2);
  });

  it("R-P1-10: journal_lines DELETE uses the subquery form (no company_id column)", async () => {
    const conn = makeRecordingExecutor();

    await resetSalesDemo(conn, makeEnv());

    const journalLinesCall = conn.calls.find((c) =>
      /DELETE\s+FROM\s+journal_lines/i.test(c.sql),
    );
    expect(journalLinesCall).toBeDefined();
    // journal_lines has no company_id column — must filter via journal_entries subquery.
    expect(journalLinesCall!.sql).toMatch(
      /journal_entry_id\s+IN\s*\(\s*SELECT\s+id\s+FROM\s+journal_entries\s+WHERE\s+company_id\s*=\s*\?/i,
    );
  });

  it("R-P1-09 (column-name guard): fuel_ledger uses company_id, not tenant_id", async () => {
    const conn = makeRecordingExecutor();

    await resetSalesDemo(conn, makeEnv());

    const fuelCall = conn.calls.find((c) =>
      /DELETE\s+FROM\s+fuel_ledger/i.test(c.sql),
    );
    expect(fuelCall).toBeDefined();
    expect(fuelCall!.sql).toMatch(/company_id\s*=\s*\?/i);
    expect(fuelCall!.sql).not.toMatch(/tenant_id\s*=/i);
  });
});
