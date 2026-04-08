/**
 * Unit tests for seedSalesDemoLoads — Phase 2, Bulletproof Sales Demo.
 *
 * Covers acceptance criteria R-P2-01 through R-P2-05, R-P2-08, R-P2-09,
 * and R-P2-10. Uses the same recording-executor pattern as Phase 1's
 * seed-sales-demo.test.ts — we pass a fake SqlExecutor that records
 * every (sql, params) pair and then assert the captured SQL contract.
 *
 * Phase 2 contract (verified against PLAN.md Phase 2 and
 * .claude/prd.json STORY-002.acceptanceCriteria):
 *   - 1 customers INSERT (SALES-DEMO-CUST-001, ACME Logistics LLC, Broker)
 *   - 1 loads INSERT (LP-DEMO-RC-001, customer_id = SALES-DEMO-CUST-001)
 *   - 2 load_legs INSERTs (pickup Houston TX + dropoff Chicago IL)
 *   - 3 documents INSERTs (rate-con, bol, lumper-receipt)
 *   - all statements use INSERT IGNORE
 *   - idempotent on second invocation (captured by recording executor)
 *   - zero AI imports / Scanner imports in the seed source
 *   - 3 real binary PDF fixtures exist on disk with %PDF magic number
 *   - post-seed, 3 files are copied into the live upload directory
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

import {
  SALES_DEMO_COMPANY_ID,
  SqlExecutor,
  seedSalesDemoLoads,
  SALES_DEMO_BROKER_ID,
  SALES_DEMO_HERO_LOAD_ID,
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

// Isolated upload directory per test so we can assert file copies
// without polluting the real ./uploads folder.
let TMP_UPLOAD_DIR: string;
const ORIGINAL_UPLOAD_DIR = process.env.UPLOAD_DIR;

beforeEach(() => {
  TMP_UPLOAD_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "sales-demo-upload-"));
  process.env.UPLOAD_DIR = TMP_UPLOAD_DIR;
});

afterEach(() => {
  if (ORIGINAL_UPLOAD_DIR === undefined) {
    delete process.env.UPLOAD_DIR;
  } else {
    process.env.UPLOAD_DIR = ORIGINAL_UPLOAD_DIR;
  }
  if (TMP_UPLOAD_DIR && fs.existsSync(TMP_UPLOAD_DIR)) {
    fs.rmSync(TMP_UPLOAD_DIR, { recursive: true, force: true });
  }
});

describe("seedSalesDemoLoads — Phase 2 hero load + broker seed", () => {
  // Tests R-P2-01
  it("R-P2-01: inserts exactly 1 customers row with id SALES-DEMO-CUST-001 and type Broker", async () => {
    const conn = makeRecordingExecutor();

    await seedSalesDemoLoads(conn);

    const customerInserts = conn.calls.filter((c) =>
      /INSERT\s+IGNORE\s+INTO\s+customers/i.test(c.sql),
    );
    expect(customerInserts.length).toBe(1);

    const params = customerInserts[0].params;
    // params[0] is the id column
    expect(params[0]).toBe(SALES_DEMO_BROKER_ID);
    expect(SALES_DEMO_BROKER_ID).toBe("SALES-DEMO-CUST-001");
    // The INSERT parameter list must include type 'Broker' — the customers
    // table type ENUM is ('Broker', 'Direct Customer'). Assert the value
    // appears as one of the bound params (column order may vary).
    expect(params).toContain("Broker");
    // The broker name must be ACME Logistics LLC — buyer recognition anchor.
    expect(params).toContain("ACME Logistics LLC");
  });

  // Tests R-P2-02
  it("R-P2-02: inserts exactly 1 loads row with id LP-DEMO-RC-001 and customer_id SALES-DEMO-CUST-001", async () => {
    const conn = makeRecordingExecutor();

    await seedSalesDemoLoads(conn);

    const loadInserts = conn.calls.filter((c) =>
      /INSERT\s+IGNORE\s+INTO\s+loads/i.test(c.sql),
    );
    expect(loadInserts.length).toBe(1);

    const params = loadInserts[0].params;
    expect(params[0]).toBe(SALES_DEMO_HERO_LOAD_ID);
    expect(SALES_DEMO_HERO_LOAD_ID).toBe("LP-DEMO-RC-001");
    // FK linkage to broker is the R-P2-02 contract — customer_id column
    // must equal SALES-DEMO-CUST-001.
    expect(params).toContain(SALES_DEMO_BROKER_ID);
    // Company scoping must also be the canonical sales-demo tenant.
    expect(params).toContain(SALES_DEMO_COMPANY_ID);
  });

  // Tests R-P2-03
  it("R-P2-03: inserts exactly 2 load_legs rows and 3 documents rows linked to LP-DEMO-RC-001", async () => {
    const conn = makeRecordingExecutor();

    await seedSalesDemoLoads(conn);

    const legInserts = conn.calls.filter((c) =>
      /INSERT\s+IGNORE\s+INTO\s+load_legs/i.test(c.sql),
    );
    expect(legInserts.length).toBe(2);
    // Both legs must reference the hero load id.
    for (const leg of legInserts) {
      expect(leg.params).toContain(SALES_DEMO_HERO_LOAD_ID);
    }

    const docInserts = conn.calls.filter((c) =>
      /INSERT\s+IGNORE\s+INTO\s+documents/i.test(c.sql),
    );
    expect(docInserts.length).toBe(3);
    for (const doc of docInserts) {
      expect(doc.params).toContain(SALES_DEMO_HERO_LOAD_ID);
    }

    // The 3 document rows must carry distinct document_type values —
    // rate_confirmation, bill_of_lading, lumper_receipt — so the buyer
    // sees the three readable labels on stage (R-P2-13). Flatten all
    // params and search for exact matches (avoids substring collisions
    // with filename columns such as 'rate-con.pdf').
    const allDocParams = docInserts.flatMap((d) => d.params);
    expect(allDocParams).toContain("rate_confirmation");
    expect(allDocParams).toContain("bill_of_lading");
    expect(allDocParams).toContain("lumper_receipt");
  });

  // Tests R-P2-04
  it("R-P2-04: idempotent — second invocation uses INSERT IGNORE on every statement", async () => {
    const conn = makeRecordingExecutor();

    await seedSalesDemoLoads(conn);
    const firstRunCallCount = conn.calls.length;
    await seedSalesDemoLoads(conn);

    // Second run emits the same number of calls as the first. Because
    // every INSERT is INSERT IGNORE, the underlying DB would return
    // affectedRows=0 for existing ids — but the recording executor
    // alone cannot model that; the idempotency contract at the SQL
    // layer is the INSERT IGNORE keyword, which we verify below.
    expect(conn.calls.length).toBe(firstRunCallCount * 2);

    const allInserts = conn.calls.filter((c) => /^\s*INSERT/i.test(c.sql));
    expect(allInserts.length).toBeGreaterThan(0);
    const nonIdempotent = allInserts.filter(
      (c) => !/^\s*INSERT\s+IGNORE/i.test(c.sql),
    );
    expect(nonIdempotent).toEqual([]);
  });

  // Tests R-P2-05
  it("R-P2-05: source does NOT import or call any function from ai.ts, gemini.service.ts, or ocr.service.ts", () => {
    const sourcePath = path.resolve(
      __dirname,
      "../../scripts/seed-sales-demo.ts",
    );
    const src = fs.readFileSync(sourcePath, "utf-8");

    // Reject any import or require that mentions ai.ts, gemini, or ocr.
    expect(src).not.toMatch(/from\s+['"][^'"]*routes\/ai['"]/);
    expect(src).not.toMatch(/from\s+['"][^'"]*gemini\.service['"]/);
    expect(src).not.toMatch(/from\s+['"][^'"]*ocr\.service['"]/);
    expect(src).not.toMatch(
      /require\s*\(\s*['"][^'"]*(routes\/ai|gemini\.service|ocr\.service)['"]\s*\)/,
    );
    // Reject direct references to gemini model SDKs.
    expect(src).not.toMatch(/@google\/genai/);
    expect(src).not.toMatch(/GoogleGenerativeAI/);
  });

  // Tests R-P2-08
  it("R-P2-08: source file snapshot guard — forbidden files untouched in seed-sales-demo.ts", () => {
    const sourcePath = path.resolve(
      __dirname,
      "../../scripts/seed-sales-demo.ts",
    );
    const src = fs.readFileSync(sourcePath, "utf-8");

    // The snapshot guard list — any reference to these modules inside
    // the seed script would violate the hard-rule-1 no-touch contract.
    // components/Scanner.tsx and components/DriverMobileHome.tsx and
    // components/LoadDetailView.tsx and services/brokerService.ts are
    // all client-side files that the seed script must never import.
    const forbiddenRefs = [
      "components/Scanner",
      "components/DriverMobileHome",
      "components/LoadDetailView",
      "services/brokerService",
      "document.service",
    ];
    for (const ref of forbiddenRefs) {
      expect(src).not.toContain(ref);
    }
  });

  // Tests R-P2-09
  it("R-P2-09: three real PDF fixtures exist on disk with valid %PDF magic number and >= 1KB size", () => {
    const fixturesDir = path.resolve(
      __dirname,
      "../../scripts/sales-demo-fixtures",
    );
    const files = ["rate-con.pdf", "bol.pdf", "lumper-receipt.pdf"];

    for (const fname of files) {
      const fp = path.join(fixturesDir, fname);
      expect(fs.existsSync(fp)).toBe(true);

      const stat = fs.statSync(fp);
      // Specific size contract: at least 1024 bytes (plan R-P2-09).
      expect(stat.size).toBeGreaterThanOrEqual(1024);

      const fd = fs.openSync(fp, "r");
      try {
        const header = Buffer.alloc(4);
        fs.readSync(fd, header, 0, 4, 0);
        // PDF magic number: bytes 25 50 44 46 (%PDF in ASCII)
        expect(header.toString("ascii")).toBe("%PDF");
      } finally {
        fs.closeSync(fd);
      }
    }
  });

  // Tests R-P2-10
  it("R-P2-10: seedSalesDemoLoads copies the 3 PDF fixtures into the live upload directory", async () => {
    const conn = makeRecordingExecutor();

    await seedSalesDemoLoads(conn);

    const destDir = path.join(
      TMP_UPLOAD_DIR,
      "sales-demo",
      SALES_DEMO_HERO_LOAD_ID,
    );
    const files = ["rate-con.pdf", "bol.pdf", "lumper-receipt.pdf"];

    const sourceDir = path.resolve(
      __dirname,
      "../../scripts/sales-demo-fixtures",
    );

    for (const fname of files) {
      const destPath = path.join(destDir, fname);
      const sourcePath = path.join(sourceDir, fname);

      expect(fs.existsSync(destPath)).toBe(true);
      // Specific value assertion: destination size must match source.
      const destSize = fs.statSync(destPath).size;
      const sourceSize = fs.statSync(sourcePath).size;
      expect(destSize).toBe(sourceSize);
    }

    // Idempotent copy: second invocation does not throw and leaves the
    // files in place with their original sizes.
    await seedSalesDemoLoads(conn);
    for (const fname of files) {
      const destPath = path.join(destDir, fname);
      expect(fs.existsSync(destPath)).toBe(true);
    }
  });
});
