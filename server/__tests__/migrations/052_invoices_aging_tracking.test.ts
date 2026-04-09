/**
 * Tests R-P1-03: Migration 052 Invoices Aging Tracking
 *
 * Validates migration `052_invoices_aging_tracking.sql`:
 *  - UP adds exactly 2 columns: days_since_issued and last_aging_snapshot_at
 *  - DOWN removes only those 2 columns
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const MIGRATIONS_DIR = path.resolve(__dirname, "../../migrations");
const MIGRATION_FILE = "052_invoices_aging_tracking.sql";

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

describe("Migration 052: Invoices Aging Tracking", () => {
  // ── R-P1-03: UP section assertions ───────────────────────────────────

  it("Tests R-P1-03 — migration file exists", () => {
    const filePath = path.join(MIGRATIONS_DIR, MIGRATION_FILE);
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it("Tests R-P1-03 — has -- UP section", () => {
    const sql = readMigration();
    expect(sql).toContain("-- UP");
  });

  it("Tests R-P1-03 — UP section adds days_since_issued column", () => {
    const up = getUpSection(readMigration());
    expect(up).toMatch(/ADD\s+COLUMN\s+days_since_issued\b/i);
  });

  it("Tests R-P1-03 — UP section adds last_aging_snapshot_at column", () => {
    const up = getUpSection(readMigration());
    expect(up).toMatch(/ADD\s+COLUMN\s+last_aging_snapshot_at\b/i);
  });

  it("Tests R-P1-03 — UP section adds exactly 2 columns", () => {
    const up = getUpSection(readMigration());
    const matches = up.match(/ADD\s+COLUMN/gi) || [];
    expect(matches.length).toBe(2);
  });

  it("Tests R-P1-03 — UP section targets ar_invoices table", () => {
    const up = getUpSection(readMigration());
    expect(up).toMatch(/ALTER\s+TABLE\s+ar_invoices/i);
  });

  // ── R-P1-03 cont'd: DOWN section assertions ──────────────────────────

  it("Tests R-P1-03 — has -- DOWN section", () => {
    const sql = readMigration();
    expect(sql).toContain("-- DOWN");
  });

  it("Tests R-P1-03 — DOWN section drops exactly 2 columns", () => {
    const down = getDownSection(readMigration());
    const matches = down.match(/DROP\s+COLUMN/gi) || [];
    expect(matches.length).toBe(2);
  });

  it("Tests R-P1-03 — DOWN drops days_since_issued", () => {
    const down = getDownSection(readMigration());
    expect(down).toMatch(/DROP\s+COLUMN\s+days_since_issued\b/i);
  });

  it("Tests R-P1-03 — DOWN drops last_aging_snapshot_at", () => {
    const down = getDownSection(readMigration());
    expect(down).toMatch(/DROP\s+COLUMN\s+last_aging_snapshot_at\b/i);
  });

  it("Tests R-P1-03 — DOWN section contains NO other DROP COLUMN targets", () => {
    const down = getDownSection(readMigration());
    const allTargets: string[] = Array.from(
      down.matchAll(/DROP\s+COLUMN\s+(\w+)/gi),
      (m) => m[1],
    );
    const allowed = new Set(["days_since_issued", "last_aging_snapshot_at"]);
    const unexpected = allTargets.filter((t) => !allowed.has(t));
    expect(
      unexpected,
      `DOWN must only drop the 2 aging columns. Unexpected: ${unexpected.join(", ")}`,
    ).toEqual([]);
  });

  it("Tests R-P1-03 — DOWN does NOT DROP TABLE ar_invoices", () => {
    const down = getDownSection(readMigration());
    expect(down).not.toMatch(/DROP\s+TABLE\s+(IF\s+EXISTS\s+)?ar_invoices/i);
  });
});
