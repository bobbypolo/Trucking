/**
 * Tests R-P10-01: Migration 057 Financial Objectives
 *
 * Validates migration `057_financial_objectives.sql`:
 *  - UP section creates the `financial_objectives` table with all 9 columns
 *    (id, company_id, quarter, revenue_target, expense_budget,
 *     profit_target, notes, created_at, updated_at)
 *  - `quarter` is VARCHAR(7) for "YYYY-QN" format
 *  - `revenue_target`, `expense_budget`, `profit_target` are DECIMAL columns
 *  - DOWN section drops the `financial_objectives` table
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const MIGRATIONS_DIR = path.resolve(__dirname, "../../migrations");
const MIGRATION_FILE = "057_financial_objectives.sql";

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

describe("Migration 057: Financial Objectives", () => {
  // ── R-P10-01: file exists and has UP/DOWN sections ─────────────────

  it("Tests R-P10-01 — migration file exists", () => {
    const filePath = path.join(MIGRATIONS_DIR, MIGRATION_FILE);
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it("Tests R-P10-01 — has -- UP section", () => {
    const sql = readMigration();
    expect(sql).toContain("-- UP");
  });

  it("Tests R-P10-01 — has -- DOWN section", () => {
    const sql = readMigration();
    expect(sql).toContain("-- DOWN");
  });

  // ── R-P10-01: UP creates financial_objectives table ────────────────

  it("Tests R-P10-01 — UP section creates financial_objectives table", () => {
    const up = getUpSection(readMigration());
    expect(up).toMatch(
      /CREATE TABLE\s+(?:IF NOT EXISTS\s+)?financial_objectives/i,
    );
  });

  // ── R-P10-01: UP has all 9 required columns ────────────────────────

  it("Tests R-P10-01 — UP declares id column as VARCHAR(36)", () => {
    const up = getUpSection(readMigration());
    expect(up).toMatch(/\bid\s+VARCHAR\(36\)/i);
  });

  it("Tests R-P10-01 — UP declares company_id column as VARCHAR(36)", () => {
    const up = getUpSection(readMigration());
    expect(up).toMatch(/\bcompany_id\s+VARCHAR\(36\)/i);
  });

  it("Tests R-P10-01 — UP declares quarter column as VARCHAR(7)", () => {
    const up = getUpSection(readMigration());
    expect(up).toMatch(/\bquarter\s+VARCHAR\(7\)/i);
  });

  it("Tests R-P10-01 — UP declares revenue_target as DECIMAL", () => {
    const up = getUpSection(readMigration());
    expect(up).toMatch(/\brevenue_target\s+DECIMAL/i);
  });

  it("Tests R-P10-01 — UP declares expense_budget as DECIMAL", () => {
    const up = getUpSection(readMigration());
    expect(up).toMatch(/\bexpense_budget\s+DECIMAL/i);
  });

  it("Tests R-P10-01 — UP declares profit_target as DECIMAL", () => {
    const up = getUpSection(readMigration());
    expect(up).toMatch(/\bprofit_target\s+DECIMAL/i);
  });

  it("Tests R-P10-01 — UP declares notes as TEXT", () => {
    const up = getUpSection(readMigration());
    expect(up).toMatch(/\bnotes\s+TEXT\b/i);
  });

  it("Tests R-P10-01 — UP declares created_at as DATETIME", () => {
    const up = getUpSection(readMigration());
    expect(up).toMatch(/\bcreated_at\s+DATETIME\b/i);
  });

  it("Tests R-P10-01 — UP declares updated_at as DATETIME", () => {
    const up = getUpSection(readMigration());
    expect(up).toMatch(/\bupdated_at\s+DATETIME\b/i);
  });

  it("Tests R-P10-01 — UP contains all 9 required column names", () => {
    const up = getUpSection(readMigration());
    const columns = [
      "id",
      "company_id",
      "quarter",
      "revenue_target",
      "expense_budget",
      "profit_target",
      "notes",
      "created_at",
      "updated_at",
    ];
    for (const col of columns) {
      const re = new RegExp(`\\b${col}\\b`, "i");
      expect(up, `Expected column ${col} in UP section`).toMatch(re);
    }
    expect(columns.length).toBe(9);
  });

  // ── R-P10-01: DOWN safely drops the table ──────────────────────────

  it("Tests R-P10-01 — DOWN section drops financial_objectives table", () => {
    const down = getDownSection(readMigration());
    expect(down).toMatch(
      /DROP\s+TABLE\s+(?:IF EXISTS\s+)?financial_objectives/i,
    );
  });

  it("Tests R-P10-01 — DOWN does not drop other tables", () => {
    const down = getDownSection(readMigration());
    const dropTableMatches = Array.from(
      down.matchAll(/DROP\s+TABLE\s+(?:IF EXISTS\s+)?(\w+)/gi),
      (m) => m[1],
    );
    expect(dropTableMatches).toEqual(["financial_objectives"]);
  });
});
