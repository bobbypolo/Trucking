/**
 * Tests R-P8-01, R-P8-02: Migration 055 Quote Margin Columns
 *
 * Validates migration `055_quote_margin_columns.sql`:
 *  - UP section adds 5 columns: margin, discount, commission, estimated_driver_pay, company_cost_factor to quotes
 *  - company_cost_factor has DEFAULT 50.00
 *  - DOWN section drops ONLY the 5 columns the UP added (in reverse order)
 *  - DOWN contains NO DROP COLUMN targeting any other column name
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const MIGRATIONS_DIR = path.resolve(__dirname, "../../migrations");
const MIGRATION_FILE = "055_quote_margin_columns.sql";

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

describe("Migration 055: Quote Margin Columns", () => {
  // ── R-P8-01: UP adds 5 columns ──────────────────────────────────────

  it("Tests R-P8-01 — migration file exists", () => {
    const filePath = path.join(MIGRATIONS_DIR, MIGRATION_FILE);
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it("Tests R-P8-01 — has -- UP section", () => {
    const sql = readMigration();
    expect(sql).toContain("-- UP");
  });

  it("Tests R-P8-01 — UP section targets quotes table", () => {
    const up = getUpSection(readMigration());
    expect(up).toMatch(/ALTER TABLE\s+quotes/i);
  });

  it("Tests R-P8-01 — UP section adds margin column with DECIMAL type", () => {
    const up = getUpSection(readMigration());
    expect(up).toMatch(/ADD COLUMN\s+margin\s+DECIMAL\(5,\s*2\)/i);
  });

  it("Tests R-P8-01 — UP section adds discount column with DECIMAL type", () => {
    const up = getUpSection(readMigration());
    expect(up).toMatch(/ADD COLUMN\s+discount\s+DECIMAL\(5,\s*2\)/i);
  });

  it("Tests R-P8-01 — UP section adds commission column with DECIMAL type", () => {
    const up = getUpSection(readMigration());
    expect(up).toMatch(/ADD COLUMN\s+commission\s+DECIMAL\(5,\s*2\)/i);
  });

  it("Tests R-P8-01 — UP section adds estimated_driver_pay column with DECIMAL(10,2) type", () => {
    const up = getUpSection(readMigration());
    expect(up).toMatch(
      /ADD COLUMN\s+estimated_driver_pay\s+DECIMAL\(10,\s*2\)/i,
    );
  });

  it("Tests R-P8-01 — UP section adds company_cost_factor column with DECIMAL type", () => {
    const up = getUpSection(readMigration());
    expect(up).toMatch(/ADD COLUMN\s+company_cost_factor\s+DECIMAL\(5,\s*2\)/i);
  });

  it("Tests R-P8-01 — UP section contains all 5 new column names exactly once", () => {
    const up = getUpSection(readMigration());
    const columns = [
      "margin",
      "discount",
      "commission",
      "estimated_driver_pay",
      "company_cost_factor",
    ];
    for (const col of columns) {
      // Match ADD COLUMN <col> with word boundary to avoid substring collision
      const re = new RegExp(`ADD COLUMN\\s+${col}\\b`, "gi");
      const matches = up.match(re) || [];
      expect(
        matches.length,
        `Expected ADD COLUMN ${col} to appear exactly once`,
      ).toBe(1);
    }
  });

  // ── R-P8-02: company_cost_factor DEFAULT 50.00 ──────────────────────

  it("Tests R-P8-02 — company_cost_factor has DEFAULT 50.00", () => {
    const up = getUpSection(readMigration());
    expect(up).toMatch(
      /company_cost_factor\s+DECIMAL\(5,\s*2\)\s+(?:NOT NULL\s+)?DEFAULT\s+50\.00/i,
    );
  });

  // ── DOWN section safety assertions ──────────────────────────────────

  it("Tests R-P8-01 — has -- DOWN section", () => {
    const sql = readMigration();
    expect(sql).toContain("-- DOWN");
  });

  it("Tests R-P8-01 — DOWN section drops exactly the 5 added columns", () => {
    const down = getDownSection(readMigration());
    const allTargets: string[] = Array.from(
      down.matchAll(/DROP\s+COLUMN\s+(\w+)/gi),
      (m) => m[1],
    );
    const expected = new Set([
      "margin",
      "discount",
      "commission",
      "estimated_driver_pay",
      "company_cost_factor",
    ]);
    const unexpected = allTargets.filter((t) => !expected.has(t));
    expect(
      unexpected,
      `DOWN must only drop the 5 added columns. Unexpected targets: ${unexpected.join(", ")}`,
    ).toEqual([]);
    expect(allTargets.length).toBe(5);
  });

  it("Tests R-P8-01 — DOWN does NOT DROP TABLE quotes", () => {
    const down = getDownSection(readMigration());
    expect(down).not.toMatch(/DROP\s+TABLE\s+(IF EXISTS\s+)?quotes/i);
  });
});
