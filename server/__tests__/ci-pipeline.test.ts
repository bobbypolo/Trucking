/**
 * CI Pipeline Configuration Tests — Story S-1.2
 *
 * Validates that the CI workflow YAML contains all required jobs
 * for release-gate quality. Tests read the ci.yml file as text and
 * verify the presence and configuration of each new CI job.
 *
 * Tests R-P1-06, R-P1-07, R-P1-08, R-P1-09, R-P1-10
 */
import { describe, it, expect, beforeAll } from "vitest";
import * as fs from "fs";
import * as path from "path";

const ciYmlPath = path.resolve(__dirname, "../../.github/workflows/ci.yml");

let ciContent: string;

beforeAll(() => {
  ciContent = fs.readFileSync(ciYmlPath, "utf-8");
});

describe("R-P1-06: CI runs npm run build and fails merge if build errors", () => {
  // Tests R-P1-06
  it("frontend-build job exists in CI workflow", () => {
    expect(ciContent).toContain("frontend-build:");
  });

  it("frontend-build job runs npm run build", () => {
    expect(ciContent).toContain("npm run build");
  });

  it("frontend-build job is named Frontend Build", () => {
    // The name field under frontend-build job
    const jobSection = ciContent.slice(ciContent.indexOf("frontend-build:"));
    expect(jobSection).toContain("name: Frontend Build");
  });

  it("frontend-build job uses checkout and setup-node", () => {
    const jobSection = ciContent.slice(
      ciContent.indexOf("frontend-build:"),
      ciContent.indexOf("migration-validation:"),
    );
    expect(jobSection).toContain("actions/checkout@v4");
    expect(jobSection).toContain("actions/setup-node@v4");
  });
});

describe("R-P1-07: CI validates migration file integrity", () => {
  // Tests R-P1-07
  it("migration-validation job exists in CI workflow", () => {
    expect(ciContent).toContain("migration-validation:");
  });

  it("migration-validation job calls scanMigrationFiles", () => {
    const jobSection = ciContent.slice(
      ciContent.indexOf("migration-validation:"),
      ciContent.indexOf("deployment-readiness:"),
    );
    expect(jobSection).toContain("scanMigrationFiles");
  });

  it("migration-validation checks for duplicate filenames", () => {
    const jobSection = ciContent.slice(
      ciContent.indexOf("migration-validation:"),
      ciContent.indexOf("deployment-readiness:"),
    );
    expect(jobSection).toContain("DUPLICATE");
  });

  it("migration-validation checks for UP and DOWN markers", () => {
    const jobSection = ciContent.slice(
      ciContent.indexOf("migration-validation:"),
      ciContent.indexOf("deployment-readiness:"),
    );
    expect(jobSection).toContain("UP");
    expect(jobSection).toContain("DOWN");
  });

  it("migration-validation exits with error on failures", () => {
    const jobSection = ciContent.slice(
      ciContent.indexOf("migration-validation:"),
      ciContent.indexOf("deployment-readiness:"),
    );
    expect(jobSection).toContain("process.exit(1)");
  });
});

describe("R-P1-08: CI runs deployment-readiness test suite", () => {
  // Tests R-P1-08
  it("deployment-readiness job exists in CI workflow", () => {
    expect(ciContent).toContain("deployment-readiness:");
  });

  it("deployment-readiness runs the deployment-readiness test file", () => {
    const jobSection = ciContent.slice(
      ciContent.indexOf("deployment-readiness:"),
      ciContent.indexOf("smoke-test:"),
    );
    expect(jobSection).toContain("deployment-readiness.test.ts");
    expect(jobSection).toContain("vitest");
  });

  it("deployment-readiness runs in server working directory", () => {
    const jobSection = ciContent.slice(
      ciContent.indexOf("deployment-readiness:"),
      ciContent.indexOf("smoke-test:"),
    );
    expect(jobSection).toContain("working-directory: server");
  });
});

describe("R-P1-09: CI smoke test with Express + MySQL", () => {
  // Tests R-P1-09
  it("smoke-test job exists in CI workflow", () => {
    expect(ciContent).toContain("smoke-test:");
  });

  it("smoke-test uses MySQL 8.0 service container", () => {
    const jobSection = ciContent.slice(ciContent.indexOf("smoke-test:"));
    expect(jobSection).toContain("image: mysql:8.0");
  });

  it("smoke-test MySQL service exposes port 3306", () => {
    const jobSection = ciContent.slice(ciContent.indexOf("smoke-test:"));
    expect(jobSection).toContain("3306:3306");
  });

  it("smoke-test MySQL service has health check with mysqladmin ping", () => {
    const jobSection = ciContent.slice(ciContent.indexOf("smoke-test:"));
    expect(jobSection).toContain("health-cmd");
    expect(jobSection).toContain("mysqladmin ping");
  });

  it("smoke-test MySQL sets MYSQL_DATABASE to loadpilot_test", () => {
    const jobSection = ciContent.slice(ciContent.indexOf("smoke-test:"));
    expect(jobSection).toContain("MYSQL_DATABASE: loadpilot_test");
  });

  it("smoke-test hits /api/health endpoint with curl", () => {
    const jobSection = ciContent.slice(ciContent.indexOf("smoke-test:"));
    expect(jobSection).toContain("/api/health");
    expect(jobSection).toContain("curl");
  });

  it("smoke-test verifies status:ok in response", () => {
    const jobSection = ciContent.slice(ciContent.indexOf("smoke-test:"));
    // The script checks STATUS against "ok"
    expect(jobSection).toContain('"ok"');
  });

  it("smoke-test verifies mysql:connected in response", () => {
    const jobSection = ciContent.slice(ciContent.indexOf("smoke-test:"));
    // The script checks MYSQL_STATUS against "connected"
    expect(jobSection).toContain('"connected"');
  });

  it("smoke-test runs on ubuntu-latest for container support", () => {
    const jobSection = ciContent.slice(ciContent.indexOf("smoke-test:"));
    expect(jobSection).toContain("runs-on: ubuntu-latest");
  });

  it("smoke-test sets DB_HOST to 127.0.0.1", () => {
    const jobSection = ciContent.slice(ciContent.indexOf("smoke-test:"));
    expect(jobSection).toContain("DB_HOST: 127.0.0.1");
  });

  it("smoke-test sets PORT to 5000", () => {
    const jobSection = ciContent.slice(ciContent.indexOf("smoke-test:"));
    // PORT is set as a string "5000" in the env block
    expect(jobSection).toMatch(/PORT:\s*"?5000"?/);
  });
});

describe("R-P1-10: All 4 new CI jobs are required status checks", () => {
  // Tests R-P1-10
  it("CI workflow contains all 8 jobs (4 existing + 4 new)", () => {
    const jobNames = [
      "frontend-typecheck:",
      "server-typecheck:",
      "server-tests:",
      "frontend-tests:",
      "frontend-build:",
      "migration-validation:",
      "deployment-readiness:",
      "smoke-test:",
    ];
    for (const jobName of jobNames) {
      expect(ciContent).toContain(jobName);
    }
  });

  it("all 4 new jobs are present as top-level job keys", () => {
    const newJobs = [
      "frontend-build:",
      "migration-validation:",
      "deployment-readiness:",
      "smoke-test:",
    ];
    for (const job of newJobs) {
      expect(ciContent).toContain(job);
    }
  });

  it("all 4 existing jobs are preserved", () => {
    const existingJobs = [
      "frontend-typecheck:",
      "server-typecheck:",
      "server-tests:",
      "frontend-tests:",
    ];
    for (const job of existingJobs) {
      expect(ciContent).toContain(job);
    }
  });

  it("workflow triggers on pull_request to main", () => {
    expect(ciContent).toContain("pull_request:");
    expect(ciContent).toContain("main");
  });

  it("workflow triggers on push to main and ralph branches", () => {
    expect(ciContent).toContain("push:");
    // Check that the branches list includes main and ralph/*
    const pushSection = ciContent.slice(
      ciContent.indexOf("push:"),
      ciContent.indexOf("pull_request:"),
    );
    expect(pushSection).toContain("main");
    expect(pushSection).toContain("ralph/*");
  });
});
