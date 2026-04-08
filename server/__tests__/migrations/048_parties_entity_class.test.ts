/**
 * Tests R-P1-01, R-P1-02: Migration 048 Parties Entity Class
 *
 * Validates migration `048_parties_entity_class.sql`:
 *  - UP section adds entity_class VARCHAR column and vendor_profile JSON column
 *  - UP section adds compound index on (company_id, entity_class)
 *  - DOWN section drops ONLY the two new columns and the new index (Hard Rule 4)
 *  - DOWN contains NO DROP COLUMN targeting any other column name
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const MIGRATIONS_DIR = path.resolve(__dirname, "../../migrations");
const MIGRATION_FILE = "048_parties_entity_class.sql";

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

describe("Migration 048: Parties Entity Class + Vendor Profile", () => {
  // ── R-P1-01: UP section adds both columns ─────────────────────────────

  it("Tests R-P1-01 — migration file exists", () => {
    const filePath = path.join(MIGRATIONS_DIR, MIGRATION_FILE);
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it("Tests R-P1-01 — has -- UP section", () => {
    const sql = readMigration();
    expect(sql).toContain("-- UP");
  });

  it("Tests R-P1-01 — UP section contains literal `ADD COLUMN entity_class`", () => {
    const up = getUpSection(readMigration());
    expect(up).toContain("ADD COLUMN entity_class");
  });

  it("Tests R-P1-01 — UP section contains literal `ADD COLUMN vendor_profile`", () => {
    const up = getUpSection(readMigration());
    expect(up).toContain("ADD COLUMN vendor_profile");
  });

  it("Tests R-P1-01 — UP section ALTER TABLE targets parties", () => {
    const up = getUpSection(readMigration());
    expect(up).toMatch(/ALTER TABLE\s+parties/i);
  });

  it("Tests R-P1-01 — entity_class is VARCHAR(50) DEFAULT NULL", () => {
    const up = getUpSection(readMigration());
    expect(up).toMatch(/entity_class\s+VARCHAR\(50\)\s+DEFAULT NULL/i);
  });

  it("Tests R-P1-01 — vendor_profile is JSON DEFAULT NULL", () => {
    const up = getUpSection(readMigration());
    expect(up).toMatch(/vendor_profile\s+JSON\s+DEFAULT NULL/i);
  });

  it("Tests R-P1-01 — UP section creates compound index on (company_id, entity_class)", () => {
    const up = getUpSection(readMigration());
    expect(up).toMatch(
      /idx_parties_entity_class\s*\(\s*company_id\s*,\s*entity_class\s*\)/i,
    );
  });

  // ── R-P1-02: DOWN section is a precise reversal ───────────────────────

  it("Tests R-P1-02 — has -- DOWN section", () => {
    const sql = readMigration();
    expect(sql).toContain("-- DOWN");
  });

  it("Tests R-P1-02 — DOWN section contains literal `DROP COLUMN entity_class`", () => {
    const down = getDownSection(readMigration());
    expect(down).toContain("DROP COLUMN entity_class");
  });

  it("Tests R-P1-02 — DOWN section contains literal `DROP COLUMN vendor_profile`", () => {
    const down = getDownSection(readMigration());
    expect(down).toContain("DROP COLUMN vendor_profile");
  });

  it("Tests R-P1-02 — DOWN section contains NO other DROP COLUMN targets", () => {
    const down = getDownSection(readMigration());
    // Find every DROP COLUMN occurrence and capture the column name that follows.
    // Use String.matchAll to avoid any form of `exec` call that the prod-scanner
    // regex flags as a false positive.
    const allTargets: string[] = Array.from(
      down.matchAll(/DROP\s+COLUMN\s+(\w+)/gi),
      (m) => m[1],
    );
    const allowed = new Set(["entity_class", "vendor_profile"]);
    const unexpected = allTargets.filter((t) => !allowed.has(t));
    expect(
      unexpected,
      `DOWN must only drop entity_class and vendor_profile. Unexpected DROP COLUMN targets: ${unexpected.join(", ")}`,
    ).toEqual([]);
  });

  it("Tests R-P1-02 — DOWN section drops exactly 2 columns (entity_class + vendor_profile)", () => {
    const down = getDownSection(readMigration());
    const dropColumnMatches = down.match(/DROP\s+COLUMN/gi) || [];
    expect(dropColumnMatches.length).toBe(2);
  });

  it("Tests R-P1-02 — DOWN section drops the compound index", () => {
    const down = getDownSection(readMigration());
    expect(down).toMatch(/DROP\s+INDEX\s+idx_parties_entity_class/i);
  });

  it("Tests R-P1-02 — DOWN section does NOT DROP TABLE parties", () => {
    const down = getDownSection(readMigration());
    // DROP TABLE on parties would be catastrophic — ensure it's absent
    expect(down).not.toMatch(/DROP\s+TABLE\s+(IF EXISTS\s+)?parties/i);
  });
});
