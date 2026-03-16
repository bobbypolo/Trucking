// Tests R-P1-08
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const source = fs.readFileSync(
  path.resolve("components/LoadBoardEnhanced.tsx"),
  "utf-8",
);

describe("LoadBoardEnhanced.tsx jargon removal (R-P1-08)", () => {
  it('does not contain "SQL Matrix View"', () => {
    expect(source).not.toContain("SQL Matrix View");
  });

  it('does not contain "Manifest #" as column label', () => {
    expect(source).not.toContain("Manifest #");
  });

  it('does not contain "Yield" as column label', () => {
    // Check it is not used as column label text (label: 'Yield' or >Yield<)
    expect(source).not.toMatch(/label:\s*['"]Yield['"]/);
    expect(source).not.toMatch(/>Yield</);
  });

  it('does not contain "IFTA INTEL"', () => {
    expect(source).not.toContain("IFTA INTEL");
  });

  it('does not contain "Grid Visibility"', () => {
    expect(source).not.toContain("Grid Visibility");
  });

  it('does not contain "View Tailoring"', () => {
    expect(source).not.toContain("View Tailoring");
  });
});
