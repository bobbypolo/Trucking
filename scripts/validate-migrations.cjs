#!/usr/bin/env node
/**
 * validate-migrations.cjs — CI migration file validator.
 *
 * Tests R-P1-07 (Migration Validation CI job).
 *
 * Scans server/migrations/*.sql, checks for duplicate filenames, parses each
 * file, and verifies UP and DOWN markers. Mirrors the logic that previously
 * ran inline via `npx tsx -e` under `shell: bash` in ci.yml; ported to a
 * standalone CommonJS file so it runs natively on the self-hosted Windows
 * runner (no WSL dependency).
 *
 * The parsing logic is kept in sync with server/lib/migrator.ts
 * (parseMigrationFile, scanMigrationFiles). Migration files use
 * `-- UP` / `-- DOWN` delimiters; superseded placeholder files with no
 * markers are skipped (matches the TS migrator behavior).
 *
 * Exit codes:
 *   0 — validation passed
 *   1 — validation errors (duplicate filename, missing UP marker, etc.)
 *
 * Usage:
 *   node scripts/validate-migrations.cjs
 */

"use strict";

const fs = require("fs");
const path = require("path");

// Only pick up numbered migration files (NNN_*.sql pattern).
const MIGRATION_PATTERN = /^\d{3}_.*\.sql$/;

/**
 * Trim leading/trailing empty lines from a section while preserving
 * internal structure.
 *
 * @param {string[]} lines
 * @returns {string}
 */
function trimSection(lines) {
  while (lines.length > 0 && lines[0].trim() === "") {
    lines.shift();
  }
  while (lines.length > 0 && lines[lines.length - 1].trim() === "") {
    lines.pop();
  }
  return lines.join("\n");
}

/**
 * Parse a migration file's content into UP and DOWN SQL sections.
 * Mirrors parseMigrationFile() in server/lib/migrator.ts.
 *
 * @param {string} content
 * @returns {{ up: string, down: string }}
 */
function parseMigrationFile(content) {
  const lines = content.split("\n");
  let section = "preamble";
  const upLines = [];
  const downLines = [];

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
  }

  return {
    up: trimSection(upLines),
    down: trimSection(downLines),
  };
}

/**
 * Scan a directory for .sql migration files, sorted by filename.
 * Mirrors scanMigrationFiles() in server/lib/migrator.ts: superseded
 * placeholder files (containing "SUPERSEDED" but neither marker) are
 * excluded from the active chain.
 *
 * @param {string} dir
 * @returns {Array<{filename: string, parsed: {up: string, down: string}}>}
 */
function scanMigrationFiles(dir) {
  const entries = fs
    .readdirSync(dir)
    .filter((f) => MIGRATION_PATTERN.test(f))
    .sort();

  const migrations = [];

  for (const filename of entries) {
    const filepath = path.join(dir, filename);
    const content = fs.readFileSync(filepath, "utf-8").replace(/\r\n/g, "\n");

    if (
      content.includes("SUPERSEDED") &&
      !content.includes("-- UP") &&
      !content.includes("-- DOWN")
    ) {
      continue;
    }

    migrations.push({
      filename,
      parsed: parseMigrationFile(content),
    });
  }

  return migrations;
}

function main() {
  // Resolve migrations dir relative to repo root. The CI job runs with
  // working-directory: server, so migrations/ is a sibling; when invoked
  // from repo root, the path is server/migrations. Support both.
  const candidates = [
    path.resolve(process.cwd(), "migrations"),
    path.resolve(process.cwd(), "server", "migrations"),
  ];
  const migrationsDir = candidates.find((p) => {
    try {
      return fs.statSync(p).isDirectory();
    } catch {
      return false;
    }
  });

  if (!migrationsDir) {
    console.error(
      "ERROR: could not locate migrations directory. Tried: " +
        candidates.join(", "),
    );
    process.exit(1);
  }

  const files = scanMigrationFiles(migrationsDir);

  let errors = 0;

  // Check for duplicate filenames (cannot happen after fs.readdirSync,
  // but the original inline check kept it for parity with the TS runtime
  // in case callers construct MigrationFile arrays differently).
  const seen = new Set();
  for (const f of files) {
    if (seen.has(f.filename)) {
      console.error("DUPLICATE filename:", f.filename);
      errors++;
    }
    seen.add(f.filename);
  }

  // Check each migration parses and has UP and DOWN markers.
  for (const f of files) {
    if (!f.parsed.up && !f.parsed.down) {
      console.error("MISSING both UP and DOWN markers:", f.filename);
      errors++;
    } else if (!f.parsed.up) {
      console.error("MISSING UP marker:", f.filename);
      errors++;
    } else if (!f.parsed.down) {
      console.warn("WARNING: missing DOWN marker:", f.filename);
    }
  }

  console.log("Scanned", files.length, "migration files");
  console.log("Errors:", errors);

  if (errors > 0) {
    process.exit(1);
  }

  console.log("Migration validation passed");
}

main();
