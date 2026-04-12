import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Source-grep tests for TriageWorkspacePanel.tsx contrast / sizing / background
 * fixes. These verify the class strings in the source file directly rather than
 * rendering the component, because the component takes 16+ props and has a
 * deeply nested JSX tree — grep-verifying the source is faster, deterministic,
 * and matches the acceptance criteria wording ("source contains 0 instances").
 */

const PANEL_PATH = resolve(
  __dirname,
  "../../../components/operations/TriageWorkspacePanel.tsx",
);

function readPanel(): string {
  return readFileSync(PANEL_PATH, "utf-8");
}

describe("TriageWorkspacePanel contrast / sizing / background", () => {
  // Tests R-P1-03
  it("contains 0 instances of opacity-60 on text elements", () => {
    const src = readPanel();
    // Match any use of opacity-60 inside a className string.
    const matches = src.match(/opacity-60/g) ?? [];
    expect(matches.length).toBe(0);
  });

  // Tests R-P1-03
  it("contains 0 instances of opacity-70 on text elements", () => {
    const src = readPanel();
    const matches = src.match(/opacity-70/g) ?? [];
    expect(matches.length).toBe(0);
  });

  // Tests R-P1-04
  it("uses text-slate-400 for inactive tab classes, not text-slate-600", () => {
    const src = readPanel();
    // The inactive-tab ternary must reference text-slate-400.
    expect(src).toContain("text-slate-400");
    // And must NOT use text-slate-600 for tab inactive state in the
    // persistent-triage tab ternary:
    //   activeTriageTab === tab.id ? "text-blue-500 ..." : "text-slate-400 ..."
    const inactiveTabRegex =
      /activeTriageTab === tab\.id[^}]*"text-blue-500[^"]*"[^}]*"text-slate-400[^"]*"/s;
    expect(src).toMatch(inactiveTabRegex);
    // And the tab ternary must not mention text-slate-600 on its inactive branch.
    const tabBlockRegex = /activeTriageTab === tab\.id[^}]*:\s*"([^"]*)"/s;
    const tabMatch = src.match(tabBlockRegex);
    expect(tabMatch).not.toBeNull();
    if (tabMatch) {
      expect(tabMatch[1]).not.toContain("text-slate-600");
      expect(tabMatch[1]).toContain("text-slate-400");
    }
  });

  // Tests R-P1-10
  it("uses bg-white/[0.08] for the header panel background (not bg-white/[0.03])", () => {
    const src = readPanel();
    // Header panel must reference bg-white/[0.08] at least once.
    expect(src).toContain("bg-white/[0.08]");
    // The specific header block (p-5 border-b ... bg-white/[0.08]) must match.
    const headerBlockRegex =
      /p-5 border-b border-white\/5 bg-white\/\[0\.08\] backdrop-blur-lg/;
    expect(src).toMatch(headerBlockRegex);
  });
});
