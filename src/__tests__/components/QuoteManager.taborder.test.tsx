import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Source-grep tests for QuoteManager.tsx tab-order and button-sizing fixes.
 * These assert against the source to avoid mocking the storageService and
 * rendering a full pipeline view.
 */

const QUOTE_MANAGER_PATH = resolve(
  __dirname,
  "../../../components/QuoteManager.tsx",
);

function readQuoteManager(): string {
  return readFileSync(QUOTE_MANAGER_PATH, "utf-8");
}

describe("QuoteManager tab order & button sizing", () => {
  // Tests R-P1-07
  it('default activeView state is "intake"', () => {
    const src = readQuoteManager();
    // The useState call must initialize to "intake".
    const useStateRegex =
      /useState<\s*"pipeline"\s*\|\s*"details"\s*\|\s*"intake"\s*>\s*\(\s*"intake"\s*\)/;
    expect(src).toMatch(useStateRegex);
  });

  // Tests R-P1-07
  it("Intake Desk button renders before Pipeline View in source order", () => {
    const src = readQuoteManager();
    const intakeIdx = src.indexOf("Intake Desk");
    const pipelineIdx = src.indexOf("Pipeline View");
    expect(intakeIdx).toBeGreaterThan(-1);
    expect(pipelineIdx).toBeGreaterThan(-1);
    expect(intakeIdx).toBeLessThan(pipelineIdx);
  });

  // Tests R-P1-06
  it("contains 0 instances of text-[10px] on the tab buttons (Pipeline View / Intake Desk)", () => {
    const src = readQuoteManager();
    // Find the Pipeline View button className and verify it is text-[11px].
    const pipelineIdx = src.indexOf("Pipeline View");
    const intakeIdx = src.indexOf("Intake Desk");
    expect(pipelineIdx).toBeGreaterThan(-1);
    expect(intakeIdx).toBeGreaterThan(-1);

    // For each tab label, scan back at most 400 chars for the nearest
    // className string and assert it does NOT contain text-[10px].
    const slicePipeline = src.slice(
      Math.max(0, pipelineIdx - 400),
      pipelineIdx,
    );
    const pipelineClassMatch = slicePipeline.match(
      /className=\{?[^{}]*text-\[[0-9]+px\][^{}]*\}?/g,
    )?.[0]
      ? slicePipeline.match(/className=\{?[^{}]*text-\[[0-9]+px\][^{}]*\}?/g)
      : null;
    expect(pipelineClassMatch).not.toBeNull();
    if (pipelineClassMatch) {
      expect(pipelineClassMatch[0]).toContain("text-[11px]");
      expect(pipelineClassMatch[0]).not.toContain("text-[10px]");
    }

    const sliceIntake = src.slice(Math.max(0, intakeIdx - 400), intakeIdx);
    const intakeClassMatch = sliceIntake.match(
      /className=\{?[^{}]*text-\[[0-9]+px\][^{}]*\}?/g,
    )?.[0]
      ? sliceIntake.match(/className=\{?[^{}]*text-\[[0-9]+px\][^{}]*\}?/g)
      : null;
    expect(intakeClassMatch).not.toBeNull();
    if (intakeClassMatch) {
      expect(intakeClassMatch[0]).toContain("text-[11px]");
      expect(intakeClassMatch[0]).not.toContain("text-[10px]");
    }
  });
});
