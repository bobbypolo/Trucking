/**
 * Tests R-P4-01, R-P4-02: Migration 049 Loads Equipment ID
 *
 * Validates migration `049_loads_equipment_id.sql`:
 *  - UP section adds equipment_id VARCHAR(36) column, FK constraint, and index
 *  - DOWN section drops ONLY what UP added — index, FK, then column (in reverse order)
 *  - DOWN contains NO DROP COLUMN targeting any other column name
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const MIGRATIONS_DIR = path.resolve(__dirname, "../../migrations");
const MIGRATION_FILE = "049_loads_equipment_id.sql";

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

describe("Migration 049: Loads Equipment ID", () => {
  // ── R-P4-01: UP section assertions ───────────────────────────────────

  it("Tests R-P4-01 — migration file exists", () => {
    const filePath = path.join(MIGRATIONS_DIR, MIGRATION_FILE);
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it("Tests R-P4-01 — has -- UP section", () => {
    const sql = readMigration();
    expect(sql).toContain("-- UP");
  });

  it("Tests R-P4-01 — UP section contains ADD COLUMN equipment_id VARCHAR(36)", () => {
    const up = getUpSection(readMigration());
    expect(up).toContain("ADD COLUMN equipment_id VARCHAR(36)");
  });

  it("Tests R-P4-01 — UP section contains FK constraint line", () => {
    const up = getUpSection(readMigration());
    expect(up).toContain("fk_loads_equipment_id");
    expect(up).toContain("FOREIGN KEY (equipment_id)");
    expect(up).toContain("REFERENCES equipment(id)");
  });

  it("Tests R-P4-01 — UP section targets loads table", () => {
    const up = getUpSection(readMigration());
    expect(up).toMatch(/ALTER TABLE\s+loads/i);
  });

  it("Tests R-P4-01 — UP section creates index idx_loads_equipment_id", () => {
    const up = getUpSection(readMigration());
    expect(up).toMatch(/CREATE INDEX\s+idx_loads_equipment_id\s+ON\s+loads/i);
  });

  // ── R-P4-02: DOWN section assertions ─────────────────────────────────

  it("Tests R-P4-02 — has -- DOWN section", () => {
    const sql = readMigration();
    expect(sql).toContain("-- DOWN");
  });

  it("Tests R-P4-02 — DOWN section contains DROP COLUMN equipment_id", () => {
    const down = getDownSection(readMigration());
    expect(down).toContain("DROP COLUMN equipment_id");
  });

  it("Tests R-P4-02 — DOWN section contains NO other DROP COLUMN targets", () => {
    const down = getDownSection(readMigration());
    // Find every DROP COLUMN occurrence and capture the column name that follows.
    // Use String.matchAll to avoid any form of `exec` call the prod-scanner flags.
    const allTargets: string[] = Array.from(
      down.matchAll(/DROP\s+COLUMN\s+(\w+)/gi),
      (m) => m[1],
    );
    const allowed = new Set(["equipment_id"]);
    const unexpected = allTargets.filter((t) => !allowed.has(t));
    expect(
      unexpected,
      `DOWN must only drop equipment_id. Unexpected DROP COLUMN targets: ${unexpected.join(", ")}`,
    ).toEqual([]);
  });

  it("Tests R-P4-02 — DOWN drops exactly 1 column (equipment_id)", () => {
    const down = getDownSection(readMigration());
    const dropColumnMatches = down.match(/DROP\s+COLUMN/gi) || [];
    expect(dropColumnMatches.length).toBe(1);
  });

  it("Tests R-P4-02 — DOWN drops the index idx_loads_equipment_id", () => {
    const down = getDownSection(readMigration());
    expect(down).toMatch(/DROP INDEX\s+idx_loads_equipment_id/i);
  });

  it("Tests R-P4-02 — DOWN drops the FK constraint fk_loads_equipment_id", () => {
    const down = getDownSection(readMigration());
    expect(down).toContain("DROP FOREIGN KEY fk_loads_equipment_id");
  });

  it("Tests R-P4-02 — DOWN does NOT DROP TABLE loads", () => {
    const down = getDownSection(readMigration());
    expect(down).not.toMatch(/DROP\s+TABLE\s+(IF EXISTS\s+)?loads/i);
  });
});
