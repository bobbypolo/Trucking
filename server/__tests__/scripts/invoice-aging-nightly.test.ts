import { describe, it, expect } from "vitest";
import { spawnSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

/**
 * Tests for scripts/invoice-aging-nightly.cjs — the Windows-safe
 * external scheduler wrapper for the invoice aging nightly job.
 */

const SCRIPT_PATH = path.resolve(
  __dirname,
  "..",
  "..",
  "..",
  "scripts",
  "invoice-aging-nightly.cjs",
);

const RUNBOOK_PATH = path.resolve(
  __dirname,
  "..",
  "..",
  "..",
  "docs",
  "ops",
  "invoice-aging-nightly.md",
);

describe("scripts/invoice-aging-nightly.cjs", () => {
  // Tests R-B1-05
  it("--dry-run exits 0 and stdout contains status:dry-run", () => {
    const result = spawnSync("node", [SCRIPT_PATH, "--dry-run"], {
      encoding: "utf-8",
      timeout: 10_000,
      env: { ...process.env, DATABASE_URL: "mysql://fake:fake@localhost/fake" },
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('"status":"dry-run"');
  });

  // Tests R-B1-07
  it("exits non-zero with missing_database_url when DATABASE_URL is unset", () => {
    const envWithoutDb = { ...process.env };
    delete envWithoutDb.DATABASE_URL;

    const result = spawnSync("node", [SCRIPT_PATH], {
      encoding: "utf-8",
      timeout: 10_000,
      env: envWithoutDb,
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('"error":"missing_database_url"');
  });
});

describe("docs/ops/invoice-aging-nightly.md runbook", () => {
  // Tests R-B1-06
  it("contains all 7 required H2 sections", () => {
    const content = fs.readFileSync(RUNBOOK_PATH, "utf-8");

    const requiredHeadings = [
      "## Dry-run",
      "## Production invocation",
      "## Idempotency",
      "## Failure alerting",
      "## Cron example",
      "## GitHub Actions example",
      "## Rollback",
    ];

    for (const heading of requiredHeadings) {
      expect(content).toMatch(
        new RegExp(`^${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "m"),
      );
    }
  });
});
