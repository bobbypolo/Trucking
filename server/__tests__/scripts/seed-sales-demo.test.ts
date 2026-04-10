/**
 * Unit tests for server/scripts/seed-sales-demo.ts (Phase 1 — Bulletproof Sales Demo).
 *
 * Tests R-P1-01, R-P1-02, R-P1-04, R-P1-07, R-P1-08, R-P1-12.
 *
 * Strategy: the seed script accepts a SqlExecutor interface so tests can
 * pass a fake executor that records every (sql, params) pair instead of
 * hitting a real MySQL server. The assertions below are behavioral: we
 * assert the captured SQL contract, not internal method call counts.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

import {
  SALES_DEMO_COMPANY_ID,
  SqlExecutor,
  SalesDemoFixtureData,
  seedSalesDemo,
  loadSalesDemoFixture,
  validateSalesDemoEnv,
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

describe("seed-sales-demo — Phase 1 seed pipeline", () => {
  // Tests R-P1-01 — seedSalesDemo issues UPDATE companies SET subscription_tier='Fleet Core'
  // for SALES-DEMO-001 (assert by SQL capture).
  it("R-P1-01: issues UPDATE companies SET subscription_tier='Fleet Core' for SALES-DEMO-001", async () => {
    const conn = makeRecordingExecutor();

    await seedSalesDemo(conn, makeEnv());

    const updateCalls = conn.calls.filter(
      (c) =>
        /UPDATE\s+companies/i.test(c.sql) &&
        /subscription_tier\s*=\s*'Fleet Core'/i.test(c.sql),
    );

    expect(updateCalls.length).toBe(1);
    expect(updateCalls[0].params).toEqual([SALES_DEMO_COMPANY_ID]);
    // Specific value assertion: the update must also set status=active
    // so the tier enforcement middleware lets every requireTier call through.
    expect(/subscription_status\s*=\s*'active'/i.test(updateCalls[0].sql)).toBe(
      true,
    );
  });

  // Tests R-P1-02 — seedSalesDemo throws Error('SALES_DEMO_ADMIN_FIREBASE_UID required')
  // when env var unset.
  it("R-P1-02: throws SALES_DEMO_ADMIN_FIREBASE_UID required when admin UID is unset", async () => {
    const conn = makeRecordingExecutor();
    const env = makeEnv({ SALES_DEMO_ADMIN_FIREBASE_UID: undefined });

    await expect(seedSalesDemo(conn, env)).rejects.toThrow(
      "SALES_DEMO_ADMIN_FIREBASE_UID required",
    );
  });

  it("R-P1-02 (driver): throws SALES_DEMO_DRIVER_FIREBASE_UID required when driver UID is unset", async () => {
    const conn = makeRecordingExecutor();
    const env = makeEnv({ SALES_DEMO_DRIVER_FIREBASE_UID: undefined });

    await expect(seedSalesDemo(conn, env)).rejects.toThrow(
      "SALES_DEMO_DRIVER_FIREBASE_UID required",
    );
  });

  it("R-P1-02: validateSalesDemoEnv throws on missing DB credentials", () => {
    const env = makeEnv({ DB_HOST: undefined });
    expect(() => validateSalesDemoEnv(env)).toThrow("DB_HOST required");
  });

  // Tests R-P1-04 — seedSalesDemo inserts gl_accounts rows with ids GL-6900 AND GL-2200
  // (the IFTA pair) before any IFTA evidence insert.
  it("R-P1-04: inserts gl_accounts rows with ids GL-6900 AND GL-2200", async () => {
    const conn = makeRecordingExecutor();

    await seedSalesDemo(conn, makeEnv());

    const glInserts = conn.calls.filter(
      (c) =>
        /INSERT\s+IGNORE\s+INTO\s+gl_accounts/i.test(c.sql) &&
        typeof c.params[0] === "string",
    );

    const glIds = glInserts.map((c) => c.params[0] as string);
    expect(glIds).toContain("GL-6900");
    expect(glIds).toContain("GL-2200");

    // Phase 3 chains seedSalesDemoIfta after the Phase 1 accounts seed;
    // assert the ordering constraint via the call-index of the last
    // gl_accounts INSERT vs the first ifta_trip_evidence INSERT — GL
    // rows must land before any IFTA evidence row (Phase 1 precedes
    // Phase 3 in the seed pipeline).
    const glIndexes = conn.calls
      .map((c, i) =>
        /INSERT\s+IGNORE\s+INTO\s+gl_accounts/i.test(c.sql) ? i : -1,
      )
      .filter((i) => i >= 0);
    const iftaIndexes = conn.calls
      .map((c, i) =>
        /INSERT.*INTO\s+ifta_trip_evidence/i.test(c.sql) ? i : -1,
      )
      .filter((i) => i >= 0);
    const lastGlIndex = glIndexes[glIndexes.length - 1];
    const firstIftaIndex = iftaIndexes[0];
    expect(lastGlIndex).toBeGreaterThanOrEqual(0);
    expect(firstIftaIndex).toBeGreaterThan(lastGlIndex);
  });

  // Tests R-P1-07 — 100% of seedSalesDemo insert statements use INSERT IGNORE.
  it("R-P1-07: every INSERT statement in seedSalesDemo uses INSERT IGNORE", async () => {
    const conn = makeRecordingExecutor();

    await seedSalesDemo(conn, makeEnv());

    const allInserts = conn.calls.filter((c) => /^\s*INSERT/i.test(c.sql));
    expect(allInserts.length).toBeGreaterThan(0);

    const insertIgnoreRe = /^\s*INSERT\s+IGNORE/i;
    const nonIdempotent = allInserts.filter((c) => !insertIgnoreRe.test(c.sql));
    expect(nonIdempotent).toEqual([]);
  });

  // Tests R-P1-08 — seedSalesDemo does NOT import or require server/scripts/seed-demo.ts
  // (independent pipeline guarantee — assert via grep on the source).
  it("R-P1-08: source does not import or require server/scripts/seed-demo.ts", () => {
    const sourcePath = path.resolve(
      __dirname,
      "../../scripts/seed-sales-demo.ts",
    );
    const src = fs.readFileSync(sourcePath, "utf-8");

    expect(src).not.toMatch(/from\s+['"].*seed-demo['"]/);
    expect(src).not.toMatch(/require\s*\(\s*['"].*seed-demo['"]\s*\)/);
    // Also reject any direct path reference (defensive — catches bare
    // strings used in dynamic imports).
    expect(src).not.toMatch(/['"]\.\/seed-demo['"]/);
  });

  // Tests R-P1-12 — seedSalesDemo source contains exactly one dotenv.config call
  // and that call references '.env.local' (NOT '.env') — proves the single env contract.
  it("R-P1-12: source contains exactly one dotenv.config call referencing '.env.local'", () => {
    const sourcePath = path.resolve(
      __dirname,
      "../../scripts/seed-sales-demo.ts",
    );
    const src = fs.readFileSync(sourcePath, "utf-8");

    const dotenvConfigRe = /dotenv\.config\s*\(/g;
    const dotenvConfigMatches = src.match(dotenvConfigRe) ?? [];
    expect(dotenvConfigMatches.length).toBe(1);

    // The single dotenv.config call MUST reference .env.local
    const envLocalRe =
      /dotenv\.config\s*\(\s*\{\s*path:\s*[^}]*\.env\.local[^}]*\}\s*\)/;
    expect(envLocalRe.test(src)).toBe(true);
  });

  // Additional behavioral test: fixture loader returns a well-formed shape
  // with the two IFTA GL accounts present. This guards against accidental
  // fixture corruption breaking R-P1-04.
  it("loadSalesDemoFixture returns fixture with GL-6900 and GL-2200 present", () => {
    const fixture: SalesDemoFixtureData = loadSalesDemoFixture();
    expect(fixture.company.id).toBe("SALES-DEMO-001");
    expect(fixture.company.subscription_tier).toBe("Fleet Core");
    expect(fixture.users.length).toBe(2);

    const glIds = fixture.gl_accounts.map((a) => a.id);
    expect(glIds).toContain("GL-6900");
    expect(glIds).toContain("GL-2200");
    expect(fixture.gl_accounts.length).toBe(7);
  });

  // Additional behavioral test: users get the right firebase_uid from env.
  it("seeds admin and driver users with firebase_uid values from env", async () => {
    const conn = makeRecordingExecutor();
    const env = makeEnv({
      SALES_DEMO_ADMIN_FIREBASE_UID: "fb-admin-uid-specific",
      SALES_DEMO_DRIVER_FIREBASE_UID: "fb-driver-uid-specific",
    });

    await seedSalesDemo(conn, env);

    const userInserts = conn.calls.filter((c) =>
      /INSERT\s+IGNORE\s+INTO\s+users/i.test(c.sql),
    );
    // 2 original users (admin + driver) + 4 fleet drivers from Phase 6
    expect(userInserts.length).toBe(6);

    // params index 3 is firebase_uid in the users INSERT template
    const firebaseUids = userInserts.map((c) => c.params[3] as string);
    expect(firebaseUids).toContain("fb-admin-uid-specific");
    expect(firebaseUids).toContain("fb-driver-uid-specific");
  });
});
