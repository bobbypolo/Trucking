import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// Tests R-P3-01, R-P3-02, R-P3-03, R-P3-04, R-P3-05, R-P3-06, R-P3-07,
//       R-P3-08, R-P3-09, R-P3-10, R-P3-11, R-P3-12, R-P3-13, R-P3-14, R-P3-15

const SCRIPTS_DIR = path.join(__dirname, "../");
const DEPLOY_SCRIPT = path.join(SCRIPTS_DIR, "deploy-staging.sh");
const MIGRATION_SCRIPT = path.join(SCRIPTS_DIR, "run-staging-migrations.sh");
const VERIFY_SCRIPT = path.join(SCRIPTS_DIR, "verify-staging.sh");

function readScript(filePath: string): string {
  return fs.readFileSync(filePath, "utf8");
}

describe("deploy-staging.sh", () => {
  it("R-P3-01: script file exists", () => {
    expect(fs.existsSync(DEPLOY_SCRIPT)).toBe(true);
  });

  it("R-P3-04: uses Artifact Registry (docker.pkg.dev not gcr.io)", () => {
    const content = readScript(DEPLOY_SCRIPT);
    expect(content).toContain("docker.pkg.dev");
    expect(content).not.toContain("gcr.io");
  });

  it("R-P3-05: targets loadpilot-api Cloud Run service", () => {
    const content = readScript(DEPLOY_SCRIPT);
    expect(content).toContain("loadpilot-api");
  });

  it("R-P3-06: sets NODE_ENV=staging", () => {
    const content = readScript(DEPLOY_SCRIPT);
    expect(content).toContain("NODE_ENV=staging");
  });

  it("R-P3-07: uses min-instances=0 for staging cost savings", () => {
    const content = readScript(DEPLOY_SCRIPT);
    const hasFlag =
      content.includes("min-instances=0") || content.includes("min-instances 0");
    expect(hasFlag).toBe(true);
  });

  it("R-P3-08: uses dedicated service account flag", () => {
    const content = readScript(DEPLOY_SCRIPT);
    expect(content).toContain("service-account");
  });

  it("R-P3-09: sets DB_SOCKET_PATH for Cloud Run Unix socket", () => {
    const content = readScript(DEPLOY_SCRIPT);
    expect(content).toContain("DB_SOCKET_PATH");
  });

  it("R-P3-10: builds frontend with VITE_API_URL or sources env.staging", () => {
    const content = readScript(DEPLOY_SCRIPT);
    const hasSetting =
      content.includes("VITE_API_URL") || content.includes("env.staging");
    expect(hasSetting).toBe(true);
  });

  it("uses correct GCP project ID", () => {
    const content = readScript(DEPLOY_SCRIPT);
    expect(content).toContain("gen-lang-client-0535844903");
  });
});

describe("run-staging-migrations.sh", () => {
  it("R-P3-02: script file exists", () => {
    expect(fs.existsSync(MIGRATION_SCRIPT)).toBe(true);
  });

  it("R-P3-11: uses Cloud SQL Auth Proxy (TCP mode)", () => {
    const content = readScript(MIGRATION_SCRIPT);
    const hasProxy =
      content.includes("cloud-sql-proxy") ||
      content.includes("cloud_sql_proxy");
    expect(hasProxy).toBe(true);
  });

  it("R-P3-12: uses port 3307 for TCP proxy", () => {
    const content = readScript(MIGRATION_SCRIPT);
    expect(content).toContain("3307");
  });

  it("uses correct Cloud SQL instance connection name", () => {
    const content = readScript(MIGRATION_SCRIPT);
    expect(content).toContain("gen-lang-client-0535844903");
  });
});

describe("verify-staging.sh", () => {
  it("R-P3-03: script file exists", () => {
    expect(fs.existsSync(VERIFY_SCRIPT)).toBe(true);
  });

  it("R-P3-13: checks /api/health endpoint", () => {
    const content = readScript(VERIFY_SCRIPT);
    expect(content).toContain("/api/health");
  });

  it("R-P3-14: explicitly rejects HTTP 500 as auth failure (not success)", () => {
    const content = readScript(VERIFY_SCRIPT);
    // 500 must appear in rejection/failure logic
    expect(content).toContain("500");
    // Ensure 500 is not in an acceptance/success pattern
    expect(content).not.toMatch(/if.*500.*then.*pass|200.*500/i);
  });

  it("R-P3-15: checks for localhost in built frontend", () => {
    const content = readScript(VERIFY_SCRIPT);
    expect(content).toContain("localhost");
  });

  it("uses correct GCP project for service URL lookup", () => {
    const content = readScript(VERIFY_SCRIPT);
    expect(content).toContain("gen-lang-client-0535844903");
  });
});
