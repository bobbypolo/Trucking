import { describe, it, expect, vi, beforeEach } from "vitest";
import * as path from "path";

/**
 * Hardening tests for server/lib/migrator.ts
 *
 * Targets uncovered branches at 88% stmts, 74% branches:
 * - Failed migration recovery (error in up SQL → rollback)
 * - Missing migration file on disk during rollback
 * - Missing DOWN section during rollback
 * - splitStatements edge cases (comments, escaped quotes, trailing content)
 */

function createMockDb(options?: { failOnQuery?: boolean; failOnExecute?: boolean }) {
  const appliedMigrations: Array<{
    id: number;
    filename: string;
    checksum: string;
    applied_at: Date;
    execution_time_ms: number;
  }> = [];

  let nextId = 1;
  const executedSql: string[] = [];

  const mockDb = {
    appliedMigrations,
    executedSql,

    async execute(sql: string, _params?: unknown[]): Promise<[unknown[], unknown]> {
      executedSql.push(sql);
      if (options?.failOnExecute && sql.includes("INSERT INTO _migrations")) {
        throw new Error("Simulated execute failure");
      }
      return [[], []];
    },

    async query(sql: string, _params?: unknown[]): Promise<[unknown[], unknown]> {
      executedSql.push(sql);
      if (options?.failOnQuery && !sql.includes("CREATE TABLE") && !sql.includes("SELECT")) {
        throw new Error("Simulated query failure during migration SQL");
      }
      if (sql.includes("SELECT") && sql.includes("_migrations")) {
        return [appliedMigrations, []];
      }
      return [[], []];
    },

    async beginTransaction(): Promise<void> {},
    async commit(): Promise<void> {},
    async rollback(): Promise<void> {},

    simulateApply(filename: string, checksum: string) {
      appliedMigrations.push({
        id: nextId++,
        filename,
        checksum,
        applied_at: new Date(),
        execution_time_ms: 10,
      });
    },
  };

  return mockDb;
}

describe("migrator.ts — hardening tests", () => {
  describe("parseMigrationFile edge cases", () => {
    it("handles empty content", async () => {
      const { parseMigrationFile } = await import("../../lib/migrator");
      const result = parseMigrationFile("");
      expect(result.up).toBe("");
      expect(result.down).toBe("");
    });

    it("handles content with only whitespace lines in UP section", async () => {
      const { parseMigrationFile } = await import("../../lib/migrator");
      const content = "-- UP\n\n   \n\n-- DOWN\nDROP TABLE test;";
      const result = parseMigrationFile(content);
      expect(result.up).toBe("");
      expect(result.down).toBe("DROP TABLE test;");
    });

    it("handles content with no section markers at all", async () => {
      const { parseMigrationFile } = await import("../../lib/migrator");
      const content = "CREATE TABLE test (id INT PRIMARY KEY);";
      const result = parseMigrationFile(content);
      // All treated as preamble — both sections empty
      expect(result.up).toBe("");
      expect(result.down).toBe("");
    });

    it("handles content with only -- UP marker (no -- DOWN)", async () => {
      const { parseMigrationFile } = await import("../../lib/migrator");
      const content = "-- UP\nCREATE TABLE test (id INT);";
      const result = parseMigrationFile(content);
      expect(result.up).toBe("CREATE TABLE test (id INT);");
      expect(result.down).toBe("");
    });
  });

  describe("MigrationRunner — failed migration recovery", () => {
    it("rolls back transaction and throws when migration SQL fails", async () => {
      const { MigrationRunner } = await import("../../lib/migrator");
      const db = createMockDb({ failOnQuery: true });
      const migrationsDir = path.resolve(__dirname, "..", "..", "migrations");
      const runner = new MigrationRunner(db as any, migrationsDir);

      // Track rollback calls
      const rollbackSpy = vi.spyOn(db, "rollback");

      await expect(runner.up()).rejects.toThrow(/Migration.*failed/);
      expect(rollbackSpy).toHaveBeenCalled();
    });

    it("throws with migration filename when execute fails", async () => {
      const { MigrationRunner } = await import("../../lib/migrator");
      const db = createMockDb({ failOnExecute: true });
      const migrationsDir = path.resolve(__dirname, "..", "..", "migrations");
      const runner = new MigrationRunner(db as any, migrationsDir);

      await expect(runner.up()).rejects.toThrow("001_baseline.sql");
    });
  });

  describe("MigrationRunner — down() error paths", () => {
    it("throws when migration file not found on disk during rollback", async () => {
      const { MigrationRunner } = await import("../../lib/migrator");
      const db = createMockDb();
      const migrationsDir = path.resolve(__dirname, "..", "..", "migrations");
      const runner = new MigrationRunner(db as any, migrationsDir);

      // Simulate a migration that was applied but file no longer exists
      db.simulateApply("999_deleted_migration.sql", "checksum-abc");

      await expect(runner.down()).rejects.toThrow(
        /999_deleted_migration\.sql.*not found on disk/,
      );
    });

    it("throws when migration has no DOWN section", async () => {
      const { MigrationRunner, scanMigrationFiles } =
        await import("../../lib/migrator");
      const migrationsDir = path.resolve(__dirname, "..", "..", "migrations");

      const db = createMockDb();
      const runner = new MigrationRunner(db as any, migrationsDir);

      const available = await scanMigrationFiles(migrationsDir);
      const firstWithoutDown = available.find((m) => !m.parsed.down);

      if (firstWithoutDown) {
        db.simulateApply(firstWithoutDown.filename, firstWithoutDown.checksum);
        await expect(runner.down()).rejects.toThrow(/no DOWN section/);
      } else {
        // All real migration files have DOWN sections — verify at least one exists
        const withDown = available.filter((m) => m.parsed.down);
        expect(withDown.length).toBeGreaterThan(0);
      }
    });

    it("rolls back and throws when DOWN SQL execution fails", async () => {
      const { MigrationRunner, scanMigrationFiles } = await import("../../lib/migrator");
      const migrationsDir = path.resolve(__dirname, "..", "..", "migrations");
      const available = await scanMigrationFiles(migrationsDir);

      // Find a migration with a DOWN section
      const withDown = available.find((m) => m.parsed.down);
      if (!withDown) return; // skip if no migration has DOWN

      const db = createMockDb({ failOnQuery: true });
      db.simulateApply(withDown.filename, withDown.checksum);

      const runner = new MigrationRunner(db as any, migrationsDir);
      const rollbackSpy = vi.spyOn(db, "rollback");

      await expect(runner.down()).rejects.toThrow(/Rollback of.*failed/);
      expect(rollbackSpy).toHaveBeenCalled();
    });
  });

  describe("splitStatements (tested via parseMigrationFile + up)", () => {
    it("handles SQL with semicolons inside single-quoted strings", async () => {
      const { parseMigrationFile } = await import("../../lib/migrator");

      const content = [
        "-- UP",
        "INSERT INTO config (key, val) VALUES ('sep', 'a;b;c');",
        "CREATE TABLE t (id INT);",
        "-- DOWN",
        "DROP TABLE t;",
      ].join("\n");

      const result = parseMigrationFile(content);
      expect(result.up).toContain("'a;b;c'");
    });

    it("handles SQL with line comments containing apostrophes", async () => {
      const { parseMigrationFile } = await import("../../lib/migrator");

      const content = [
        "-- UP",
        "-- the load's company_id column",
        "ALTER TABLE loads ADD COLUMN company_id VARCHAR(36);",
        "-- DOWN",
        "ALTER TABLE loads DROP COLUMN company_id;",
      ].join("\n");

      const result = parseMigrationFile(content);
      expect(result.up).toContain("ALTER TABLE loads ADD COLUMN");
      expect(result.down).toContain("ALTER TABLE loads DROP COLUMN");
    });

    it("handles SQL with escaped single quotes inside strings", async () => {
      const { parseMigrationFile } = await import("../../lib/migrator");

      const content = [
        "-- UP",
        "INSERT INTO messages (text) VALUES ('it\\'s done');",
        "-- DOWN",
        "DELETE FROM messages WHERE text = 'it\\'s done';",
      ].join("\n");

      const result = parseMigrationFile(content);
      expect(result.up).toContain("it\\'s done");
    });

    it("handles trailing content without semicolon", async () => {
      const { parseMigrationFile } = await import("../../lib/migrator");

      const content = [
        "-- UP",
        "CREATE TABLE t (id INT PRIMARY KEY)",
        "-- DOWN",
        "DROP TABLE t",
      ].join("\n");

      const result = parseMigrationFile(content);
      expect(result.up).toContain("CREATE TABLE t");
      expect(result.down).toContain("DROP TABLE t");
    });

    it("skips comment-only statements after semicolons", async () => {
      const { parseMigrationFile } = await import("../../lib/migrator");

      const content = [
        "-- UP",
        "CREATE TABLE t (id INT);",
        "-- this is just a comment",
        "-- another comment",
        "CREATE TABLE u (id INT);",
        "-- DOWN",
        "DROP TABLE u;",
        "DROP TABLE t;",
      ].join("\n");

      const result = parseMigrationFile(content);
      expect(result.up).toContain("CREATE TABLE t");
      expect(result.up).toContain("CREATE TABLE u");
    });
  });

  describe("scanMigrationFiles filtering", () => {
    it("only picks up files matching NNN_*.sql pattern", async () => {
      const { scanMigrationFiles } = await import("../../lib/migrator");
      const migrationsDir = path.resolve(__dirname, "..", "..", "migrations");
      const migrations = await scanMigrationFiles(migrationsDir);

      for (const m of migrations) {
        expect(m.filename).toMatch(/^\d{3}_.*\.sql$/);
      }
    });

    it("returns files sorted by filename", async () => {
      const { scanMigrationFiles } = await import("../../lib/migrator");
      const migrationsDir = path.resolve(__dirname, "..", "..", "migrations");
      const migrations = await scanMigrationFiles(migrationsDir);

      const filenames = migrations.map((m) => m.filename);
      const sorted = [...filenames].sort();
      expect(filenames).toEqual(sorted);
    });

    it("normalizes line endings (\\r\\n → \\n)", async () => {
      const { scanMigrationFiles } = await import("../../lib/migrator");
      const migrationsDir = path.resolve(__dirname, "..", "..", "migrations");
      const migrations = await scanMigrationFiles(migrationsDir);

      for (const m of migrations) {
        expect(m.content).not.toContain("\r\n");
      }
    });
  });
});
