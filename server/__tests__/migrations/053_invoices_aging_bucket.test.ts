/**
 * Tests R-B1-01 / R-B1-02: Migration 053 Invoices Aging Bucket
 *
 * Validates migration `053_invoices_aging_bucket.sql`:
 *  - UP adds exactly one `ALTER TABLE ar_invoices ADD COLUMN aging_bucket VARCHAR(16) NULL`
 *  - DOWN removes only that one column with no other DROP occurrences
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const MIGRATIONS_DIR = path.resolve(__dirname, "../../migrations");
const MIGRATION_FILE = "053_invoices_aging_bucket.sql";

function readMigration(): string {
  return fs.readFileSync(path.join(MIGRATIONS_DIR, MIGRATION_FILE), "utf-8");
}

function getUpSection(sql: string): string {
  const upIdx = sql.indexOf("-- UP");
  const downIdx = sql.indexOf("-- DOWN");
  if (upIdx < 0) return "";
  const endIdx = downIdx >= 0 ? downIdx : sql.length;
  return sql.substring(upIdx, endIdx);
}

function getDownSection(sql: string): string {
  const downIdx = sql.indexOf("-- DOWN");
  if (downIdx < 0) return "";
  return sql.substring(downIdx);
}

describe("Migration 053: Invoices Aging Bucket", () => {
  // ── R-B1-01: UP section assertions ───────────────────────────────────

  it("Tests R-B1-01 — migration file exists", () => {
    const filePath = path.join(MIGRATIONS_DIR, MIGRATION_FILE);
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it("Tests R-B1-01 — has -- UP section", () => {
    const sql = readMigration();
    expect(sql).toContain("-- UP");
  });

  it("Tests R-B1-01 — UP section contains ALTER TABLE ar_invoices ADD COLUMN aging_bucket VARCHAR(16) NULL", () => {
    const up = getUpSection(readMigration());
    expect(up).toMatch(
      /ALTER\s+TABLE\s+ar_invoices\s+ADD\s+COLUMN\s+aging_bucket\s+VARCHAR\(16\)\s+NULL/i,
    );
  });

  it("Tests R-B1-01 — UP section contains exactly one ALTER TABLE statement", () => {
    const up = getUpSection(readMigration());
    const matches = up.match(/ALTER\s+TABLE/gi) || [];
    expect(matches.length).toBe(1);
  });

  it("Tests R-B1-01 — UP section adds exactly one column", () => {
    const up = getUpSection(readMigration());
    const matches = up.match(/ADD\s+COLUMN/gi) || [];
    expect(matches.length).toBe(1);
  });

  // ── R-B1-02: DOWN section assertions ─────────────────────────────────

  it("Tests R-B1-02 — has -- DOWN section", () => {
    const sql = readMigration();
    expect(sql).toContain("-- DOWN");
  });

  it("Tests R-B1-02 — DOWN section contains ALTER TABLE ar_invoices DROP COLUMN aging_bucket", () => {
    const down = getDownSection(readMigration());
    expect(down).toMatch(
      /ALTER\s+TABLE\s+ar_invoices\s+DROP\s+COLUMN\s+aging_bucket/i,
    );
  });

  it("Tests R-B1-02 — DOWN section contains exactly one DROP occurrence", () => {
    const down = getDownSection(readMigration());
    const matches = down.match(/DROP/gi) || [];
    expect(matches.length).toBe(1);
  });

  it("Tests R-B1-02 — DOWN does NOT DROP TABLE ar_invoices", () => {
    const down = getDownSection(readMigration());
    expect(down).not.toMatch(/DROP\s+TABLE\s+(IF\s+EXISTS\s+)?ar_invoices/i);
  });

  it("Tests R-B1-02 — DOWN section contains NO other DROP COLUMN targets", () => {
    const down = getDownSection(readMigration());
    const allTargets: string[] = Array.from(
      down.matchAll(/DROP\s+COLUMN\s+(\w+)/gi),
      (m) => m[1],
    );
    const allowed = new Set(["aging_bucket"]);
    const unexpected = allTargets.filter((t) => !allowed.has(t));
    expect(
      unexpected,
      `DOWN must only drop aging_bucket. Unexpected: ${unexpected.join(", ")}`,
    ).toEqual([]);
  });
});
