/**
 * Tests R-P5-01, R-P5-02: Migration 050 Loads Intake Source
 *
 * Validates migration `050_loads_intake_source.sql`:
 *  - UP section adds intake_source VARCHAR column
 *  - DOWN section drops ONLY intake_source — no other DROP COLUMN
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const MIGRATIONS_DIR = path.resolve(__dirname, "../../migrations");
const MIGRATION_FILE = "050_loads_intake_source.sql";

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

describe("Migration 050: Loads Intake Source", () => {
  // ── R-P5-01: UP section assertions ───────────────────────────────────

  it("Tests R-P5-01 — migration file exists", () => {
    const filePath = path.join(MIGRATIONS_DIR, MIGRATION_FILE);
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it("Tests R-P5-01 — has -- UP section", () => {
    const sql = readMigration();
    expect(sql).toContain("-- UP");
  });

  it("Tests R-P5-01 — UP section contains ADD COLUMN intake_source VARCHAR", () => {
    const up = getUpSection(readMigration());
    expect(up).toContain("ADD COLUMN intake_source VARCHAR");
  });

  it("Tests R-P5-01 — UP section targets loads table", () => {
    const up = getUpSection(readMigration());
    expect(up).toMatch(/ALTER TABLE\s+loads/i);
  });

  // ── R-P5-02: DOWN section assertions ─────────────────────────────────

  it("Tests R-P5-02 — has -- DOWN section", () => {
    const sql = readMigration();
    expect(sql).toContain("-- DOWN");
  });

  it("Tests R-P5-02 — DOWN section contains DROP COLUMN intake_source", () => {
    const down = getDownSection(readMigration());
    expect(down).toContain("DROP COLUMN intake_source");
  });

  it("Tests R-P5-02 — DOWN section contains NO other DROP COLUMN targets", () => {
    const down = getDownSection(readMigration());
    const allTargets: string[] = Array.from(
      down.matchAll(/DROP\s+COLUMN\s+(\w+)/gi),
      (m) => m[1],
    );
    const allowed = new Set(["intake_source"]);
    const unexpected = allTargets.filter((t) => !allowed.has(t));
    expect(
      unexpected,
      `DOWN must only drop intake_source. Unexpected DROP COLUMN targets: ${unexpected.join(", ")}`,
    ).toEqual([]);
  });

  it("Tests R-P5-02 — DOWN drops exactly 1 column (intake_source)", () => {
    const down = getDownSection(readMigration());
    const dropColumnMatches = down.match(/DROP\s+COLUMN/gi) || [];
    expect(dropColumnMatches.length).toBe(1);
  });

  it("Tests R-P5-02 — DOWN does NOT DROP TABLE loads", () => {
    const down = getDownSection(readMigration());
    expect(down).not.toMatch(/DROP\s+TABLE\s+(IF EXISTS\s+)?loads/i);
  });
});
