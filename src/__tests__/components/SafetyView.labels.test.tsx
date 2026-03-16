// Tests R-P1-12
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const source = fs.readFileSync(
  path.resolve("components/SafetyView.tsx"),
  "utf-8",
);

describe("SafetyView.tsx jargon removal (R-P1-12)", () => {
  it('does not contain "Custody Events"', () => {
    expect(source).not.toContain("Custody Events");
  });

  it('does not contain "Service Tickets In Matrix"', () => {
    expect(source).not.toContain("Service Tickets In Matrix");
  });
});
