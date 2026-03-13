/**
 * gate-scripts-syntax.test.ts
 *
 * Syntax validation tests for controlled rollout gate scripts and
 * production migration runner.
 *
 * Tests R-P5-01, R-P5-02, R-P5-03, R-P5-04, R-P5-05, R-P5-06,
 *       R-P5-07, R-P5-08, R-P5-09, R-P5-10, R-P5-11, R-P5-12,
 *       R-P5-13, R-P5-14, R-P5-15, R-P5-16, R-P5-18
 *
 * These tests validate script content without executing them against
 * real GCP infrastructure.
 */
import { describe, it, expect, beforeAll } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SCRIPTS_DIR = path.resolve(__dirname, "../");
const REPO_ROOT = path.resolve(__dirname, "../..");

const GATE_A = path.join(SCRIPTS_DIR, "gate-a-internal.sh");
const GATE_B = path.join(SCRIPTS_DIR, "gate-b-pilot.sh");
const GATE_C = path.join(SCRIPTS_DIR, "gate-c-broader.sh");
const GATE_D = path.join(SCRIPTS_DIR, "gate-d-ga.sh");
const MIGRATION_SCRIPT = path.join(SCRIPTS_DIR, "run-production-migrations.sh");
const ROLLOUT_EVIDENCE = path.join(
  REPO_ROOT,
  "docs",
  "deployment",
  "ROLLOUT_EVIDENCE.md",
);

let gateA: string;
let gateB: string;
let gateC: string;
let gateD: string;
let migration: string;
let evidence: string;

beforeAll(() => {
  gateA = fs.existsSync(GATE_A) ? fs.readFileSync(GATE_A, "utf-8") : "";
  gateB = fs.existsSync(GATE_B) ? fs.readFileSync(GATE_B, "utf-8") : "";
  gateC = fs.existsSync(GATE_C) ? fs.readFileSync(GATE_C, "utf-8") : "";
  gateD = fs.existsSync(GATE_D) ? fs.readFileSync(GATE_D, "utf-8") : "";
  migration = fs.existsSync(MIGRATION_SCRIPT)
    ? fs.readFileSync(MIGRATION_SCRIPT, "utf-8")
    : "";
  evidence = fs.existsSync(ROLLOUT_EVIDENCE)
    ? fs.readFileSync(ROLLOUT_EVIDENCE, "utf-8")
    : "";
});

// ─── File existence ───────────────────────────────────────────────────────────

describe("File existence", () => {
  it("R-P5-01: gate-a-internal.sh exists", () => {
    // Tests R-P5-01
    expect(fs.existsSync(GATE_A)).toBe(true);
  });

  it("R-P5-02: gate-b-pilot.sh exists", () => {
    // Tests R-P5-02
    expect(fs.existsSync(GATE_B)).toBe(true);
  });

  it("R-P5-03: gate-c-broader.sh exists", () => {
    // Tests R-P5-03
    expect(fs.existsSync(GATE_C)).toBe(true);
  });

  it("R-P5-04: gate-d-ga.sh exists", () => {
    // Tests R-P5-04
    expect(fs.existsSync(GATE_D)).toBe(true);
  });

  it("R-P5-05: run-production-migrations.sh exists", () => {
    // Tests R-P5-05
    expect(fs.existsSync(MIGRATION_SCRIPT)).toBe(true);
  });

  it("R-P5-06: ROLLOUT_EVIDENCE.md exists", () => {
    // Tests R-P5-06
    expect(fs.existsSync(ROLLOUT_EVIDENCE)).toBe(true);
  });
});

// ─── Traffic percentages ──────────────────────────────────────────────────────

describe("Traffic percentages", () => {
  it("R-P5-07: Gate A routes 10% traffic", () => {
    // Tests R-P5-07
    expect(gateA).toContain("10");
    expect(gateA).toMatch(/TRAFFIC_PCT=10|10%|=10\b/);
  });

  it("R-P5-08: Gate B routes 25% traffic", () => {
    // Tests R-P5-08
    expect(gateB).toContain("25");
    expect(gateB).toMatch(/TRAFFIC_PCT=25|25%|=25\b/);
  });

  it("R-P5-09: Gate C routes 50% traffic", () => {
    // Tests R-P5-09
    expect(gateC).toContain("50");
    expect(gateC).toMatch(/TRAFFIC_PCT=50|50%|=50\b/);
  });

  it("R-P5-10: Gate D routes 100% traffic", () => {
    // Tests R-P5-10
    expect(gateD).toContain("100");
    expect(gateD).toMatch(/TRAFFIC_PCT=100|100%|=100\b/);
  });
});

// ─── Smoke/verify calls ───────────────────────────────────────────────────────

describe("Gate scripts call smoke/verify", () => {
  it("R-P5-11: Gate A calls smoke-test-production.sh", () => {
    // Tests R-P5-11
    expect(gateA).toContain("smoke-test-production.sh");
  });

  it("R-P5-11: Gate B calls smoke-test-production.sh", () => {
    // Tests R-P5-11
    expect(gateB).toContain("smoke-test-production.sh");
  });

  it("R-P5-11: Gate C calls smoke-test-production.sh and verify-production.sh", () => {
    // Tests R-P5-11
    expect(gateC).toContain("smoke-test-production.sh");
    expect(gateC).toContain("verify-production.sh");
  });

  it("R-P5-11: Gate D calls smoke-test-production.sh and verify-production.sh", () => {
    // Tests R-P5-11
    expect(gateD).toContain("smoke-test-production.sh");
    expect(gateD).toContain("verify-production.sh");
  });
});

// ─── Auto-rollback logic ──────────────────────────────────────────────────────

describe("Gate scripts have auto-rollback", () => {
  it("R-P5-12: Gate A has rollback logic", () => {
    // Tests R-P5-12
    expect(gateA).toMatch(/rollback|update-traffic.*100|STABLE_REVISION/i);
    expect(gateA).toContain("update-traffic");
  });

  it("R-P5-12: Gate B has rollback logic", () => {
    // Tests R-P5-12
    expect(gateB).toMatch(/rollback|update-traffic.*100|STABLE_REVISION/i);
    expect(gateB).toContain("update-traffic");
  });

  it("R-P5-12: Gate C has rollback logic", () => {
    // Tests R-P5-12
    expect(gateC).toMatch(/rollback|STABLE_REVISION/i);
    expect(gateC).toContain("update-traffic");
  });
});

// ─── Migration script checks ──────────────────────────────────────────────────

describe("run-production-migrations.sh", () => {
  it("R-P5-13: migration script uses port 3308", () => {
    // Tests R-P5-13
    expect(migration).toContain("3308");
    expect(migration).toMatch(/PROXY_PORT=3308|port.*3308|3308/);
  });

  it("R-P5-14: migration script targets loadpilot-prod instance", () => {
    // Tests R-P5-14
    expect(migration).toContain("loadpilot-prod");
  });

  it("R-P5-15: migration script creates pre-migration backup", () => {
    // Tests R-P5-15
    expect(migration).toMatch(/backup|gcloud sql backups create/i);
    const hasBackupCreate =
      migration.includes("gcloud sql backups create") ||
      migration.includes("pre-migration backup");
    expect(hasBackupCreate).toBe(true);
  });

  it("migration script requires PROD_PROJECT_ID for instance connection", () => {
    expect(migration).toContain("PROD_PROJECT_ID");
    expect(migration).toContain("loadpilot-prod");
  });

  it("migration script uses trucklogix_prod database", () => {
    expect(migration).toContain("trucklogix_prod");
  });
});

// ─── update-traffic usage ─────────────────────────────────────────────────────

describe("Gate scripts use gcloud run services update-traffic", () => {
  it("R-P5-16: Gate A uses update-traffic", () => {
    // Tests R-P5-16
    expect(gateA).toContain("update-traffic");
  });

  it("R-P5-16: Gate B uses update-traffic", () => {
    // Tests R-P5-16
    expect(gateB).toContain("update-traffic");
  });

  it("R-P5-16: Gate C uses update-traffic", () => {
    // Tests R-P5-16
    expect(gateC).toContain("update-traffic");
  });

  it("R-P5-16: Gate D uses update-traffic", () => {
    // Tests R-P5-16
    expect(gateD).toContain("update-traffic");
  });
});

// ─── ROLLOUT_EVIDENCE.md structure ───────────────────────────────────────────

describe("ROLLOUT_EVIDENCE.md structure", () => {
  it("evidence template has Gate A section", () => {
    expect(evidence).toContain("Gate A");
    expect(evidence).toMatch(/Gate A.*5%|5%.*Gate A/is);
  });

  it("evidence template has Gate B section", () => {
    expect(evidence).toContain("Gate B");
    expect(evidence).toMatch(/Gate B.*10%|10%.*Gate B/is);
  });

  it("evidence template has Gate C section", () => {
    expect(evidence).toContain("Gate C");
    expect(evidence).toMatch(/Gate C.*50%|50%.*Gate C/is);
  });

  it("evidence template has Gate D section", () => {
    expect(evidence).toContain("Gate D");
    expect(evidence).toMatch(/Gate D.*100%|100%.*Gate D/is);
  });

  it("evidence template has Rollback Events section", () => {
    expect(evidence).toMatch(/rollback events/i);
  });
});

// ─── Script safety ────────────────────────────────────────────────────────────

describe("Gate scripts use set -euo pipefail", () => {
  it("Gate A uses set -euo pipefail", () => {
    expect(gateA).toContain("set -euo pipefail");
  });

  it("Gate B uses set -euo pipefail", () => {
    expect(gateB).toContain("set -euo pipefail");
  });

  it("Gate C uses set -euo pipefail", () => {
    expect(gateC).toContain("set -euo pipefail");
  });

  it("Gate D uses set -euo pipefail", () => {
    expect(gateD).toContain("set -euo pipefail");
  });

  it("migration script uses set -euo pipefail", () => {
    expect(migration).toContain("set -euo pipefail");
  });
});
