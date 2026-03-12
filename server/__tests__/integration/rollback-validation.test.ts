/**
 * Rollback Validation Integration Test — Phase 5 (R-P5-04)
 *
 * Proves that MigrationRunner.down() can roll back the latest applied migration
 * and MigrationRunner.up() can re-apply it — a complete round-trip proof using
 * a mock MigrationDb (no real MySQL required).
 *
 * Data flow:
 *   mockDb (in-memory state) → runner.up() → runner.down() → runner.up()
 *   → runner.status() → no checksum mismatches, correct applied list
 *
 * Tests R-P5-04
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import path from "path";
import { fileURLToPath } from "url";
import {
  MigrationRunner,
  MigrationDb,
  AppliedMigrationRow,
} from "../../lib/migrator";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(__dirname, "../..");
const migrationsDir = path.resolve(serverRoot, "migrations");

// ---------------------------------------------------------------------------
// Mock MigrationDb — in-memory state machine
// ---------------------------------------------------------------------------

function createMockDb(): MigrationDb & { _rows: AppliedMigrationRow[] } {
  const rows: AppliedMigrationRow[] = [];
  let idCounter = 1;

  const db = {
    _rows: rows,

    async execute(
      sql: string,
      params?: unknown[],
    ): Promise<[unknown[], unknown]> {
      const normalized = sql.replace(/\s+/g, " ").trim();

      // CREATE TABLE IF NOT EXISTS _migrations → no-op
      if (normalized.startsWith("CREATE TABLE IF NOT EXISTS _migrations")) {
        return [[], {}];
      }

      // INSERT INTO _migrations
      if (normalized.startsWith("INSERT INTO _migrations")) {
        const [filename, checksum, execution_time_ms] = params as [
          string,
          string,
          number,
        ];
        rows.push({
          id: idCounter++,
          filename,
          checksum,
          applied_at: new Date(),
          execution_time_ms,
        });
        return [[], {}];
      }

      // DELETE FROM _migrations WHERE filename = ?
      if (normalized.startsWith("DELETE FROM _migrations WHERE filename")) {
        const [filename] = params as [string];
        const idx = rows.findIndex((r) => r.filename === filename);
        if (idx !== -1) rows.splice(idx, 1);
        return [[], {}];
      }

      // Forward migration SQL (CREATE TABLE, ALTER TABLE, etc.) — no-op in mock
      return [[], {}];
    },

    async query(
      sql: string,
      _params?: unknown[],
    ): Promise<[unknown[], unknown]> {
      const normalized = sql.replace(/\s+/g, " ").trim();

      // SELECT ... FROM _migrations ORDER BY id ASC
      if (
        normalized.startsWith("SELECT") &&
        normalized.includes("_migrations")
      ) {
        return [[...rows], {}];
      }

      return [[], {}];
    },

    async beginTransaction(): Promise<void> {
      // No-op in mock
    },

    async commit(): Promise<void> {
      // No-op in mock
    },

    async rollback(): Promise<void> {
      // No-op in mock
    },
  };

  return db;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Rollback Validation — MigrationRunner round-trip (mock DB)", () => {
  let db: ReturnType<typeof createMockDb>;
  let runner: MigrationRunner;

  beforeEach(() => {
    db = createMockDb();
    runner = new MigrationRunner(db, migrationsDir);
  });

  it("up() applies all pending migrations in order", async () => {
    const result = await runner.up();
    expect(result.applied.length).toBeGreaterThan(0);
    // Verify first migration applied
    expect(result.applied[0]).toMatch(/^\d{3}_/);
    // Verify applied in sorted filename order
    const sorted = [...result.applied].sort();
    expect(result.applied).toEqual(sorted);
  }, 15_000);

  it("down() rolls back the most recently applied migration", async () => {
    // Apply all first
    const upResult = await runner.up();
    expect(upResult.applied.length).toBeGreaterThan(0);

    const lastApplied = upResult.applied[upResult.applied.length - 1];

    // Roll back
    const downResult = await runner.down();
    expect(downResult.rolledBack).toBe(lastApplied);
    expect(downResult.rolledBack).toMatch(/^\d{3}_/);
  }, 15_000);

  it("up() re-applies rolled-back migration (round-trip)", async () => {
    // Phase 1: apply all
    const upResult1 = await runner.up();
    expect(upResult1.applied.length).toBeGreaterThan(0);
    const totalApplied = upResult1.applied.length;

    // Phase 2: roll back last one
    const downResult = await runner.down();
    expect(downResult.rolledBack).not.toBeNull();

    // Phase 3: re-apply pending
    const upResult2 = await runner.up();
    expect(upResult2.applied).toHaveLength(1);
    expect(upResult2.applied[0]).toBe(downResult.rolledBack);

    // All migrations are now applied again
    const status = await runner.status();
    expect(status.applied).toHaveLength(totalApplied);
    expect(status.pending).toHaveLength(0);
  }, 15_000);

  it("status() reports no checksum mismatches after round-trip", async () => {
    await runner.up();
    await runner.down();
    await runner.up();

    const status = await runner.status();
    expect(status.checksumMismatches).toHaveLength(0);
  }, 15_000);

  it("down() on empty database returns rolledBack: null", async () => {
    const result = await runner.down();
    expect(result.rolledBack).toBeNull();
  }, 15_000);

  it("consecutive down() calls roll back one migration each time", async () => {
    await runner.up();

    const down1 = await runner.down();
    expect(down1.rolledBack).not.toBeNull();

    const down2 = await runner.down();
    expect(down2.rolledBack).not.toBeNull();

    // They should be different migrations
    expect(down1.rolledBack).not.toBe(down2.rolledBack);
  }, 15_000);

  it("status() applied list matches up() applied list after full apply", async () => {
    const upResult = await runner.up();
    const status = await runner.status();

    expect(status.applied.sort()).toEqual(upResult.applied.sort());
    expect(status.pending).toHaveLength(0);
    expect(status.checksumMismatches).toHaveLength(0);
  }, 15_000);
});
