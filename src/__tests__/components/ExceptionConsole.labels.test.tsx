// Tests R-P1-07
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const source = fs.readFileSync(
  path.resolve("components/ExceptionConsole.tsx"),
  "utf-8",
);

describe("ExceptionConsole.tsx jargon removal (R-P1-07)", () => {
  it('does not contain "Master Triage Console"', () => {
    expect(source).not.toContain("Master Triage Console");
  });

  it('does not contain "Unified Exception Management"', () => {
    expect(source).not.toContain("Unified Exception Management");
  });

  it('does not contain "View 360"', () => {
    expect(source).not.toContain("View 360");
  });

  it('does not contain "SLA targets are within safe margins"', () => {
    expect(source).not.toContain("SLA targets are within safe margins");
  });
});
