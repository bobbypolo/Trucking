// Tests R-P1-06
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const source = fs.readFileSync(
  path.resolve("components/Dashboard.tsx"),
  "utf-8",
);

describe("Dashboard.tsx jargon removal (R-P1-06)", () => {
  it('does not contain "Unified Command Center"', () => {
    expect(source).not.toContain("Unified Command Center");
  });

  it('does not contain "Strategy & Analytics"', () => {
    expect(source).not.toContain("Strategy & Analytics");
  });

  it('does not contain "Master Triage Feed"', () => {
    expect(source).not.toContain("Master Triage Feed");
  });

  it('does not contain "Functional Response"', () => {
    expect(source).not.toContain("Functional Response");
  });

  it('does not contain "Fleet Situational Awareness"', () => {
    expect(source).not.toContain("Fleet Situational Awareness");
  });
});
