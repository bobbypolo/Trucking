/**
 * Tests R-P9-01: Migration 056 Digital Agreements
 *
 * Validates migration `056_digital_agreements.sql`:
 *  - UP section creates the `digital_agreements` table with all 9 columns
 *    (id, company_id, load_id, rate_con_data, status, signature_data,
 *     signed_at, created_at, updated_at)
 *  - `rate_con_data` and `signature_data` are JSON columns
 *  - `status` is an ENUM with DRAFT/SENT/SIGNED/VOIDED values defaulting to DRAFT
 *  - DOWN section drops the `digital_agreements` table
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const MIGRATIONS_DIR = path.resolve(__dirname, "../../migrations");
const MIGRATION_FILE = "056_digital_agreements.sql";

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

describe("Migration 056: Digital Agreements", () => {
  // ── R-P9-01: file exists and has UP/DOWN sections ──────────────────

  it("Tests R-P9-01 — migration file exists", () => {
    const filePath = path.join(MIGRATIONS_DIR, MIGRATION_FILE);
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it("Tests R-P9-01 — has -- UP section", () => {
    const sql = readMigration();
    expect(sql).toContain("-- UP");
  });

  it("Tests R-P9-01 — has -- DOWN section", () => {
    const sql = readMigration();
    expect(sql).toContain("-- DOWN");
  });

  // ── R-P9-01: UP creates digital_agreements table ───────────────────

  it("Tests R-P9-01 — UP section creates digital_agreements table", () => {
    const up = getUpSection(readMigration());
    expect(up).toMatch(
      /CREATE TABLE\s+(?:IF NOT EXISTS\s+)?digital_agreements/i,
    );
  });

  // ── R-P9-01: UP has all 9 columns ──────────────────────────────────

  it("Tests R-P9-01 — UP declares id column", () => {
    const up = getUpSection(readMigration());
    expect(up).toMatch(/\bid\s+VARCHAR\(36\)/i);
  });

  it("Tests R-P9-01 — UP declares company_id column", () => {
    const up = getUpSection(readMigration());
    expect(up).toMatch(/\bcompany_id\s+VARCHAR\(36\)/i);
  });

  it("Tests R-P9-01 — UP declares load_id column", () => {
    const up = getUpSection(readMigration());
    expect(up).toMatch(/\bload_id\s+VARCHAR\(36\)/i);
  });

  it("Tests R-P9-01 — UP declares rate_con_data as JSON", () => {
    const up = getUpSection(readMigration());
    expect(up).toMatch(/\brate_con_data\s+JSON\b/i);
  });

  it("Tests R-P9-01 — UP declares status as ENUM with 4 values defaulting to DRAFT", () => {
    const up = getUpSection(readMigration());
    // ENUM declaration
    expect(up).toMatch(/\bstatus\s+ENUM\s*\(/i);
    // Each expected value present
    expect(up).toMatch(/'DRAFT'/);
    expect(up).toMatch(/'SENT'/);
    expect(up).toMatch(/'SIGNED'/);
    expect(up).toMatch(/'VOIDED'/);
    // Default is DRAFT
    expect(up).toMatch(/DEFAULT\s+'DRAFT'/i);
  });

  it("Tests R-P9-01 — UP declares signature_data as JSON", () => {
    const up = getUpSection(readMigration());
    expect(up).toMatch(/\bsignature_data\s+JSON\b/i);
  });

  it("Tests R-P9-01 — UP declares signed_at as DATETIME", () => {
    const up = getUpSection(readMigration());
    expect(up).toMatch(/\bsigned_at\s+DATETIME\b/i);
  });

  it("Tests R-P9-01 — UP declares created_at as DATETIME", () => {
    const up = getUpSection(readMigration());
    expect(up).toMatch(/\bcreated_at\s+DATETIME\b/i);
  });

  it("Tests R-P9-01 — UP declares updated_at as DATETIME", () => {
    const up = getUpSection(readMigration());
    expect(up).toMatch(/\bupdated_at\s+DATETIME\b/i);
  });

  it("Tests R-P9-01 — UP contains all 9 required column names", () => {
    const up = getUpSection(readMigration());
    const columns = [
      "id",
      "company_id",
      "load_id",
      "rate_con_data",
      "status",
      "signature_data",
      "signed_at",
      "created_at",
      "updated_at",
    ];
    for (const col of columns) {
      const re = new RegExp(`\\b${col}\\b`, "i");
      expect(up, `Expected column ${col} in UP section`).toMatch(re);
    }
    expect(columns.length).toBe(9);
  });

  // ── R-P9-01: DOWN safely drops the table ───────────────────────────

  it("Tests R-P9-01 — DOWN section drops digital_agreements table", () => {
    const down = getDownSection(readMigration());
    expect(down).toMatch(/DROP\s+TABLE\s+(?:IF EXISTS\s+)?digital_agreements/i);
  });

  it("Tests R-P9-01 — DOWN does not drop other tables", () => {
    const down = getDownSection(readMigration());
    const dropTableMatches = Array.from(
      down.matchAll(/DROP\s+TABLE\s+(?:IF EXISTS\s+)?(\w+)/gi),
      (m) => m[1],
    );
    expect(dropTableMatches).toEqual(["digital_agreements"]);
  });
});
