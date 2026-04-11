/**
 * Tests R-P3-01, R-P3-02, R-P3-03: Migration 055 push_tokens
 *
 * Validates migration `055_push_tokens.sql`:
 *  - UP creates `push_tokens` table with required columns and a
 *    UNIQUE KEY on `(user_id, expo_push_token)`
 *  - UP declares `platform` as `ENUM('ios','android') NOT NULL`
 *  - DOWN drops only the `push_tokens` table
 *  - Test reads SQL file via `fs.readFileSync`
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const MIGRATIONS_DIR = path.resolve(__dirname, "../../migrations");
const MIGRATION_FILE = "055_push_tokens.sql";

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

describe("Migration 055: push_tokens", () => {
  it("Tests R-P3-01 — migration file exists and is readable via fs.readFileSync", () => {
    const filePath = path.join(MIGRATIONS_DIR, MIGRATION_FILE);
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content.length).toBeGreaterThan(0);
  });

  it("Tests R-P3-01 — has -- UP section", () => {
    const sql = readMigration();
    expect(sql).toContain("-- UP");
  });

  it("Tests R-P3-01 — has -- DOWN section", () => {
    const sql = readMigration();
    expect(sql).toContain("-- DOWN");
  });

  // ── R-P3-01: CREATE TABLE IF NOT EXISTS push_tokens + UNIQUE KEY (user_id, expo_push_token) ──

  it("Tests R-P3-01 — UP section contains exactly one `CREATE TABLE IF NOT EXISTS push_tokens` statement", () => {
    const up = getUpSection(readMigration());
    const matches =
      up.match(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+push_tokens/gi) || [];
    expect(matches.length).toBe(1);
  });

  it("Tests R-P3-01 — UP section contains a UNIQUE KEY clause referencing (user_id, expo_push_token)", () => {
    const up = getUpSection(readMigration());
    const matches =
      up.match(
        /UNIQUE\s+KEY\s+\w+\s*\(\s*user_id\s*,\s*expo_push_token\s*\)/i,
      ) || [];
    expect(matches.length).toBe(1);
  });

  // ── R-P3-02: DOWN drops push_tokens exactly once ──

  it("Tests R-P3-02 — DOWN section contains exactly one `DROP TABLE IF EXISTS push_tokens` statement", () => {
    const down = getDownSection(readMigration());
    const matches =
      down.match(/DROP\s+TABLE\s+IF\s+EXISTS\s+push_tokens/gi) || [];
    expect(matches.length).toBe(1);
  });

  it("Tests R-P3-02 — DOWN section contains zero other DROP TABLE occurrences (total DROP TABLE count is exactly 1)", () => {
    const down = getDownSection(readMigration());
    const matches = down.match(/DROP\s+TABLE/gi) || [];
    expect(matches.length).toBe(1);
  });

  // ── R-P3-03: platform column is ENUM('ios','android') NOT NULL ──

  it("Tests R-P3-03 — UP section declares `platform` as ENUM('ios','android') NOT NULL", () => {
    const up = getUpSection(readMigration());
    expect(up).toMatch(
      /platform\s+ENUM\s*\(\s*'ios'\s*,\s*'android'\s*\)\s+NOT\s+NULL/i,
    );
  });

  // ── Defensive structural assertions for required columns ──

  it("Tests R-P3-01 — UP section contains column: id (VARCHAR(36) PRIMARY KEY)", () => {
    const up = getUpSection(readMigration());
    expect(up).toMatch(/id\s+VARCHAR\(36\)\s+PRIMARY\s+KEY/i);
  });

  it("Tests R-P3-01 — UP section contains column: user_id (VARCHAR(36) NOT NULL)", () => {
    const up = getUpSection(readMigration());
    expect(up).toMatch(/user_id\s+VARCHAR\(36\)\s+NOT\s+NULL/i);
  });

  it("Tests R-P3-01 — UP section contains column: expo_push_token (VARCHAR(255) NOT NULL)", () => {
    const up = getUpSection(readMigration());
    expect(up).toMatch(/expo_push_token\s+VARCHAR\(255\)\s+NOT\s+NULL/i);
  });

  it("Tests R-P3-01 — UP section contains column: enabled (TINYINT(1) NOT NULL DEFAULT 1)", () => {
    const up = getUpSection(readMigration());
    expect(up).toMatch(/enabled\s+TINYINT\(1\)\s+NOT\s+NULL\s+DEFAULT\s+1/i);
  });

  it("Tests R-P3-01 — UP section contains column: created_at (TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)", () => {
    const up = getUpSection(readMigration());
    expect(up).toMatch(
      /created_at\s+TIMESTAMP\s+NOT\s+NULL\s+DEFAULT\s+CURRENT_TIMESTAMP/i,
    );
  });

  it("Tests R-P3-01 — UP section contains column: updated_at with ON UPDATE CURRENT_TIMESTAMP", () => {
    const up = getUpSection(readMigration());
    expect(up).toMatch(
      /updated_at\s+TIMESTAMP\s+NOT\s+NULL\s+DEFAULT\s+CURRENT_TIMESTAMP\s+ON\s+UPDATE\s+CURRENT_TIMESTAMP/i,
    );
  });
});
