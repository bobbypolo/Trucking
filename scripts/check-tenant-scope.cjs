#!/usr/bin/env node
/**
 * check-tenant-scope.cjs — CI-enforceable tenant isolation check.
 *
 * Tests R-P3-04: CI grep check fails on unscoped tenant-table queries.
 *
 * Node.js port of scripts/check-tenant-scope.sh. The bash version runs
 * grep/sed/cut pipelines that require WSL on the self-hosted Windows CI
 * runner; since WSL is not installed, the CI job fails before the check
 * can execute. This CommonJS port uses the native fs API and runs on
 * plain Node, so it works natively on Windows.
 *
 * Detection logic must match the bash script exactly so that CI results
 * stay consistent with any local developer who still runs the .sh file.
 *
 * For each tenant-scoped table, scans server/{routes,services,repositories}
 * TypeScript files for SELECT/UPDATE/DELETE/INSERT statements that
 * reference the table but do NOT include "company_id" in the same query
 * context (current line + 5 lines after). A few intentional escape
 * hatches mirror the bash script:
 *   1. SELECT 1 / SHOW TABLES / information_schema queries
 *   2. FK-validation lookups (SELECT id FROM x WHERE id = ?) scoped by
 *      company_id / companyId / tenantId within a broader 16-line window
 *   3. Migration files
 *
 * Exit 0 = all queries scoped
 * Exit 1 = unscoped queries found
 *
 * Usage: node scripts/check-tenant-scope.cjs
 */

"use strict";

const fs = require("fs");
const path = require("path");

// Tables that have a company_id column directly. Tables without company_id
// (e.g., dispatch_events, load_legs) inherit tenant scope via FK
// relationships and are excluded from this check.
const TENANT_TABLES = [
  "loads",
  "equipment",
  "users",
  "invoices",
  "bills",
  "settlements",
  "documents",
  "tracking_events",
  "incidents",
  "call_sessions",
  "ar_invoices",
  "ap_bills",
  "driver_settlements",
  "compliance_records",
  "work_items",
];

const SCAN_DIRS = [
  "server/routes",
  "server/services",
  "server/repositories",
];

/**
 * Recursively list all .ts files under a directory, returning POSIX-style
 * paths (forward slashes) so output matches the bash grep format on
 * Windows runners.
 *
 * @param {string} dir
 * @returns {string[]}
 */
function listTsFiles(dir) {
  /** @type {string[]} */
  const out = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listTsFiles(full));
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      out.push(full.replace(/\\/g, "/"));
    }
  }
  return out;
}

/**
 * Read a file as an array of lines. Strips trailing newline so line[0]
 * corresponds to line number 1 in the source (1-indexed when incremented).
 *
 * @param {string} filepath
 * @returns {string[]}
 */
function readLines(filepath) {
  const raw = fs.readFileSync(filepath, "utf-8").replace(/\r\n/g, "\n");
  const lines = raw.split("\n");
  // Drop the trailing empty element produced by a file ending in \n.
  if (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }
  return lines;
}

/**
 * Return the 1-indexed slice lines[startLine..endLine] joined by newlines,
 * matching `sed -n "${startLine},${endLine}p"` semantics (inclusive both
 * ends, clamped to file bounds).
 *
 * @param {string[]} lines
 * @param {number} startLine
 * @param {number} endLine
 * @returns {string}
 */
function sliceLines(lines, startLine, endLine) {
  const start = Math.max(1, startLine) - 1;
  const end = Math.min(lines.length, endLine);
  return lines.slice(start, end).join("\n");
}

function main() {
  // Resolve SCAN_DIRS relative to the current working directory (same as
  // the bash script). CI runs the job from repo root.
  /** @type {Array<{file: string, lineno: number, content: string}>} */
  const allLines = [];

  for (const dir of SCAN_DIRS) {
    const files = listTsFiles(dir);
    for (const file of files) {
      const lines = readLines(file);
      for (let i = 0; i < lines.length; i++) {
        allLines.push({ file, lineno: i + 1, content: lines[i] });
      }
    }
  }

  // Cache file lines for context lookups so we only read each file once
  // even when multiple tables hit the same file.
  /** @type {Map<string, string[]>} */
  const fileLineCache = new Map();
  function getLines(file) {
    let cached = fileLineCache.get(file);
    if (cached === undefined) {
      cached = readLines(file);
      fileLineCache.set(file, cached);
    }
    return cached;
  }

  let violations = 0;
  const output = [];

  for (const table of TENANT_TABLES) {
    // Match: (SELECT|UPDATE|DELETE|INSERT).*\b<table>\b
    // Escape the table name for safety even though current entries are
    // plain identifiers.
    const tableEsc = table.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(
      `(SELECT|UPDATE|DELETE|INSERT).*\\b${tableEsc}\\b`,
    );

    for (const row of allLines) {
      if (!pattern.test(row.content)) continue;

      const { file, lineno, content } = row;

      // Skip test files.
      if (/__tests__|\.test\.|\.spec\./.test(file)) continue;

      // Skip comments — bash regex: ^\s*(//|/\*|\*)
      if (/^\s*(\/\/|\/\*|\*)/.test(content)) continue;

      // Check if company_id appears in the same query context
      // (current line + 5 lines after, same as sed ${lineno},$((lineno + 5))p).
      const fileLines = getLines(file);
      const context = sliceLines(fileLines, lineno, lineno + 5);

      if (context.includes("company_id")) continue;

      // Special case 1: health-check queries.
      if (/SELECT\s+1|SHOW\s+TABLES|information_schema/i.test(content)) {
        continue;
      }

      // Special case 2: FK-validation lookups with broader scoping.
      if (/SELECT\s+id\s+FROM.*WHERE\s+id\s*=/.test(content)) {
        const broaderStart = lineno > 5 ? lineno - 5 : 1;
        const broader = sliceLines(fileLines, broaderStart, lineno + 10);
        if (/company_id|companyId|tenantId/.test(broader)) {
          continue;
        }
      }

      // Special case 3: migration files.
      if (file.includes("migrations")) continue;

      output.push(
        `VIOLATION: ${file}:${lineno} \u2014 Query on '${table}' without company_id scoping`,
      );
      output.push(`  ${content}`);
      violations++;
    }
  }

  for (const line of output) {
    console.log(line);
  }

  if (violations > 0) {
    console.log("");
    console.log(
      `FAIL: ${violations} unscoped tenant-table query(ies) found.`,
    );
    console.log(
      "Every query on a tenant-scoped table MUST include company_id in its WHERE clause.",
    );
    process.exit(1);
  } else {
    console.log(
      "PASS: All tenant-table queries are properly scoped with company_id.",
    );
    process.exit(0);
  }
}

main();
