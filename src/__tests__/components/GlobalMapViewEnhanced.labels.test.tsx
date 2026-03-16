// Tests R-P1-09
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const source = fs.readFileSync(
  path.resolve("components/GlobalMapViewEnhanced.tsx"),
  "utf-8",
);

describe("GlobalMapViewEnhanced.tsx jargon removal (R-P1-09)", () => {
  it('does not contain "Execute Intervention"', () => {
    expect(source).not.toContain("Execute Intervention");
  });

  it('does not contain "RED CIRCLED"', () => {
    expect(source).not.toContain("RED CIRCLED");
  });

  it('does not contain "Regional Intelligence"', () => {
    expect(source).not.toContain("Regional Intelligence");
  });

  it('does not contain "Operational Weather"', () => {
    expect(source).not.toContain("Operational Weather");
  });
});
