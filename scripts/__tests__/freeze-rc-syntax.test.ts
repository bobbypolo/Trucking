import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// Tests R-P1-01, R-P1-02, R-P1-03, R-P1-04, R-P1-05, R-P1-06, R-P1-07, R-P1-08, R-P1-09

const SCRIPTS_DIR = path.join(__dirname, "../");
const FREEZE_SCRIPT = path.join(SCRIPTS_DIR, "freeze-rc.sh");
const DOCS_DIR = path.join(__dirname, "../../docs/deployment/");
const EVIDENCE_BUNDLE = path.join(DOCS_DIR, "RC_EVIDENCE_BUNDLE.md");

function readScript(filePath: string): string {
  return fs.readFileSync(filePath, "utf8");
}

describe("freeze-rc.sh syntax tests", () => {
  it("R-P1-01: script file exists", () => {
    // Tests R-P1-01
    expect(fs.existsSync(FREEZE_SCRIPT)).toBe(true);
  });

  it("R-P1-02: script creates annotated git tag (contains 'git tag')", () => {
    // Tests R-P1-02
    const content = readScript(FREEZE_SCRIPT);
    const matches = (content.match(/git tag/g) ?? []).length;
    expect(matches).toBeGreaterThanOrEqual(1);
  });

  it("R-P1-03: script captures git SHA via rev-parse", () => {
    // Tests R-P1-03
    const content = readScript(FREEZE_SCRIPT);
    const matches = (content.match(/rev-parse/g) ?? []).length;
    expect(matches).toBeGreaterThanOrEqual(1);
  });

  it("R-P1-04: script references Artifact Registry (docker.pkg.dev or artifacts docker)", () => {
    // Tests R-P1-04
    const content = readScript(FREEZE_SCRIPT);
    const hasArtifactRegistry =
      content.includes("docker.pkg.dev") ||
      content.includes("artifacts docker");
    expect(hasArtifactRegistry).toBe(true);
  });

  it("R-P1-05: script generates RC_EVIDENCE_BUNDLE output", () => {
    // Tests R-P1-05
    const content = readScript(FREEZE_SCRIPT);
    const matches = (content.match(/RC_EVIDENCE_BUNDLE/g) ?? []).length;
    expect(matches).toBeGreaterThanOrEqual(1);
  });

  it("R-P1-06: script validates clean working tree (uses git status or git diff)", () => {
    // Tests R-P1-06
    const content = readScript(FREEZE_SCRIPT);
    const hasCleanCheck =
      content.includes("git status") || content.includes("git diff");
    expect(hasCleanCheck).toBe(true);
  });

  it("R-P1-07: script is idempotent — checks if tag already exists (git tag -l)", () => {
    // Tests R-P1-07
    const content = readScript(FREEZE_SCRIPT);
    const hasIdempotentCheck =
      content.includes("git tag -l") ||
      content.includes("already") ||
      content.includes("tag.*exists");
    expect(hasIdempotentCheck).toBe(true);
  });

  it("R-P1-08: script uses set -euo pipefail for safety", () => {
    // Tests R-P1-08
    const content = readScript(FREEZE_SCRIPT);
    expect(content).toContain("set -euo pipefail");
  });

  it("R-P1-09: script references Firebase Hosting for release capture", () => {
    // Tests R-P1-09: Firebase Hosting release reference
    const content = readScript(FREEZE_SCRIPT);
    const hasFirebase =
      content.includes("firebase") || content.includes("Firebase");
    expect(hasFirebase).toBe(true);
  });
});

describe("RC_EVIDENCE_BUNDLE.md", () => {
  it("R-P1-08: evidence bundle file exists", () => {
    // Tests R-P1-08 (file existence)
    expect(fs.existsSync(EVIDENCE_BUNDLE)).toBe(true);
  });

  it("R-P1-09: evidence bundle references staging evidence documents", () => {
    // Tests R-P1-09
    const content = readScript(EVIDENCE_BUNDLE);
    const hasStaging =
      content.includes("STAGING_EXECUTION_EVIDENCE") ||
      content.includes("ROLLBACK_DRILL_EVIDENCE") ||
      content.includes("GO_NO_GO_CHECKLIST");
    expect(hasStaging).toBe(true);
  });

  it("evidence bundle has release metadata section", () => {
    const content = readScript(EVIDENCE_BUNDLE);
    expect(content).toContain("Release Metadata");
  });

  it("evidence bundle has test suite summary", () => {
    const content = readScript(EVIDENCE_BUNDLE);
    expect(content).toContain("Test Suite Summary");
  });

  it("evidence bundle has sign-off section", () => {
    const content = readScript(EVIDENCE_BUNDLE);
    expect(content).toContain("Sign-Off");
  });

  it("evidence bundle references Docker image / Artifact Registry", () => {
    const content = readScript(EVIDENCE_BUNDLE);
    const hasDockerRef =
      content.includes("docker.pkg.dev") ||
      content.includes("Artifact Registry");
    expect(hasDockerRef).toBe(true);
  });

  it("evidence bundle references open defects (F-004, F-005)", () => {
    const content = readScript(EVIDENCE_BUNDLE);
    expect(content).toContain("F-004");
    expect(content).toContain("F-005");
  });
});
