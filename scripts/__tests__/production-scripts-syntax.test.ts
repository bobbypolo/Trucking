/**
 * production-scripts-syntax.test.ts
 *
 * Syntax validation tests for production environment scripts:
 *   - scripts/provision-production.sh
 *   - scripts/deploy-production.sh
 *   - .env.production
 *
 * Tests read file content and grep for required patterns — no live GCP needed.
 *
 * Tests R-P2-01, R-P2-02, R-P2-03, R-P2-04, R-P2-05, R-P2-06, R-P2-07,
 *       R-P2-08, R-P2-09, R-P2-10, R-P2-11, R-P2-12, R-P2-13, R-P2-14,
 *       R-P2-15, R-P2-16, R-P2-17, R-P2-18
 */

import { describe, it, expect, beforeAll } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SCRIPTS_DIR = path.resolve(__dirname, "../");
const PROVISION_SCRIPT = path.join(SCRIPTS_DIR, "provision-production.sh");
const DEPLOY_SCRIPT = path.join(SCRIPTS_DIR, "deploy-production.sh");
const ENV_FILE = path.resolve(__dirname, "../../.env.production");
const GITIGNORE = path.resolve(__dirname, "../../.gitignore");

let provisionContent: string;
let deployContent: string;
let envContent: string;
let gitignoreContent: string;

beforeAll(() => {
  provisionContent = fs.existsSync(PROVISION_SCRIPT)
    ? fs.readFileSync(PROVISION_SCRIPT, "utf-8")
    : "";
  deployContent = fs.existsSync(DEPLOY_SCRIPT)
    ? fs.readFileSync(DEPLOY_SCRIPT, "utf-8")
    : "";
  envContent = fs.existsSync(ENV_FILE)
    ? fs.readFileSync(ENV_FILE, "utf-8")
    : "";
  gitignoreContent = fs.existsSync(GITIGNORE)
    ? fs.readFileSync(GITIGNORE, "utf-8")
    : "";
});

// ============================================================================
// provision-production.sh tests
// ============================================================================
describe("provision-production.sh", () => {
  it("R-P2-01: script file exists", () => {
    // Tests R-P2-01
    expect(fs.existsSync(PROVISION_SCRIPT)).toBe(true);
  });

  it("R-P2-02: production provisioning uses dedicated-core tier (db-custom)", () => {
    // Tests R-P2-02
    const matches = provisionContent.match(/db-custom/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(1);
  });

  it("R-P2-03: production provisioning does NOT use db-f1-micro (staging-only tier)", () => {
    // Tests R-P2-03
    // db-f1-micro may appear in comments explaining why NOT to use it — that is acceptable.
    // The --tier flag must use db-custom, not db-f1-micro.
    const tierFlag = provisionContent.match(/--tier=([^\s\\]+)/g);
    expect(tierFlag).not.toBeNull();
    const hasSharedTier = tierFlag!.some((t) => t.includes("db-f1-micro"));
    expect(hasSharedTier).toBe(false);
  });

  it("R-P2-04: production provisioning creates loadpilot-prod instance", () => {
    // Tests R-P2-04
    const matches = provisionContent.match(/loadpilot-prod/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(1);
  });

  it("R-P2-05: production provisioning creates trucklogix_prod database", () => {
    // Tests R-P2-05
    const matches = provisionContent.match(/trucklogix_prod/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(1);
  });

  it("R-P2-06: production provisioning creates loadpilot-api-prod-sa service account", () => {
    // Tests R-P2-06
    const matches = provisionContent.match(/loadpilot-api-prod-sa/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(1);
  });

  it("R-P2-07: production provisioning uses _PROD suffix for secrets", () => {
    // Tests R-P2-07
    expect(provisionContent).toContain("DB_PASSWORD_PROD");
    expect(provisionContent).toContain("GEMINI_API_KEY_PROD");
    // Verify the actual secret names use _PROD suffix (not plain staging names)
    const secretCreate = provisionContent.match(/secrets create "[^"]+_PROD"/g);
    expect(secretCreate).not.toBeNull();
    expect(secretCreate!.length).toBeGreaterThanOrEqual(1);
  });

  it("R-P2-08: production provisioning grants secretAccessor role", () => {
    // Tests R-P2-08
    const matches = provisionContent.match(
      /secretmanager\.secretAccessor|secretAccessor/g,
    );
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(1);
  });

  it("R-P2-09: production provisioning grants cloudsql.client role", () => {
    // Tests R-P2-09
    const matches = provisionContent.match(/cloudsql\.client/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(1);
  });

  it("R-P2-10: production provisioning grants serviceAccountUser role to deployer", () => {
    // Tests R-P2-10 (serviceAccountUser — required for Cloud Run service account attachment)
    const matches = provisionContent.match(
      /serviceAccountUser|iam\.serviceAccountUser/g,
    );
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(1);
  });

  it("script enables automated backups (backup flag present)", () => {
    // Tests R-P2-09 backup criterion from prd.json
    const hasBackup =
      provisionContent.includes("--backup") ||
      provisionContent.includes("enable-bin-log");
    expect(hasBackup).toBe(true);
  });

  it("script is idempotent — uses || true or existence checks for resource creation", () => {
    expect(provisionContent).toContain("|| true");
    expect(provisionContent).toContain("set -euo pipefail");
  });

  it("script validates DB_PASSWORD_PROD is set before running", () => {
    expect(provisionContent).toContain("DB_PASSWORD_PROD");
    expect(provisionContent).toContain("exit 1");
  });

  it("script requires PROD_PROJECT_ID env var (separate prod project)", () => {
    expect(provisionContent).toContain("PROD_PROJECT_ID");
    expect(provisionContent).toContain("exit 1");
  });
});

// ============================================================================
// deploy-production.sh tests
// ============================================================================
describe("deploy-production.sh", () => {
  it("R-P2-11 (deploy exists): script file exists", () => {
    // Tests R-P2-11
    expect(fs.existsSync(DEPLOY_SCRIPT)).toBe(true);
  });

  it("R-P2-12: deploy script uses --no-traffic flag", () => {
    // Tests R-P2-12
    const matches = deployContent.match(/--no-traffic|no-traffic/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(1);
  });

  it("R-P2-13: deploy script sets NODE_ENV=production", () => {
    // Tests R-P2-13
    const matches = deployContent.match(/NODE_ENV=production/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(1);
  });

  it("R-P2-14: deploy script uses --min-instances=1 (no cold starts in production)", () => {
    // Tests R-P2-14
    const hasMinInstances1 =
      deployContent.includes("--min-instances=1") ||
      deployContent.includes("--min-instances 1");
    expect(hasMinInstances1).toBe(true);
  });

  it("R-P2-15: deploy script uses production service account (loadpilot-api-prod-sa)", () => {
    // Tests R-P2-15
    const matches = deployContent.match(/loadpilot-api-prod-sa/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(1);
  });

  it("R-P2-16: deploy script uses production Cloud SQL connection (loadpilot-prod)", () => {
    // Tests R-P2-16
    expect(deployContent).toContain("loadpilot-prod");
  });

  it("R-P2-17: deploy script sets DB_SOCKET_PATH for production Cloud SQL", () => {
    // Tests R-P2-17
    expect(deployContent).toContain("DB_SOCKET_PATH");
    expect(deployContent).toContain("/cloudsql/");
  });

  it("deploy script uses Artifact Registry (docker.pkg.dev, not gcr.io)", () => {
    expect(deployContent).toContain("docker.pkg.dev");
    expect(deployContent).not.toContain("gcr.io");
  });

  it("deploy script targets loadpilot-api-prod Cloud Run service", () => {
    expect(deployContent).toContain("loadpilot-api-prod");
  });

  it("deploy script uses set -euo pipefail for strict error handling", () => {
    expect(deployContent).toContain("set -euo pipefail");
  });

  it("deploy script prints deployed revision name", () => {
    const hasRevision =
      deployContent.includes("REVISION_NAME") ||
      deployContent.includes("revision");
    expect(hasRevision).toBe(true);
  });
});

// ============================================================================
// .env.production tests
// ============================================================================
describe(".env.production", () => {
  it("R-P2-18: .env.production file exists", () => {
    // Tests R-P2-18
    expect(fs.existsSync(ENV_FILE)).toBe(true);
  });

  it("R-P2-18: .env.production sets NODE_ENV=production", () => {
    expect(envContent).toContain("NODE_ENV=production");
  });

  it("R-P2-18: .env.production sets DB_SOCKET_PATH for production Cloud SQL", () => {
    expect(envContent).toContain(
      "DB_SOCKET_PATH=/cloudsql/REPLACE_WITH_PROD_PROJECT_ID:us-central1:loadpilot-prod",
    );
  });

  it("R-P2-18: .env.production sets DB_NAME=trucklogix_prod", () => {
    expect(envContent).toContain("DB_NAME=trucklogix_prod");
  });

  it("R-P2-18: .env.production sets VITE_API_URL=/api (not localhost)", () => {
    expect(envContent).toContain("VITE_API_URL=/api");
    expect(envContent).not.toContain("VITE_API_URL=http://localhost");
  });

  it("R-P2-18: .env.production sets CORS_ORIGIN for production domain", () => {
    expect(envContent).toContain("CORS_ORIGIN=https://");
  });

  it('R-P2-18: .env.production contains "Do NOT commit" warning', () => {
    const hasWarning =
      envContent.includes("Do NOT commit") ||
      envContent.includes("do not commit");
    expect(hasWarning).toBe(true);
  });
});

// ============================================================================
// .gitignore tests
// ============================================================================
describe(".gitignore", () => {
  it("R-P2-18 (gitignore): .env.production is gitignored", () => {
    // Tests R-P2-18 gitignore criterion
    expect(gitignoreContent).toContain(".env.production");
  });
});
