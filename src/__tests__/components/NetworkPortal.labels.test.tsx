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

  it('does not contain "Constraint Sets"', () => {
    expect(source).not.toContain("Constraint Sets");
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
