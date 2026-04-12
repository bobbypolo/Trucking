/**
 * Tests R-P4-06: Migration 057 Stop Status Tracking
 *
 * Validates migration `057_stop_status_tracking.sql`:
 *  - UP adds status ENUM DEFAULT 'pending', arrived_at, departed_at to load_legs
 *  - DOWN drops those columns
 *  - Test reads SQL file via `fs.readFileSync`
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const MIGRATIONS_DIR = path.resolve(__dirname, "../../migrations");
const MIGRATION_FILE = "057_stop_status_tracking.sql";

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

describe("Migration 057: Stop Status Tracking", () => {
  // Tests R-P4-06
  it("Tests R-P4-06 -- migration file exists and is readable", () => {
    const filePath = path.join(MIGRATIONS_DIR, MIGRATION_FILE);
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content.length).toBeGreaterThan(0);
  });

  it("Tests R-P4-06 -- has UP and DOWN sections", () => {
    const sql = readMigration();
    expect(sql).toContain("-- UP");
    expect(sql).toContain("-- DOWN");
  });

  it("Tests R-P4-06 -- UP section alters load_legs table", () => {
    const up = getUpSection(readMigration());
    expect(up).toMatch(/ALTER\s+TABLE\s+load_legs/i);
  });

  it("Tests R-P4-06 -- UP adds status column with ENUM and DEFAULT pending", () => {
    const up = getUpSection(readMigration());
    expect(up).toMatch(/ADD\s+COLUMN\s+status\s+ENUM\s*\(/i);
    expect(up).toContain("'pending'");
    expect(up).toContain("'arrived'");
    expect(up).toContain("'departed'");
    expect(up).toContain("'completed'");
    expect(up).toMatch(/DEFAULT\s+'pending'/i);
  });

  it("Tests R-P4-06 -- UP adds arrived_at DATETIME NULL column", () => {
    const up = getUpSection(readMigration());
    expect(up).toMatch(/ADD\s+COLUMN\s+arrived_at\s+DATETIME\s+NULL/i);
  });

  it("Tests R-P4-06 -- UP adds departed_at DATETIME NULL column", () => {
    const up = getUpSection(readMigration());
    expect(up).toMatch(/ADD\s+COLUMN\s+departed_at\s+DATETIME\s+NULL/i);
  });

  it("Tests R-P4-06 -- DOWN drops status, arrived_at, departed_at columns", () => {
    const down = getDownSection(readMigration());
    expect(down).toMatch(/DROP\s+COLUMN\s+status/i);
    expect(down).toMatch(/DROP\s+COLUMN\s+arrived_at/i);
    expect(down).toMatch(/DROP\s+COLUMN\s+departed_at/i);
  });

  it("Tests R-P4-06 -- UP adds exactly 3 columns", () => {
    const up = getUpSection(readMigration());
    const addColumnMatches = up.match(/ADD\s+COLUMN\s+\w+/gi) || [];
    expect(addColumnMatches.length).toBe(3);
  });

  it("Tests R-P4-06 -- DOWN drops exactly 3 columns", () => {
    const down = getDownSection(readMigration());
    const dropColumnMatches = down.match(/DROP\s+COLUMN\s+\w+/gi) || [];
    expect(dropColumnMatches.length).toBe(3);
  });
});
