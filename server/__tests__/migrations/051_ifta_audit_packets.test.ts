/**
 * Tests R-P1-01, R-P1-02: Migration 051 IFTA Audit Packets
 *
 * Validates migration `051_ifta_audit_packets.sql`:
 *  - UP creates exactly 1 table named `ifta_audit_packets` with at least 9 named columns
 *  - DOWN drops only `ifta_audit_packets` and does not drop any pre-existing table
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const MIGRATIONS_DIR = path.resolve(__dirname, "../../migrations");
const MIGRATION_FILE = "051_ifta_audit_packets.sql";

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

describe("Migration 051: IFTA Audit Packets", () => {
  // ── R-P1-01: UP section assertions ───────────────────────────────────

  it("Tests R-P1-01 — migration file exists", () => {
    const filePath = path.join(MIGRATIONS_DIR, MIGRATION_FILE);
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it("Tests R-P1-01 — has -- UP section", () => {
    const sql = readMigration();
    expect(sql).toContain("-- UP");
  });

  it("Tests R-P1-01 — UP section creates exactly 1 table", () => {
    const up = getUpSection(readMigration());
    const matches = up.match(/CREATE\s+TABLE/gi) || [];
    expect(matches.length).toBe(1);
  });

  it("Tests R-P1-01 — UP section creates table named ifta_audit_packets", () => {
    const up = getUpSection(readMigration());
    expect(up).toMatch(/CREATE\s+TABLE\s+ifta_audit_packets/i);
  });

  it("Tests R-P1-01 — UP section contains all 9 required columns", () => {
    const up = getUpSection(readMigration());
    const required = [
      "id",
      "company_id",
      "quarter",
      "tax_year",
      "status",
      "packet_hash",
      "download_url",
      "created_by",
      "created_at",
    ];
    for (const col of required) {
      // Each column name must appear at the start of a line (after whitespace)
      // followed by a type — this avoids matching partial substrings.
      const colRegex = new RegExp(`(^|\\s)${col}\\s+\\w`, "m");
      expect(up, `column "${col}" must be defined in UP section`).toMatch(
        colRegex,
      );
    }
  });

  it("Tests R-P1-01 — UP section defines packet_hash as a 64-char column", () => {
    const up = getUpSection(readMigration());
    // CHAR(64) or VARCHAR(64) — matches the SHA-256 hex digest length.
    expect(up).toMatch(/packet_hash\s+(CHAR|VARCHAR)\s*\(\s*64\s*\)/i);
  });

  // ── R-P1-02: DOWN section assertions ─────────────────────────────────

  it("Tests R-P1-02 — has -- DOWN section", () => {
    const sql = readMigration();
    expect(sql).toContain("-- DOWN");
  });

  it("Tests R-P1-02 — DOWN section drops exactly 1 table", () => {
    const down = getDownSection(readMigration());
    const matches = down.match(/DROP\s+TABLE/gi) || [];
    expect(matches.length).toBe(1);
  });

  it("Tests R-P1-02 — DOWN drops the ifta_audit_packets table", () => {
    const down = getDownSection(readMigration());
    expect(down).toMatch(/DROP\s+TABLE\s+(IF\s+EXISTS\s+)?ifta_audit_packets/i);
  });

  it("Tests R-P1-02 — DOWN section contains NO other DROP TABLE targets", () => {
    const down = getDownSection(readMigration());
    const allTargets: string[] = Array.from(
      down.matchAll(/DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?(\w+)/gi),
      (m) => m[1],
    );
    const allowed = new Set(["ifta_audit_packets"]);
    const unexpected = allTargets.filter((t) => !allowed.has(t));
    expect(
      unexpected,
      `DOWN must only drop ifta_audit_packets. Unexpected: ${unexpected.join(", ")}`,
    ).toEqual([]);
  });

  it("Tests R-P1-02 — DOWN does NOT contain DROP COLUMN", () => {
    const down = getDownSection(readMigration());
    expect(down).not.toMatch(/DROP\s+COLUMN/i);
  });
});
