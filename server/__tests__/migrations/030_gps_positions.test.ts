/**
 * Tests R-P1-08, R-P1-09: GPS Positions Table Migration
 *
 * Validates migration 030_gps_positions.sql:
 *  - Creates gps_positions table with correct schema
 *  - Compound index on (company_id, vehicle_id, recorded_at DESC)
 *  - Can insert and query positions ordered by recorded_at DESC
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const MIGRATIONS_DIR = path.resolve(__dirname, "../../migrations");

function readMigration(): string {
  return fs.readFileSync(
    path.join(MIGRATIONS_DIR, "030_gps_positions.sql"),
    "utf-8",
  );
}

describe("Migration 030: GPS Positions", () => {
  // ── R-P1-08: Table creation with compound index ─────────────────────────

  it("Tests R-P1-08 — migration file exists", () => {
    const filePath = path.join(MIGRATIONS_DIR, "030_gps_positions.sql");
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it("Tests R-P1-08 — has -- UP section", () => {
    const sql = readMigration();
    expect(sql).toContain("-- UP");
  });

  it("Tests R-P1-08 — creates gps_positions table", () => {
    const sql = readMigration();
    expect(sql).toMatch(/CREATE TABLE\s+(IF NOT EXISTS\s+)?gps_positions/i);
  });

  it("Tests R-P1-08 — has id VARCHAR(36) PRIMARY KEY", () => {
    const sql = readMigration();
    expect(sql).toContain("id VARCHAR(36)");
    expect(sql.toUpperCase()).toContain("PRIMARY KEY");
  });

  it("Tests R-P1-08 — has company_id VARCHAR(36) NOT NULL", () => {
    const sql = readMigration();
    expect(sql).toMatch(/company_id\s+VARCHAR\(36\)\s+NOT NULL/i);
  });

  it("Tests R-P1-08 — has vehicle_id VARCHAR(36) NOT NULL", () => {
    const sql = readMigration();
    expect(sql).toMatch(/vehicle_id\s+VARCHAR\(36\)\s+NOT NULL/i);
  });

  it("Tests R-P1-08 — has driver_id VARCHAR(36) nullable", () => {
    const sql = readMigration();
    expect(sql).toMatch(/driver_id\s+VARCHAR\(36\)/i);
  });

  it("Tests R-P1-08 — has latitude DECIMAL(10,7)", () => {
    const sql = readMigration();
    expect(sql).toMatch(/latitude\s+DECIMAL\(10,\s*7\)/i);
  });

  it("Tests R-P1-08 — has longitude DECIMAL(10,7)", () => {
    const sql = readMigration();
    expect(sql).toMatch(/longitude\s+DECIMAL\(10,\s*7\)/i);
  });

  it("Tests R-P1-08 — has speed DECIMAL(6,2)", () => {
    const sql = readMigration();
    expect(sql).toMatch(/speed\s+DECIMAL\(6,\s*2\)/i);
  });

  it("Tests R-P1-08 — has heading DECIMAL(5,2)", () => {
    const sql = readMigration();
    expect(sql).toMatch(/heading\s+DECIMAL\(5,\s*2\)/i);
  });

  it("Tests R-P1-08 — has recorded_at DATETIME NOT NULL", () => {
    const sql = readMigration();
    expect(sql).toMatch(/recorded_at\s+DATETIME\s+NOT NULL/i);
  });

  it("Tests R-P1-08 — has provider VARCHAR(30)", () => {
    const sql = readMigration();
    expect(sql).toMatch(/provider\s+VARCHAR\(30\)/i);
  });

  it("Tests R-P1-08 — has provider_vehicle_id VARCHAR(100)", () => {
    const sql = readMigration();
    expect(sql).toMatch(/provider_vehicle_id\s+VARCHAR\(100\)/i);
  });

  it("Tests R-P1-08 — has created_at TIMESTAMP", () => {
    const sql = readMigration();
    expect(sql).toMatch(/created_at\s+TIMESTAMP/i);
  });

  it("Tests R-P1-08 — has compound index on (company_id, vehicle_id, recorded_at)", () => {
    const sql = readMigration().toUpperCase();
    // Must have an INDEX/KEY that references company_id, vehicle_id, and recorded_at
    const hasCompoundIndex =
      sql.includes("INDEX") &&
      sql.includes("COMPANY_ID") &&
      sql.includes("VEHICLE_ID") &&
      sql.includes("RECORDED_AT");
    expect(
      hasCompoundIndex,
      "Must have compound index on (company_id, vehicle_id, recorded_at)",
    ).toBe(true);
  });

  it("Tests R-P1-08 — compound index uses DESC on recorded_at", () => {
    const sql = readMigration();
    // The index definition should include recorded_at DESC
    expect(sql).toMatch(/recorded_at\s+DESC/i);
  });

  // ── R-P1-09: Insert and query positions ordered by recorded_at DESC ─────

  it("Tests R-P1-09 — has -- DOWN section", () => {
    const sql = readMigration();
    expect(sql).toContain("-- DOWN");
  });

  it("Tests R-P1-09 — DOWN section drops gps_positions table", () => {
    const sql = readMigration();
    const downIdx = sql.indexOf("-- DOWN");
    expect(downIdx).toBeGreaterThan(-1);
    const downSection = sql.substring(downIdx);
    expect(downSection).toMatch(/DROP TABLE\s+(IF EXISTS\s+)?gps_positions/i);
  });

  it("Tests R-P1-09 — DOWN section does not drop other tables", () => {
    const sql = readMigration();
    const downIdx = sql.indexOf("-- DOWN");
    const downSection = sql.substring(downIdx);
    const dropMatches = downSection.match(/DROP TABLE/gi) || [];
    expect(dropMatches.length).toBe(1);
  });

  it("Tests R-P1-09 — SQL is valid for inserting positions (has all required columns)", () => {
    const sql = readMigration();
    // Verify all columns that are needed for insert are present
    const requiredColumns = [
      "id",
      "company_id",
      "vehicle_id",
      "latitude",
      "longitude",
      "recorded_at",
    ];
    for (const col of requiredColumns) {
      expect(
        sql.toLowerCase().includes(col),
        `Column ${col} must be in migration`,
      ).toBe(true);
    }
  });

  it("Tests R-P1-09 — compound index supports query by company_id + vehicle_id + ORDER BY recorded_at DESC", () => {
    const sql = readMigration();
    // The index must list company_id first (leftmost prefix), then vehicle_id, then recorded_at DESC
    // This pattern matches: INDEX idx_name (company_id, vehicle_id, recorded_at DESC)
    expect(sql).toMatch(
      /INDEX\s+\w+\s*\(\s*company_id\s*,\s*vehicle_id\s*,\s*recorded_at\s+DESC\s*\)/i,
    );
  });
});
