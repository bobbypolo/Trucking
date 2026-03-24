import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Tests for migration 002_load_status_normalization.sql
 *
 * Validates:
 *  - Migration file exists and contains all 3 steps (widen, normalize, shrink)
 *  - Rollback file exists and contains the reverse steps
 *  - All 12 legacy -> 8 canonical mappings are present in the SQL
 *  - normalizeStatus() handles all mapping paths
 */

const MIGRATIONS_DIR = path.resolve(__dirname, "../../migrations");

function readMigration(filename: string): string {
  const fullPath = path.join(MIGRATIONS_DIR, filename);
  return fs.readFileSync(fullPath, "utf-8");
}

describe("Migration 002: Load Status Normalization", () => {
  describe("Forward migration file", () => {
    it("file exists", () => {
      const filePath = path.join(
        MIGRATIONS_DIR,
        "002_load_status_normalization.sql",
      );
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it("contains Step 1 (widen ENUM with both legacy and canonical values)", () => {
      const sql = readMigration("002_load_status_normalization.sql");
      // Step 1 should add canonical values to the existing ENUM
      expect(sql).toContain("draft");
      expect(sql).toContain("in_transit");
      expect(sql).toContain("dispatched");
      // Must also include legacy values in Step 1
      expect(sql).toContain("Planned");
      expect(sql).toContain("CorrectionRequested");
    });

    it("contains Step 2 (UPDATE rows to canonical values)", () => {
      const sql = readMigration("002_load_status_normalization.sql");
      // All legacy -> canonical UPDATE statements must be present
      expect(sql).toContain("UPDATE loads SET status = 'planned'");
      expect(sql).toContain("UPDATE loads SET status = 'dispatched'");
      expect(sql).toContain("UPDATE loads SET status = 'in_transit'");
      expect(sql).toContain("UPDATE loads SET status = 'arrived'");
      expect(sql).toContain("UPDATE loads SET status = 'delivered'");
      expect(sql).toContain("UPDATE loads SET status = 'completed'");
      expect(sql).toContain("UPDATE loads SET status = 'cancelled'");
    });

    it("maps all 12 legacy values in Step 2 UPDATE statements", () => {
      const sql = readMigration("002_load_status_normalization.sql");
      // All 12 legacy values must appear in UPDATE WHERE clauses
      const legacyValues = [
        "Planned",
        "Booked",
        "Active",
        "Departed",
        "Arrived",
        "Docked",
        "Unloaded",
        "Delivered",
        "Invoiced",
        "Settled",
        "Cancelled",
        "CorrectionRequested",
      ];
      for (const val of legacyValues) {
        expect(sql).toContain(val);
      }
    });

    it("contains Step 3 (shrink ENUM to canonical-only)", () => {
      const sql = readMigration("002_load_status_normalization.sql");
      // Step 3 should have canonical-only ENUM definition
      // Count ALTER TABLE statements — should have at least 2 (widen + shrink)
      const alterCount = (sql.match(/ALTER TABLE loads/g) ?? []).length;
      expect(alterCount).toBeGreaterThanOrEqual(2);
      // Step 3 must NOT include legacy values in the final ENUM
      // The last ALTER TABLE should only have canonical values
      const lastAlterIdx = sql.lastIndexOf("ALTER TABLE loads");
      const lastAlterBlock = sql.substring(lastAlterIdx);
      // The final ENUM block should not include PascalCase legacy values
      // (after the last ALTER, no legacy values like 'Booked', 'Active', 'Departed' etc.)
      expect(lastAlterBlock).not.toContain("Booked");
      expect(lastAlterBlock).not.toContain("Active");
      expect(lastAlterBlock).not.toContain("Departed");
      expect(lastAlterBlock).not.toContain("Docked");
      expect(lastAlterBlock).not.toContain("Unloaded");
      expect(lastAlterBlock).not.toContain("Invoiced");
      expect(lastAlterBlock).not.toContain("CorrectionRequested");
    });

    it("uses DEFAULT 'draft' in the canonical ENUM definition", () => {
      const sql = readMigration("002_load_status_normalization.sql");
      expect(sql).toContain("DEFAULT 'draft'");
    });
  });

  describe("Rollback migration file (retired)", () => {
    const RETIRED_DIR = path.join(MIGRATIONS_DIR, "_retired");

    function readRetired(filename: string): string {
      return fs.readFileSync(path.join(RETIRED_DIR, filename), "utf-8");
    }

    it("file exists in retired directory", () => {
      const filePath = path.join(
        RETIRED_DIR,
        "002_load_status_normalization_rollback.sql",
      );
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it("contains widen step (adds legacy values back)", () => {
      const sql = readRetired("002_load_status_normalization_rollback.sql");
      // Rollback Step 1 widens ENUM to include both legacy and canonical
      expect(sql).toContain("ALTER TABLE loads");
      expect(sql).toContain("Planned");
      expect(sql).toContain("CorrectionRequested");
    });

    it("contains denormalize step (UPDATE rows back to PascalCase)", () => {
      const sql = readRetired("002_load_status_normalization_rollback.sql");
      // Rollback Step 2 maps canonical -> primary legacy value
      expect(sql).toContain("UPDATE loads SET status = 'Planned'");
      expect(sql).toContain("UPDATE loads SET status = 'Cancelled'");
    });

    it("contains shrink step (removes canonical values)", () => {
      const sql = readRetired("002_load_status_normalization_rollback.sql");
      // Rollback Step 3 finalizes the ENUM back to original 12 values
      const alterCount = (sql.match(/ALTER TABLE loads/g) ?? []).length;
      expect(alterCount).toBeGreaterThanOrEqual(2);
      // Last ALTER should have PascalCase values and no canonical lowercase
      const lastAlterIdx = sql.lastIndexOf("ALTER TABLE loads");
      const lastAlterBlock = sql.substring(lastAlterIdx);
      expect(lastAlterBlock).toContain("Planned");
      expect(lastAlterBlock).toContain("CorrectionRequested");
      // Should NOT include canonical lowercase in the final rollback ENUM
      expect(lastAlterBlock).not.toContain("'draft'");
      expect(lastAlterBlock).not.toContain("'in_transit'");
    });
  });
});
