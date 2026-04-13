/**
 * Tests R-P2-06: Migration 056 message threading + read state
 *
 * Validates migration `056_message_threading.sql`:
 *  - UP adds read_at DATETIME NULL to messages
 *  - UP adds participant_ids JSON to threads
 *  - UP adds load_id VARCHAR(36) to threads
 *  - DOWN reverses all changes
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const MIGRATIONS_DIR = path.resolve(__dirname, "../../migrations");
const MIGRATION_FILE = "056_message_threading.sql";

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

describe("Migration 056: message_threading", () => {
  /* Tests R-P2-06 — file structure */
  it("Tests R-P2-06 — migration file exists and is readable", () => {
    const filePath = path.join(MIGRATIONS_DIR, MIGRATION_FILE);
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content.length).toBeGreaterThan(0);
  });

  it("Tests R-P2-06 — has UP section", () => {
    const sql = readMigration();
    expect(sql).toContain("-- UP");
  });

  it("Tests R-P2-06 — has DOWN section", () => {
    const sql = readMigration();
    expect(sql).toContain("-- DOWN");
  });

  /* Tests R-P2-06 — UP: adds read_at DATETIME NULL to messages */
  it("Tests R-P2-06 — UP adds read_at DATETIME NULL to messages table", () => {
    const up = getUpSection(readMigration());
    expect(up).toMatch(
      /ALTER\s+TABLE\s+messages\s+ADD\s+COLUMN\s+read_at\s+DATETIME\s+NULL/i,
    );
  });

  /* Tests R-P2-06 — UP: adds participant_ids JSON to threads */
  it("Tests R-P2-06 — UP adds participant_ids JSON to threads table", () => {
    const up = getUpSection(readMigration());
    expect(up).toMatch(
      /ALTER\s+TABLE\s+threads\s+ADD\s+COLUMN\s+participant_ids\s+JSON/i,
    );
  });

  /* Tests R-P2-06 — UP: adds load_id to threads */
  it("Tests R-P2-06 — UP adds load_id VARCHAR(36) to threads table", () => {
    const up = getUpSection(readMigration());
    expect(up).toMatch(
      /ALTER\s+TABLE\s+threads\s+ADD\s+COLUMN\s+load_id\s+VARCHAR\(36\)/i,
    );
  });

  /* Tests R-P2-06 — UP: adds index on threads (company_id, load_id) */
  it("Tests R-P2-06 — UP adds index idx_threads_load on (company_id, load_id)", () => {
    const up = getUpSection(readMigration());
    expect(up).toMatch(
      /ADD\s+INDEX\s+idx_threads_load\s*\(\s*company_id\s*,\s*load_id\s*\)/i,
    );
  });

  /* Tests R-P2-06 — DOWN: reverses read_at */
  it("Tests R-P2-06 — DOWN drops read_at from messages", () => {
    const down = getDownSection(readMigration());
    expect(down).toMatch(/ALTER\s+TABLE\s+messages\s+DROP\s+COLUMN\s+read_at/i);
  });

  /* Tests R-P2-06 — DOWN: reverses participant_ids */
  it("Tests R-P2-06 — DOWN drops participant_ids from threads", () => {
    const down = getDownSection(readMigration());
    expect(down).toMatch(
      /ALTER\s+TABLE\s+threads\s+DROP\s+COLUMN\s+participant_ids/i,
    );
  });

  /* Tests R-P2-06 — DOWN: reverses load_id */
  it("Tests R-P2-06 — DOWN drops load_id from threads", () => {
    const down = getDownSection(readMigration());
    expect(down).toMatch(/ALTER\s+TABLE\s+threads\s+DROP\s+COLUMN\s+load_id/i);
  });

  /* Tests R-P2-06 — DOWN: drops the index */
  it("Tests R-P2-06 — DOWN drops idx_threads_load index", () => {
    const down = getDownSection(readMigration());
    expect(down).toMatch(/DROP\s+INDEX\s+idx_threads_load/i);
  });

  /* Tests R-P2-06 — exactly 3 ALTER TABLE ADD COLUMN in UP */
  it("Tests R-P2-06 — UP contains exactly 3 ALTER TABLE ADD COLUMN statements", () => {
    const up = getUpSection(readMigration());
    const matches = up.match(/ALTER\s+TABLE\s+\w+\s+ADD\s+COLUMN/gi) || [];
    expect(matches.length).toBe(3);
  });

  /* Tests R-P2-06 — exactly 3 ALTER TABLE DROP COLUMN in DOWN */
  it("Tests R-P2-06 — DOWN contains exactly 3 ALTER TABLE DROP COLUMN statements", () => {
    const down = getDownSection(readMigration());
    const matches = down.match(/ALTER\s+TABLE\s+\w+\s+DROP\s+COLUMN/gi) || [];
    expect(matches.length).toBe(3);
  });
});
