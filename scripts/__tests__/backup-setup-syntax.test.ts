/**
 * Syntax tests for backup-setup.sh
 * Tests R-P3-01 through R-P3-08, R-P3-13
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const SCRIPT_PATH = path.resolve(__dirname, "../backup-setup.sh");
const scriptContent = (() => {
  try {
    return fs.readFileSync(SCRIPT_PATH, "utf-8");
  } catch {
    return "";
  }
})();

describe("backup-setup.sh syntax tests", () => {
  it("R-P3-01: backup-setup.sh exists", () => {
    // Tests R-P3-01
    expect(fs.existsSync(SCRIPT_PATH)).toBe(true);
  });

  it("R-P3-02: script targets loadpilot-prod instance", () => {
    // Tests R-P3-02
    expect(scriptContent).toMatch(/loadpilot-prod/);
  });

  it("R-P3-03: script enables automated backups via backup-start-time", () => {
    // Tests R-P3-03
    expect(scriptContent).toMatch(/backup-start-time/);
  });

  it("R-P3-04: script sets retained-backups-count for 7-day retention", () => {
    // Tests R-P3-04
    expect(scriptContent).toMatch(/retained-backups-count/);
  });

  it("R-P3-05: script enables binary logging for PITR via enable-bin-log", () => {
    // Tests R-P3-05
    expect(scriptContent).toMatch(/enable-bin-log/);
  });

  it("R-P3-06: script sets transaction log retention via retained-transaction-log-days", () => {
    // Tests R-P3-06
    expect(scriptContent).toMatch(/retained-transaction-log-days/);
  });

  it("R-P3-07: script verifies backup configuration with instances describe", () => {
    // Tests R-P3-07
    expect(scriptContent).toMatch(/instances describe/);
  });

  it("R-P3-08: script creates on-demand backup with backups create", () => {
    // Tests R-P3-08
    expect(scriptContent).toMatch(/backups create/);
  });

  it("script targets the correct GCP project", () => {
    expect(scriptContent).toMatch(/gen-lang-client-0535844903/);
  });

  it("script uses set -euo pipefail for safety", () => {
    expect(scriptContent).toMatch(/set -euo pipefail/);
  });
});
