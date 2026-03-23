/**
 * Tests R-P1-06, R-P1-07: QuickBooks OAuth Token Storage Migration
 *
 * Validates migration 029_quickbooks_tokens.sql:
 *  - Creates quickbooks_tokens table with correct schema
 *  - UNIQUE constraint on company_id
 *  - DOWN migration drops table cleanly
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const MIGRATIONS_DIR = path.resolve(__dirname, "../../migrations");

function readMigration(): string {
  return fs.readFileSync(
    path.join(MIGRATIONS_DIR, "029_quickbooks_tokens.sql"),
    "utf-8",
  );
}

describe("Migration 029: QuickBooks Tokens", () => {
  // ── R-P1-06: Table creation with UNIQUE constraint on company_id ────────

  it("Tests R-P1-06 — migration file exists", () => {
    const filePath = path.join(MIGRATIONS_DIR, "029_quickbooks_tokens.sql");
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it("Tests R-P1-06 — has -- UP section", () => {
    const sql = readMigration();
    expect(sql).toContain("-- UP");
  });

  it("Tests R-P1-06 — creates quickbooks_tokens table", () => {
    const sql = readMigration();
    expect(sql).toMatch(/CREATE TABLE\s+(IF NOT EXISTS\s+)?quickbooks_tokens/i);
  });

  it("Tests R-P1-06 — has id VARCHAR(36) PRIMARY KEY", () => {
    const sql = readMigration();
    expect(sql).toContain("id VARCHAR(36)");
    expect(sql.toUpperCase()).toContain("PRIMARY KEY");
  });

  it("Tests R-P1-06 — has company_id VARCHAR(36) NOT NULL", () => {
    const sql = readMigration();
    expect(sql).toMatch(/company_id\s+VARCHAR\(36\)\s+NOT NULL/i);
  });

  it("Tests R-P1-06 — has UNIQUE constraint on company_id", () => {
    const sql = readMigration().toUpperCase();
    // Accept either UNIQUE KEY/INDEX or inline UNIQUE on company_id
    const hasUniqueConstraint =
      sql.includes("UNIQUE") && sql.includes("COMPANY_ID");
    expect(
      hasUniqueConstraint,
      "Must have UNIQUE constraint on company_id",
    ).toBe(true);
  });

  it("Tests R-P1-06 — has realm_id VARCHAR(50)", () => {
    const sql = readMigration();
    expect(sql).toMatch(/realm_id\s+VARCHAR\(50\)/i);
  });

  it("Tests R-P1-06 — has access_token TEXT NOT NULL", () => {
    const sql = readMigration();
    expect(sql).toMatch(/access_token\s+TEXT\s+NOT NULL/i);
  });

  it("Tests R-P1-06 — has refresh_token TEXT NOT NULL", () => {
    const sql = readMigration();
    expect(sql).toMatch(/refresh_token\s+TEXT\s+NOT NULL/i);
  });

  it("Tests R-P1-06 — has token_type VARCHAR(20) with default 'bearer'", () => {
    const sql = readMigration();
    expect(sql).toMatch(/token_type\s+VARCHAR\(20\)/i);
    expect(sql.toLowerCase()).toContain("default 'bearer'");
  });

  it("Tests R-P1-06 — has expires_at DATETIME NOT NULL", () => {
    const sql = readMigration();
    expect(sql).toMatch(/expires_at\s+DATETIME\s+NOT NULL/i);
  });

  it("Tests R-P1-06 — has created_at TIMESTAMP", () => {
    const sql = readMigration();
    expect(sql).toMatch(/created_at\s+TIMESTAMP/i);
  });

  it("Tests R-P1-06 — has updated_at TIMESTAMP with ON UPDATE", () => {
    const sql = readMigration();
    expect(sql).toMatch(/updated_at\s+TIMESTAMP/i);
    expect(sql).toMatch(/ON UPDATE CURRENT_TIMESTAMP/i);
  });

  // ── R-P1-07: DOWN migration drops table cleanly ─────────────────────────

  it("Tests R-P1-07 — has -- DOWN section", () => {
    const sql = readMigration();
    expect(sql).toContain("-- DOWN");
  });

  it("Tests R-P1-07 — DOWN section drops quickbooks_tokens table", () => {
    const sql = readMigration();
    const downIdx = sql.indexOf("-- DOWN");
    expect(downIdx).toBeGreaterThan(-1);
    const downSection = sql.substring(downIdx);
    expect(downSection).toMatch(/DROP TABLE\s+(IF EXISTS\s+)?quickbooks_tokens/i);
  });

  it("Tests R-P1-07 — DOWN section does not drop other tables", () => {
    const sql = readMigration();
    const downIdx = sql.indexOf("-- DOWN");
    const downSection = sql.substring(downIdx);
    // Count DROP TABLE statements - should be exactly 1
    const dropMatches = downSection.match(/DROP TABLE/gi) || [];
    expect(dropMatches.length).toBe(1);
  });
});
