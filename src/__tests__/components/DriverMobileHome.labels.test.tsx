// Tests R-P1-05
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const source = fs.readFileSync(
  path.resolve("components/DriverMobileHome.tsx"),
  "utf-8",
);

describe("DriverMobileHome.tsx jargon removal (R-P1-05)", () => {
  it('does not contain "TruckLogix"', () => {
    expect(source).not.toContain("TruckLogix");
  });

  it('does not contain "Fleet Connect"', () => {
    expect(source).not.toContain("Fleet Connect");
  });

  it('does not contain "Standby Mode Initialized"', () => {
    expect(source).not.toContain("Standby Mode Initialized");
  });

  it('does not contain "Sign Out Authority"', () => {
    expect(source).not.toContain("Sign Out Authority");
  });
});
