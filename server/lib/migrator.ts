/**
 * Database Migration Runner
 *
 * Lightweight migration framework for MySQL. Supports:
 * - up: Apply all pending migrations in filename order
 * - down: Rollback the most recently applied migration
 * - status: Show applied, pending, and checksum-mismatched migrations
 *
 * Migration files use -- UP / -- DOWN delimiters.
 * Tracks applied migrations in a _migrations table with SHA-256 checksums.
 *
 * @module server/lib/migrator
 * @story R-P1-08
 */

import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";

/**
 * Database connection interface.
 * Matches the subset of mysql2/promise Pool/Connection used by the runner.
 * Allows injection of mock implementations for testing.
 */
export interface MigrationDb {
  execute(sql: string, params?: unknown[]): Promise<[unknown[], unknown]>;
  query(sql: string, params?: unknown[]): Promise<[unknown[], unknown]>;
  beginTransaction(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

/** Parsed migration file with separated UP and DOWN SQL sections. */
export interface ParsedMigration {
  up: string;
  down: string;
}

/** A migration file on disk with its filename, raw SQL, and content checksum. */
export interface MigrationFile {
  filename: string;
  content: string;
  checksum: string;
  parsed: ParsedMigration;
}

/** Row shape returned from the _migrations tracking table. */
export interface AppliedMigrationRow {
  id: number;
  filename: string;
  checksum: string;
  applied_at: Date;
  execution_time_ms: number;
}

/** Result of the status command. */
export interface MigrationStatus {
  applied: string[];
  pending: string[];
  checksumMismatches: string[];
}

/** Result of the up command. */
export interface UpResult {
  applied: string[];
}

/** Result of the down command. */
export interface DownResult {
  rolledBack: string | null;
}

/**
 * Parse a migration file's content into UP and DOWN SQL sections.
 *
 * Format:
 * ```
 * -- optional preamble (ignored)
 * -- UP
 * <sql statements>
 * -- DOWN
 * <sql statements>
 * ```
 *
 * @param content - Raw file content
 * @returns Parsed UP and DOWN sections with trimmed content
 */
export function parseMigrationFile(content: string): ParsedMigration {
  const lines = content.split("\n");
  let section: "preamble" | "up" | "down" = "preamble";
  const upLines: string[] = [];
  const downLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === "-- UP") {
      section = "up";
      continue;
    }
    if (trimmed === "-- DOWN") {
      section = "down";
      continue;
    }

    if (section === "up") {
      upLines.push(line);
    } else if (section === "down") {
      downLines.push(line);
    }
    // preamble lines are ignored
  }

  return {
    up: trimSection(upLines),
    down: trimSection(downLines),
  };
}

/**
 * Trim leading/trailing empty lines from a section while preserving internal structure.
 */
function trimSection(lines: string[]): string {
  // Remove leading empty lines
  while (lines.length > 0 && lines[0].trim() === "") {
    lines.shift();
  }
  // Remove trailing empty lines
  while (lines.length > 0 && lines[lines.length - 1].trim() === "") {
    lines.pop();
  }
  return lines.join("\n");
}

/**
 * Compute SHA-256 hex digest of a string.
 */
function sha256(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

/**
 * Scan a directory for .sql migration files, sorted by filename.
 *
 * @param dir - Absolute path to migrations directory
 * @returns Array of MigrationFile objects sorted by filename
 */
export async function scanMigrationFiles(
  dir: string,
): Promise<MigrationFile[]> {
  // Only pick up numbered migration files (NNN_*.sql pattern)
  const MIGRATION_PATTERN = /^\d{3}_.*\.sql$/;
  const entries = fs
    .readdirSync(dir)
    .filter((f) => MIGRATION_PATTERN.test(f))
    .sort();

  return entries.map((filename) => {
    const filepath = path.join(dir, filename);
    const content = fs.readFileSync(filepath, "utf-8");
    return {
      filename,
      content,
      checksum: sha256(content),
      parsed: parseMigrationFile(content),
    };
  });
}

/** SQL to create the _migrations tracking table. */
const CREATE_MIGRATIONS_TABLE = `
CREATE TABLE IF NOT EXISTS _migrations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  filename VARCHAR(255) NOT NULL UNIQUE,
  checksum VARCHAR(64) NOT NULL,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  applied_by VARCHAR(100) DEFAULT 'migration-runner',
  execution_time_ms INT,
  INDEX idx_migrations_filename (filename)
)`;

/**
 * Migration runner that manages database schema versioning.
 *
 * Uses dependency injection for the database connection, enabling
 * mock-based testing without a real MySQL instance.
 */
export class MigrationRunner {
  private db: MigrationDb;
  private migrationsDir: string;

  constructor(db: MigrationDb, migrationsDir: string) {
    this.db = db;
    this.migrationsDir = migrationsDir;
  }

  /**
   * Ensure the _migrations tracking table exists.
   */
  private async ensureTable(): Promise<void> {
    // Use query() not execute() -- CREATE TABLE IF NOT EXISTS is DDL, not supported by prepared statements
    await this.db.query(CREATE_MIGRATIONS_TABLE);
  }

  /**
   * Get all applied migrations from the tracking table.
   */
  private async getApplied(): Promise<AppliedMigrationRow[]> {
    const [rows] = await this.db.query(
      "SELECT id, filename, checksum, applied_at, execution_time_ms FROM _migrations ORDER BY id ASC",
    );
    return rows as AppliedMigrationRow[];
  }

  /**
   * Get the status of all migrations: applied, pending, and checksum mismatches.
   */
  async status(): Promise<MigrationStatus> {
    await this.ensureTable();

    const applied = await this.getApplied();
    const available = await scanMigrationFiles(this.migrationsDir);

    const appliedMap = new Map(applied.map((a) => [a.filename, a.checksum]));

    const appliedNames: string[] = [];
    const pending: string[] = [];
    const checksumMismatches: string[] = [];

    for (const migration of available) {
      if (appliedMap.has(migration.filename)) {
        appliedNames.push(migration.filename);
        const storedChecksum = appliedMap.get(migration.filename)!;
        if (storedChecksum !== migration.checksum) {
          checksumMismatches.push(migration.filename);
        }
      } else {
        pending.push(migration.filename);
      }
    }

    return {
      applied: appliedNames,
      pending,
      checksumMismatches,
    };
  }

  /**
   * Apply all pending migrations in filename order.
   * Each migration runs in a transaction.
   */
  async up(): Promise<UpResult> {
    await this.ensureTable();

    const applied = await this.getApplied();
    const available = await scanMigrationFiles(this.migrationsDir);
    const appliedSet = new Set(applied.map((a) => a.filename));

    const pending = available.filter((m) => !appliedSet.has(m.filename));
    const appliedNames: string[] = [];

    for (const migration of pending) {
      const start = Date.now();

      await this.db.beginTransaction();
      try {
        // Execute the UP SQL
        // Use query() instead of execute() for DDL statements:
        // mysql2 execute() uses prepared statements which don't support DDL.
        const statements = splitStatements(migration.parsed.up);
        for (const stmt of statements) {
          await this.db.query(stmt);
        }

        // Record in tracking table
        const elapsed = Date.now() - start;
        await this.db.execute(
          "INSERT INTO _migrations (filename, checksum, execution_time_ms) VALUES (?, ?, ?)",
          [migration.filename, migration.checksum, elapsed],
        );

        await this.db.commit();
        appliedNames.push(migration.filename);
      } catch (err) {
        await this.db.rollback();
        throw new Error(
          `Migration ${migration.filename} failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return { applied: appliedNames };
  }

  /**
   * Rollback the most recently applied migration.
   */
  async down(): Promise<DownResult> {
    await this.ensureTable();

    const applied = await this.getApplied();
    if (applied.length === 0) {
      return { rolledBack: null };
    }

    const last = applied[applied.length - 1];
    const available = await scanMigrationFiles(this.migrationsDir);
    const migration = available.find((m) => m.filename === last.filename);

    if (!migration) {
      throw new Error(
        `Migration file ${last.filename} not found on disk. Cannot rollback.`,
      );
    }

    if (!migration.parsed.down) {
      throw new Error(
        `Migration ${last.filename} has no DOWN section. Cannot rollback.`,
      );
    }

    await this.db.beginTransaction();
    try {
      // Execute the DOWN SQL
      // Use query() instead of execute() for DDL statements:
      // mysql2 execute() uses prepared statements which don't support DDL.
      const statements = splitStatements(migration.parsed.down);
      for (const stmt of statements) {
        await this.db.query(stmt);
      }

      // Remove from tracking table
      await this.db.execute("DELETE FROM _migrations WHERE filename = ?", [
        last.filename,
      ]);

      await this.db.commit();
      return { rolledBack: last.filename };
    } catch (err) {
      await this.db.rollback();
      throw new Error(
        `Rollback of ${last.filename} failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}

/**
 * Split a SQL section into individual statements.
 * Handles multi-line statements separated by semicolons.
 * Skips empty statements and comment-only lines.
 */
function splitStatements(sql: string): string[] {
  // Split on semicolons that are NOT inside single-quoted strings.
  // This handles INSERT VALUES with semicolons in description fields.
  const statements: string[] = [];
  let current = "";
  let inString = false;
  let escaped = false;

  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];

    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (char === "\\" && inString) {
      escaped = true;
      current += char;
      continue;
    }

    if (char === "'" && !escaped) {
      inString = !inString;
      current += char;
      continue;
    }

    if (char === ";" && !inString) {
      const trimmed = current.trim();
      if (trimmed) {
        const lines = trimmed
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l && !l.startsWith("--"));
        if (lines.length > 0) {
          statements.push(trimmed);
        }
      }
      current = "";
      continue;
    }

    current += char;
  }

  // Handle trailing content without trailing semicolon
  const trimmed = current.trim();
  if (trimmed) {
    const lines = trimmed
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("--"));
    if (lines.length > 0) {
      statements.push(trimmed);
    }
  }

  return statements;
}
