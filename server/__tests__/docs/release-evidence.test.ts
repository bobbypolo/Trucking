/**
 * Tests R-P7-07: docs/release/evidence.md contains a
 * "## Sales Demo Certification" H2 section.
 *
 * Also spot-checks R-P7-01: the H2 section is positioned so that
 * demo-certify.cjs can append "### <timestamp>" blocks under it
 * (i.e. the H2 actually exists on its own line, not inside a code
 * fence or embedded in another paragraph).
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const EVIDENCE_PATH = path.join(REPO_ROOT, "docs", "release", "evidence.md");

const SALES_DEMO_H2 = "## Sales Demo Certification";

describe("docs/release/evidence.md — R-P7-07", () => {
  it("evidence.md exists", () => {
    expect(fs.existsSync(EVIDENCE_PATH)).toBe(true);
  });

  it("contains the ## Sales Demo Certification H2 heading", () => {
    const body = fs.readFileSync(EVIDENCE_PATH, "utf8");
    expect(body).toContain(SALES_DEMO_H2);
  });

  it("the H2 heading appears on its own line (not inside a paragraph)", () => {
    const body = fs.readFileSync(EVIDENCE_PATH, "utf8");
    const lines = body.split(/\r?\n/);
    const matchingLines = lines.filter((line) => line.trim() === SALES_DEMO_H2);
    expect(matchingLines.length).toBeGreaterThanOrEqual(1);
  });

  it("the H2 heading is not inside a fenced code block", () => {
    const body = fs.readFileSync(EVIDENCE_PATH, "utf8");
    const lines = body.split(/\r?\n/);
    let insideFence = false;
    let foundOutsideFence = false;
    for (const line of lines) {
      if (line.trim().startsWith("```")) {
        insideFence = !insideFence;
        continue;
      }
      if (!insideFence && line.trim() === SALES_DEMO_H2) {
        foundOutsideFence = true;
        break;
      }
    }
    expect(foundOutsideFence).toBe(true);
  });
});
