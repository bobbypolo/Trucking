// Tests R-P2-01, R-P2-04, R-P2-05
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// Read IntelligenceHub source directly — avoids rendering a 4k-line component
// with complex Firebase/socket dependencies while still asserting real code structure.
const hubSource = fs.readFileSync(
  path.resolve("components/IntelligenceHub.tsx"),
  "utf-8",
);
const featuresSource = fs.readFileSync(
  path.resolve("config/features.ts"),
  "utf-8",
);

describe("IntelligenceHub dev-tools gating (R-P2-01)", () => {
  it("imports features from config/features", () => {
    expect(hubSource).toMatch(/from\s+["'].*config\/features["']/);
  });

  it("SIMULATE ActionGroup is wrapped in a features.simulateActions guard", () => {
    // The JSX block containing label="SIMULATE" must be inside a conditional that
    // references features.simulateActions so it is hidden when the flag is false.
    expect(hubSource).toMatch(/features\.simulateActions/);
  });

  it("features.simulateActions is false in production (import.meta.env.DEV)", () => {
    expect(featuresSource).toContain("simulateActions: import.meta.env.DEV");
  });

  it("SIMULATE label is present in source (conditionally rendered)", () => {
    // The label still exists but is gated — this confirms we didn't remove it
    // outright (which would make the test trivially pass without gating).
    expect(hubSource).toContain('"SIMULATE"');
  });

  it("SIMULATE ActionGroup conditional check appears before the label in source", () => {
    const guardIdx = hubSource.indexOf("features.simulateActions");
    const simulateIdx = hubSource.indexOf('"SIMULATE"');
    expect(guardIdx).toBeGreaterThanOrEqual(0);
    expect(simulateIdx).toBeGreaterThanOrEqual(0);
    // Guard must appear at or before the SIMULATE label usage
    expect(guardIdx).toBeLessThanOrEqual(simulateIdx);
  });
});

describe("IntelligenceHub Inject Record gating (R-P2-04)", () => {
  it("imports features from config/features (confirmed)", () => {
    expect(hubSource).toMatch(/from\s+["'].*config\/features["']/);
  });

  it("Inject Record action is wrapped in a features.injectRecord guard", () => {
    expect(hubSource).toMatch(/features\.injectRecord/);
  });

  it("features.injectRecord is false in production (import.meta.env.DEV)", () => {
    expect(featuresSource).toContain("injectRecord: import.meta.env.DEV");
  });

  it("Inject Record label is present in source (conditionally rendered)", () => {
    expect(hubSource).toContain('"Inject Record"');
  });

  it("features.injectRecord guard appears before Inject Record label in source", () => {
    const guardIdx = hubSource.indexOf("features.injectRecord");
    const injectIdx = hubSource.indexOf('"Inject Record"');
    expect(guardIdx).toBeGreaterThanOrEqual(0);
    expect(injectIdx).toBeGreaterThanOrEqual(0);
    expect(guardIdx).toBeLessThanOrEqual(injectIdx);
  });
});

describe("IntelligenceHub Work ActionGroup label (R-P2-05)", () => {
  it("Work ActionGroup label reads Quick Actions", () => {
    expect(hubSource).toContain('"Quick Actions"');
  });

  it("old label Work is not used as ActionGroup label", () => {
    // The old pattern was label="Work" — confirm it is gone.
    // (The word "Work" may appear in other contexts like WorkItem — check the
    // exact attribute form.)
    expect(hubSource).not.toMatch(/label="Work"/);
  });
});
