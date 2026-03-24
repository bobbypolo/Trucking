// Tests R-P1-10
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const source = fs.readFileSync(
  path.resolve("components/NetworkPortal.tsx"),
  "utf-8",
);

describe("NetworkPortal.tsx jargon removal (R-P1-10)", () => {
  it('does not contain "Registry PK"', () => {
    expect(source).not.toContain("Registry PK");
  });

  it('does not contain "A/P Engine"', () => {
    expect(source).not.toContain("A/P Engine");
  });

  it('does not render "Constraint Sets" in visible UI text', () => {
    // The phrase may appear in code comments or variable names but should not
    // appear as user-visible UI text. Check each line individually.
    const lines = source.split("\n");
    const uiTextLines = lines.filter(
      (line) =>
        line.includes("Constraint Sets") &&
        !line.trim().startsWith("{/*") && // skip JSX comments
        !line.trim().startsWith("//") && // skip JS comments
        !line.trim().startsWith("*"), // skip block comment lines
    );
    expect(uiTextLines).toEqual([]);
  });

  it('does not contain "Commercial Catalog"', () => {
    expect(source).not.toContain("Commercial Catalog");
  });

  it('does not contain "Operational freedom enabled"', () => {
    expect(source).not.toContain("Operational freedom enabled");
  });

  it('does not contain "authorized personnel registered for this node"', () => {
    expect(source).not.toContain(
      "authorized personnel registered for this node",
    );
  });

  it('does not contain "Compliance vault is empty"', () => {
    expect(source).not.toContain("Compliance vault is empty");
  });
});
