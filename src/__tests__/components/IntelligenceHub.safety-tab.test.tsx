import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Source-grep tests for IntelligenceHub.tsx SAFETY tab addition, ExceptionConsole
 * wiring for selectedTab === "safety", and tab button sizing.
 *
 * IntelligenceHub is ~2000 lines and mocks 30+ services — full rendering would
 * be untenable for these narrow class/string assertions. Source grepping
 * directly matches the acceptance criteria wording.
 */

const HUB_PATH = resolve(__dirname, "../../../components/IntelligenceHub.tsx");

function readHub(): string {
  return readFileSync(HUB_PATH, "utf-8");
}

describe("IntelligenceHub SAFETY tab & ExceptionConsole wiring", () => {
  // Tests R-P1-08
  it('tab array includes { label: "SAFETY", tab: "safety" } after COMMAND', () => {
    const src = readHub();
    // Must contain the exact literal.
    expect(src).toContain('{ label: "SAFETY", tab: "safety" }');
    // And the SAFETY entry must appear AFTER the COMMAND entry.
    const commandIdx = src.indexOf('{ label: "COMMAND"');
    const safetyIdx = src.indexOf('{ label: "SAFETY"');
    expect(commandIdx).toBeGreaterThan(-1);
    expect(safetyIdx).toBeGreaterThan(-1);
    expect(safetyIdx).toBeGreaterThan(commandIdx);
    // And SAFETY must come IMMEDIATELY after COMMAND (nothing between them in
    // the tab array other than the next-line plus optional whitespace/comma).
    const between = src.slice(commandIdx, safetyIdx);
    // Only COMMAND line and trailing comma/whitespace allowed between.
    expect(between.split("\n").length).toBeLessThanOrEqual(3);
  });

  // Tests R-P1-09
  it('imports ExceptionConsole and renders it with initialView="safety" when selectedTab === "safety"', () => {
    const src = readHub();
    // Must import ExceptionConsole.
    const importRegex =
      /import\s*\{[^}]*\bExceptionConsole\b[^}]*\}\s*from\s*['"][^'"]*ExceptionConsole['"]/;
    expect(src).toMatch(importRegex);

    // Must render <ExceptionConsole initialView="safety" /> under the
    // selectedTab === "safety" branch.
    const safetyBranchRegex =
      /selectedTab === "safety"[\s\S]{0,400}<ExceptionConsole[^>]*initialView=\{?["']safety["']\}?/;
    expect(src).toMatch(safetyBranchRegex);
  });

  // Tests R-P1-06
  it("tab chip buttons use text-[11px], not text-[10px]", () => {
    const src = readHub();
    // Find the tab chip button className — it references
    // "border-blue-400/50" and "text-blue-400" selected state.
    // There is exactly one such className template in the chip map.
    const chipClassRegex =
      /className=\{?`text-\[\d+px\] font-black uppercase tracking-widest transition-all border-b pb-1/;
    const chipMatch = src.match(chipClassRegex);
    expect(chipMatch).not.toBeNull();
    if (chipMatch) {
      expect(chipMatch[0]).toContain("text-[11px]");
      expect(chipMatch[0]).not.toContain("text-[10px]");
    }
  });
});
