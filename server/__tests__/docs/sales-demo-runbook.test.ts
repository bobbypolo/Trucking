/**
 * Tests R-P6-07 + R-P6-09: docs/sales-demo-runbook.md required H2
 * sections and server/index.ts diff line-cap.
 *
 * R-P6-07: assert all 8 required H2 sections appear in the runbook
 * exactly as specified by the BSD plan.
 *
 * R-P6-09: assert that the working-tree diff of server/index.ts vs
 * the merge-base with origin/main has exactly 2 added lines and 0
 * removed lines (the import statement + the conditional mount).
 */
import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const RUNBOOK_PATH = path.join(REPO_ROOT, "docs", "sales-demo-runbook.md");

const REQUIRED_H2_SECTIONS = [
  "## Two Chrome profiles",
  "## Setting demo nav mode (.env.local)",
  "## Resetting between demos",
  "## Recovery from accidental URL",
  "## Firebase user provisioning prerequisite",
  "## Live Gemini disclaimer",
  "## Certified Core demo script (6 steps)",
  "## Wow Appendix — Optional live driver upload",
];

describe("docs/sales-demo-runbook.md — R-P6-07 (8 required H2 sections)", () => {
  it("R-P6-07: runbook file exists at docs/sales-demo-runbook.md", () => {
    expect(fs.existsSync(RUNBOOK_PATH)).toBe(true);
  });

  it("R-P6-07: runbook contains all 8 required H2 sections", () => {
    const src = fs.readFileSync(RUNBOOK_PATH, "utf-8");
    // Build the set of H2 lines actually present in the runbook so we
    // verify each required heading appears as a real H2 (line that
    // starts with "## ") rather than body text.
    const actualH2Lines = new Set(
      src
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.startsWith("## ")),
    );
    const missing = REQUIRED_H2_SECTIONS.filter(
      (heading) => !actualH2Lines.has(heading),
    );
    expect(missing).toEqual([]);
  });

  it("R-P6-07: required headings appear in the documented order", () => {
    const src = fs.readFileSync(RUNBOOK_PATH, "utf-8");
    let cursor = 0;
    for (const heading of REQUIRED_H2_SECTIONS) {
      const idx = src.indexOf(heading, cursor);
      expect(idx).toBeGreaterThanOrEqual(cursor);
      cursor = idx + heading.length;
    }
  });
});

function gitDiffNumstat(file: string): { added: number; removed: number } {
  // Compare against the merge-base with origin/main so the line-cap is
  // measured against the BSD branch base, not the working-tree base.
  let baseRef = "origin/main";
  try {
    const candidate = execSync(`git merge-base origin/main HEAD`, {
      cwd: REPO_ROOT,
      encoding: "utf-8",
    }).trim();
    if (candidate) baseRef = candidate;
  } catch {
    // Fallback to origin/main directly if merge-base fails (detached, etc.)
  }
  const out = execSync(`git diff --numstat ${baseRef} -- ${file}`, {
    cwd: REPO_ROOT,
    encoding: "utf-8",
  }).trim();
  if (!out) return { added: 0, removed: 0 };
  const [added, removed] = out.split(/\s+/);
  return { added: Number(added), removed: Number(removed) };
}

describe("server/index.ts diff line-cap — R-P6-09 (exactly 2 added lines)", () => {
  it("R-P6-09: server/index.ts has exactly 2 added lines and 0 removed lines vs merge-base", () => {
    const stat = gitDiffNumstat("server/index.ts");
    expect(stat.added).toBe(2);
    expect(stat.removed).toBe(0);
  });
});
