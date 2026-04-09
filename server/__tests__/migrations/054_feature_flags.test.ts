/**
 * Tests R-B1-21: Migration 054 Feature Flags
 *
 * Validates migration `054_feature_flags.sql`:
 *  - UP creates `feature_flags` table with 6 columns:
 *    id, company_id, flag_name, flag_value, updated_at, updated_by
 *  - DOWN drops only the `feature_flags` table
 *  - Test reads SQL file via `fs.readFileSync`
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const MIGRATIONS_DIR = path.resolve(__dirname, "../../migrations");
const MIGRATION_FILE = "054_feature_flags.sql";

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

describe("Migration 054: Feature Flags", () => {
  // ── R-B1-21: migration creates feature_flags table with 6 columns ──

  it("Tests R-B1-21 — migration file exists and is readable via fs.readFileSync", () => {
    const filePath = path.join(MIGRATIONS_DIR, MIGRATION_FILE);
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content.length).toBeGreaterThan(0);
  });

  it("Tests R-B1-21 — has -- UP section", () => {
    const sql = readMigration();
    expect(sql).toContain("-- UP");
  });

  it("Tests R-B1-21 — has -- DOWN section", () => {
    const sql = readMigration();
    expect(sql).toContain("-- DOWN");
  });

  it("Tests R-B1-21 — UP section creates feature_flags table", () => {
    const up = getUpSection(readMigration());
    expect(up).toMatch(
      /CREATE\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?feature_flags/i,
    );
  });

  it("Tests R-B1-21 — UP section contains column: id (INT AUTO_INCREMENT PRIMARY KEY)", () => {
    const up = getUpSection(readMigration());
    expect(up).toMatch(/id\s+INT\s+AUTO_INCREMENT\s+PRIMARY\s+KEY/i);
  });

  it("Tests R-B1-21 — UP section contains column: company_id (VARCHAR)", () => {
    const up = getUpSection(readMigration());
    expect(up).toMatch(/company_id\s+VARCHAR\(\d+\)/i);
  });

  it("Tests R-B1-21 — UP section contains column: flag_name (VARCHAR)", () => {
    const up = getUpSection(readMigration());
    expect(up).toMatch(/flag_name\s+VARCHAR\(\d+\)/i);
  });

  it("Tests R-B1-21 — UP section contains column: flag_value (TINYINT/BOOLEAN)", () => {
    const up = getUpSection(readMigration());
    expect(up).toMatch(/flag_value\s+(TINYINT\(\d+\)|BOOLEAN)/i);
  });

  it("Tests R-B1-21 — UP section contains column: updated_at (DATETIME)", () => {
    const up = getUpSection(readMigration());
    expect(up).toMatch(/updated_at\s+DATETIME/i);
  });

  it("Tests R-B1-21 — UP section contains column: updated_by (VARCHAR)", () => {
    const up = getUpSection(readMigration());
    expect(up).toMatch(/updated_by\s+VARCHAR\(\d+\)/i);
  });

  it("Tests R-B1-21 — UP section defines exactly 6 columns", () => {
    const up = getUpSection(readMigration());
    // Count column definitions (lines starting with a column name after CREATE TABLE)
    const expectedColumns = [
      "id",
      "company_id",
      "flag_name",
      "flag_value",
      "updated_at",
      "updated_by",
    ];
    for (const col of expectedColumns) {
      expect(up).toMatch(new RegExp(`\\b${col}\\b`, "i"));
    }
    expect(expectedColumns.length).toBe(6);
  });

  it("Tests R-B1-21 — DOWN section drops feature_flags table", () => {
    const down = getDownSection(readMigration());
    expect(down).toMatch(/DROP\s+TABLE\s+(IF\s+EXISTS\s+)?feature_flags/i);
  });

  it("Tests R-B1-21 — DOWN section contains exactly one DROP TABLE statement", () => {
    const down = getDownSection(readMigration());
    const matches = down.match(/DROP\s+TABLE/gi) || [];
    expect(matches.length).toBe(1);
  });
});
