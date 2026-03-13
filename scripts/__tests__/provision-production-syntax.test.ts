/**
 * provision-production-syntax.test.ts
 *
 * Syntax validation tests for scripts/provision-production.sh.
 * Tests read file content and grep for required commands — no live GCP needed.
 *
 * Tests R-P2-01, R-P2-02, R-P2-03, R-P2-04, R-P2-05, R-P2-06, R-P2-07, R-P2-08, R-P2-09
 */

import { describe, it, expect, beforeAll } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SCRIPT_PATH = path.resolve(
  __dirname,
  "../../scripts/provision-production.sh",
);

let scriptContent: string;

beforeAll(() => {
  scriptContent = fs.existsSync(SCRIPT_PATH)
    ? fs.readFileSync(SCRIPT_PATH, "utf-8")
    : "";
});

describe("provision-production.sh syntax validation", () => {
  it("R-P2-01: script file exists", () => {
    expect(fs.existsSync(SCRIPT_PATH)).toBe(true);
  });

  it("R-P2-02: production provisioning uses dedicated-core tier (db-custom)", () => {
    const matches = scriptContent.match(/db-custom/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(1);
  });

  it("R-P2-03: production provisioning does NOT use db-f1-micro as --tier", () => {
    const tierFlag = scriptContent.match(/--tier=([^\s\\]+)/g);
    expect(tierFlag).not.toBeNull();
    const hasSharedTier = tierFlag!.some((t) => t.includes("db-f1-micro"));
    expect(hasSharedTier).toBe(false);
  });

  it("R-P2-04: production provisioning creates loadpilot-prod instance", () => {
    const matches = scriptContent.match(/loadpilot-prod/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(1);
  });

  it("R-P2-05: production provisioning creates trucklogix_prod database", () => {
    const matches = scriptContent.match(/trucklogix_prod/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(1);
  });

  it("R-P2-06: production provisioning creates loadpilot-api-prod-sa service account", () => {
    const matches = scriptContent.match(/loadpilot-api-prod-sa/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(1);
  });

  it("R-P2-07: production provisioning grants secretAccessor role", () => {
    const matches = scriptContent.match(
      /secretmanager\.secretAccessor|secretAccessor/g,
    );
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(1);
  });

  it("R-P2-08: production provisioning grants cloudsql.client role", () => {
    const matches = scriptContent.match(/cloudsql\.client/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(1);
  });

  it("R-P2-09: production provisioning enables automated backups", () => {
    const hasBackup =
      scriptContent.includes("--backup") ||
      scriptContent.includes("enable-bin-log");
    expect(hasBackup).toBe(true);
  });

  it("script grants serviceAccountUser role to deployer", () => {
    const matches = scriptContent.match(
      /serviceAccountUser|iam\.serviceAccountUser/g,
    );
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(1);
  });

  it("script uses _PROD suffix for secrets (DB_PASSWORD_PROD, GEMINI_API_KEY_PROD)", () => {
    expect(scriptContent).toContain("DB_PASSWORD_PROD");
    expect(scriptContent).toContain("GEMINI_API_KEY_PROD");
  });

  it("script requires PROD_PROJECT_ID env var (separate prod project)", () => {
    expect(scriptContent).toContain("PROD_PROJECT_ID");
    // Must fail fast if not set
    expect(scriptContent).toContain("exit 1");
  });

  it("script is idempotent — uses || true guards and existence checks", () => {
    expect(scriptContent).toContain("|| true");
  });

  it("script validates DB_PASSWORD_PROD is required before running", () => {
    expect(scriptContent).toContain("DB_PASSWORD_PROD");
    expect(scriptContent).toContain("exit 1");
  });
});
