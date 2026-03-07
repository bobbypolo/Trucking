import { describe, it, expect, vi, beforeEach } from "vitest";
import * as crypto from "crypto";
import * as path from "path";

// Tests R-P1-08-AC1, R-P1-08-AC2

/**
 * Mock DB interface matching what migrator.ts expects.
 * This lets us test the migration runner without a real MySQL connection.
 */
function createMockDb() {
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

    async execute(
      sql: string,
      _params?: unknown[],
    ): Promise<[unknown[], unknown]> {
      executedSql.push(sql);
      return [[], []];
    },

    async query(
      sql: string,
      _params?: unknown[],
    ): Promise<[unknown[], unknown]> {
      executedSql.push(sql);

      if (sql.includes("SELECT") && sql.includes("_migrations")) {
        return [appliedMigrations, []];
      }
      return [[], []];
    },

    async beginTransaction(): Promise<void> {},
    async commit(): Promise<void> {},
    async rollback(): Promise<void> {},

    // Test helpers
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

describe("R-P1-08: Database Migration Framework", () => {
  describe("AC1: Migration file parsing", () => {
    it("parseMigrationFile splits UP and DOWN sections correctly", async () => {
      const { parseMigrationFile } = await import("../../lib/migrator");

      const content = [
        "-- UP",
        "CREATE TABLE test (id INT PRIMARY KEY);",
        "INSERT INTO test VALUES (1);",
        "",
        "-- DOWN",
        "DROP TABLE test;",
      ].join("\n");

      const result = parseMigrationFile(content);
      expect(result.up).toBe(
        "CREATE TABLE test (id INT PRIMARY KEY);\nINSERT INTO test VALUES (1);",
      );
      expect(result.down).toBe("DROP TABLE test;");
    });

    it("parseMigrationFile handles missing DOWN section", async () => {
      const { parseMigrationFile } = await import("../../lib/migrator");

      const content = ["-- UP", "CREATE TABLE test (id INT PRIMARY KEY);"].join(
        "\n",
      );

      const result = parseMigrationFile(content);
      expect(result.up).toBe("CREATE TABLE test (id INT PRIMARY KEY);");
      expect(result.down).toBe("");
    });

    it("parseMigrationFile treats content before -- UP as preamble (ignored)", async () => {
      const { parseMigrationFile } = await import("../../lib/migrator");

      const content = [
        "-- Migration: create test table",
        "-- Author: dev",
        "",
        "-- UP",
        "CREATE TABLE test (id INT PRIMARY KEY);",
        "",
        "-- DOWN",
        "DROP TABLE test;",
      ].join("\n");

      const result = parseMigrationFile(content);
      expect(result.up).toBe("CREATE TABLE test (id INT PRIMARY KEY);");
      expect(result.down).toBe("DROP TABLE test;");
    });

    it("parseMigrationFile handles multiline SQL in both sections", async () => {
      const { parseMigrationFile } = await import("../../lib/migrator");

      const content = [
        "-- UP",
        "CREATE TABLE users (",
        "  id VARCHAR(36) PRIMARY KEY,",
        "  name VARCHAR(255) NOT NULL",
        ");",
        "",
        "CREATE TABLE posts (",
        "  id VARCHAR(36) PRIMARY KEY,",
        "  user_id VARCHAR(36)",
        ");",
        "",
        "-- DOWN",
        "DROP TABLE posts;",
        "DROP TABLE users;",
      ].join("\n");

      const result = parseMigrationFile(content);
      expect(result.up).toContain("CREATE TABLE users");
      expect(result.up).toContain("CREATE TABLE posts");
      expect(result.down).toContain("DROP TABLE posts");
      expect(result.down).toContain("DROP TABLE users");
    });
  });

  describe("AC1: Migration file scanning", () => {
    it("scanMigrationFiles reads .sql files sorted by filename", async () => {
      const { scanMigrationFiles } = await import("../../lib/migrator");
      const migrationsDir = path.resolve(__dirname, "..", "..", "migrations");
      const migrations = await scanMigrationFiles(migrationsDir);

      expect(migrations.length).toBeGreaterThanOrEqual(2);
      expect(migrations[0].filename).toBe("001_baseline.sql");
      expect(migrations[1].filename).toBe("002_add_version_columns.sql");

      // Each migration has a checksum
      for (const m of migrations) {
        expect(m.checksum).toMatch(/^[a-f0-9]{64}$/);
      }
    });

    it("scanMigrationFiles computes SHA-256 checksum of file content", async () => {
      const { scanMigrationFiles } = await import("../../lib/migrator");
      const fs = await import("fs");

      const migrationsDir = path.resolve(__dirname, "..", "..", "migrations");
      const migrations = await scanMigrationFiles(migrationsDir);
      const first = migrations[0];

      // Verify checksum manually
      const content = fs.readFileSync(
        path.join(migrationsDir, first.filename),
        "utf-8",
      );
      const expected = crypto
        .createHash("sha256")
        .update(content)
        .digest("hex");
      expect(first.checksum).toBe(expected);
    });
  });

  describe("AC1: MigrationRunner up/down/status commands", () => {
    let runner: Awaited<ReturnType<typeof createRunner>>;

    async function createRunner() {
      const { MigrationRunner } = await import("../../lib/migrator");
      const db = createMockDb();
      const migrationsDir = path.resolve(__dirname, "..", "..", "migrations");
      const r = new MigrationRunner(db as any, migrationsDir);
      return { runner: r, db };
    }

    beforeEach(async () => {
      runner = await createRunner();
    });

    it("status returns pending migrations when none applied", async () => {
      const status = await runner.runner.status();
      expect(status.applied).toEqual([]);
      expect(status.pending.length).toBeGreaterThanOrEqual(2);
      expect(status.pending[0]).toBe("001_baseline.sql");
    });

    it("status returns applied and pending correctly", async () => {
      const { scanMigrationFiles } = await import("../../lib/migrator");
      const migrationsDir = path.resolve(__dirname, "..", "..", "migrations");
      const available = await scanMigrationFiles(migrationsDir);

      // Simulate first migration applied
      runner.db.simulateApply(available[0].filename, available[0].checksum);

      const status = await runner.runner.status();
      expect(status.applied).toContain("001_baseline.sql");
      expect(status.pending).not.toContain("001_baseline.sql");
      expect(status.pending).toContain("002_add_version_columns.sql");
    });

    it("up executes pending migrations in order", async () => {
      const result = await runner.runner.up();
      expect(result.applied.length).toBeGreaterThanOrEqual(2);
      expect(result.applied[0]).toBe("001_baseline.sql");
      expect(result.applied[1]).toBe("002_add_version_columns.sql");

      // Verify SQL was executed (ensureTable + migration SQL + insert tracking)
      expect(runner.db.executedSql.length).toBeGreaterThan(0);
    });

    it("up skips already-applied migrations", async () => {
      const { scanMigrationFiles } = await import("../../lib/migrator");
      const migrationsDir = path.resolve(__dirname, "..", "..", "migrations");
      const available = await scanMigrationFiles(migrationsDir);

      // Simulate all migrations already applied
      for (const m of available) {
        runner.db.simulateApply(m.filename, m.checksum);
      }

      const result = await runner.runner.up();
      expect(result.applied).toEqual([]);
    });

    it("down rolls back the last applied migration", async () => {
      const { scanMigrationFiles } = await import("../../lib/migrator");
      const migrationsDir = path.resolve(__dirname, "..", "..", "migrations");
      const available = await scanMigrationFiles(migrationsDir);

      // Simulate all migrations applied
      for (const m of available) {
        runner.db.simulateApply(m.filename, m.checksum);
      }

      const result = await runner.runner.down();
      // down() rolls back the last applied migration (newest file)
      const lastMigration = available[available.length - 1].filename;
      expect(result.rolledBack).toBe(lastMigration);

      // Verify DELETE was executed for the rolled-back migration
      const deleteStatements = runner.db.executedSql.filter((s) =>
        s.includes("DELETE"),
      );
      expect(deleteStatements.length).toBeGreaterThanOrEqual(1);
    });

    it("down returns null when no migrations applied", async () => {
      const result = await runner.runner.down();
      expect(result.rolledBack).toBeNull();
    });

    it("_migrations table creation SQL is correct", async () => {
      await runner.runner.up();

      // The first executed SQL should create _migrations table
      const createTable = runner.db.executedSql.find((s) =>
        s.includes("CREATE TABLE IF NOT EXISTS _migrations"),
      );
      expect(createTable).toBeDefined();
      expect(createTable).toContain("filename VARCHAR(255)");
      expect(createTable).toContain("checksum VARCHAR(64)");
      expect(createTable).toContain("applied_at");
    });

    it("checksum mismatch detection in status", async () => {
      const { scanMigrationFiles } = await import("../../lib/migrator");
      const migrationsDir = path.resolve(__dirname, "..", "..", "migrations");
      const available = await scanMigrationFiles(migrationsDir);

      // Simulate with wrong checksum
      runner.db.simulateApply(available[0].filename, "wrong-checksum-abc");

      const status = await runner.runner.status();
      expect(status.checksumMismatches.length).toBe(1);
      expect(status.checksumMismatches[0]).toBe(available[0].filename);
    });
  });

  describe("AC2: Baseline migration 001", () => {
    it("001_baseline.sql exists and has UP/DOWN sections", async () => {
      const fs = await import("fs");
      const migrationPath = path.resolve(
        __dirname,
        "..",
        "..",
        "migrations",
        "001_baseline.sql",
      );

      expect(fs.existsSync(migrationPath)).toBe(true);
      const content = fs.readFileSync(migrationPath, "utf-8");
      expect(content).toContain("-- UP");
      expect(content).toContain("-- DOWN");
    });

    it("001_baseline.sql UP creates all tables from schema.sql", async () => {
      const fs = await import("fs");
      const { parseMigrationFile } = await import("../../lib/migrator");

      const migrationPath = path.resolve(
        __dirname,
        "..",
        "..",
        "migrations",
        "001_baseline.sql",
      );
      const content = fs.readFileSync(migrationPath, "utf-8");
      const { up } = parseMigrationFile(content);

      // All tables from schema.sql must be present
      const expectedTables = [
        "companies",
        "users",
        "customers",
        "customer_contracts",
        "equipment",
        "loads",
        "load_legs",
        "expenses",
        "issues",
        "incidents",
        "incident_actions",
        "emergency_charges",
        "compliance_records",
        "training_courses",
        "driver_time_logs",
        "dispatch_events",
        "messages",
        "leads",
        "quotes",
        "bookings",
        "work_items",
      ];

      for (const table of expectedTables) {
        expect(up).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
      }
    });

    it("001_baseline.sql DOWN drops all tables in reverse dependency order", async () => {
      const fs = await import("fs");
      const { parseMigrationFile } = await import("../../lib/migrator");

      const migrationPath = path.resolve(
        __dirname,
        "..",
        "..",
        "migrations",
        "001_baseline.sql",
      );
      const content = fs.readFileSync(migrationPath, "utf-8");
      const { down } = parseMigrationFile(content);

      // Child tables (with foreign keys) should be dropped before parent tables
      const dropStatements = down
        .split("\n")
        .filter((l) => l.trim().startsWith("DROP TABLE"))
        .map((l) => {
          const match = l.match(/DROP TABLE IF EXISTS (\w+)/);
          return match ? match[1] : "";
        })
        .filter(Boolean);

      // companies should be dropped AFTER users, loads, etc. (last or near-last)
      const companiesIdx = dropStatements.indexOf("companies");
      const usersIdx = dropStatements.indexOf("users");
      const loadsIdx = dropStatements.indexOf("loads");

      expect(companiesIdx).toBeGreaterThan(usersIdx);
      expect(companiesIdx).toBeGreaterThan(loadsIdx);
    });
  });

  describe("AC2: Migration 002 adds version columns", () => {
    it("002_add_version_columns.sql exists and has UP/DOWN sections", async () => {
      const fs = await import("fs");
      const migrationPath = path.resolve(
        __dirname,
        "..",
        "..",
        "migrations",
        "002_add_version_columns.sql",
      );

      expect(fs.existsSync(migrationPath)).toBe(true);
      const content = fs.readFileSync(migrationPath, "utf-8");
      expect(content).toContain("-- UP");
      expect(content).toContain("-- DOWN");
    });

    it("002 UP adds version column to loads, equipment, users", async () => {
      const fs = await import("fs");
      const { parseMigrationFile } = await import("../../lib/migrator");

      const migrationPath = path.resolve(
        __dirname,
        "..",
        "..",
        "migrations",
        "002_add_version_columns.sql",
      );
      const content = fs.readFileSync(migrationPath, "utf-8");
      const { up } = parseMigrationFile(content);

      expect(up).toContain("ALTER TABLE loads");
      expect(up).toContain("ALTER TABLE equipment");
      expect(up).toContain("ALTER TABLE users");
      expect(up).toMatch(/version\s+INT/i);
    });

    it("002 DOWN drops version column from loads, equipment, users", async () => {
      const fs = await import("fs");
      const { parseMigrationFile } = await import("../../lib/migrator");

      const migrationPath = path.resolve(
        __dirname,
        "..",
        "..",
        "migrations",
        "002_add_version_columns.sql",
      );
      const content = fs.readFileSync(migrationPath, "utf-8");
      const { down } = parseMigrationFile(content);

      expect(down).toContain("ALTER TABLE loads DROP COLUMN version");
      expect(down).toContain("ALTER TABLE equipment DROP COLUMN version");
      expect(down).toContain("ALTER TABLE users DROP COLUMN version");
    });
  });
});
