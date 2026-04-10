/**
 * Tests R-P6-07 + R-P6-09: docs/sales-demo-runbook.md required H2
 * sections and server/index.ts demo-router mount.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const RUNBOOK_PATH = path.join(REPO_ROOT, "docs", "sales-demo-runbook.md");

const REQUIRED_H2_SECTIONS = [
  "## Two Chrome profiles",
  "## Setting demo nav mode (.env.local)",
  "## Launching the demo host",
  "## Resetting between demos",
  "## Recovery from accidental URL",
  "## Firebase user provisioning prerequisite",
  "## Live Gemini disclaimer",
  "## Certified Core demo script (6 steps)",
];

function hasWowAppendixHeading(src: string): boolean {
  return (
    src.includes("## Wow Appendix") &&
    src.includes("Optional live driver upload")
  );
}

describe("docs/sales-demo-runbook.md - R-P6-07", () => {
  it("R-P6-07: runbook file exists at docs/sales-demo-runbook.md", () => {
    expect(fs.existsSync(RUNBOOK_PATH)).toBe(true);
  });

  it("R-P6-07: runbook contains all 9 required H2 sections", () => {
    const src = fs.readFileSync(RUNBOOK_PATH, "utf-8");

    for (const heading of REQUIRED_H2_SECTIONS) {
      expect(src).toContain(heading);
    }
    expect(hasWowAppendixHeading(src)).toBe(true);
  });

  it("R-P6-07: required headings appear in the documented order", () => {
    const src = fs.readFileSync(RUNBOOK_PATH, "utf-8");
    let cursor = 0;
    for (const heading of REQUIRED_H2_SECTIONS) {
      const idx = src.indexOf(heading, cursor);
      expect(idx).toBeGreaterThanOrEqual(cursor);
      cursor = idx + heading.length;
    }

    const wowIdx = src.indexOf("## Wow Appendix", cursor);
    expect(wowIdx).toBeGreaterThanOrEqual(cursor);
    expect(src.indexOf("Optional live driver upload", wowIdx)).toBeGreaterThanOrEqual(
      wowIdx,
    );
  });
});

describe("server/index.ts demo router contract - R-P6-09", () => {
  const SERVER_INDEX_PATH = path.join(REPO_ROOT, "server", "index.ts");

  it("R-P6-09: server/index.ts contains the demo router import line", () => {
    const src = fs.readFileSync(SERVER_INDEX_PATH, "utf-8");
    expect(src).toMatch(
      /^import\s+demoRouter\s+from\s+["']\.\/routes\/demo["']\s*;?\s*$/m,
    );
  });

  it("R-P6-09: server/index.ts mounts the demo router only when ALLOW_DEMO_RESET=1", () => {
    const src = fs.readFileSync(SERVER_INDEX_PATH, "utf-8");
    expect(src).toMatch(
      /process\.env\.ALLOW_DEMO_RESET\s*===\s*["']1["'][\s\S]{0,100}app\.use\([^)]*demoRouter/,
    );
  });
});
