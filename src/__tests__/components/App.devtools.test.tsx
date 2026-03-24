// Tests R-P2-02, R-P2-03
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// Read App.tsx source directly — avoids rendering the full App component
// with Firebase, routing, and auth dependencies.
const appSource = fs.readFileSync(path.resolve("App.tsx"), "utf-8");
const featuresSource = fs.readFileSync(
  path.resolve("config/features.ts"),
  "utf-8",
);

describe("App.tsx api-tester removed from production nav (NAV-06)", () => {
  it("imports features from config/features", () => {
    expect(appSource).toMatch(/from\s+["'].*config\/features["']/);
  });

  it("api-tester nav item is not in the categories array", () => {
    const categoryBlock = appSource.slice(
      appSource.indexOf("const categories: NavCategory[]"),
      appSource.indexOf("const filteredCategories"),
    );
    expect(categoryBlock).not.toContain('"api-tester"');
  });

  it("features.apiTester is false in production (import.meta.env.DEV)", () => {
    expect(featuresSource).toContain("apiTester: import.meta.env.DEV");
  });
});

describe("App.tsx seedDatabase gating (R-P2-03)", () => {
  it("imports features from config/features (confirmed)", () => {
    expect(appSource).toMatch(/from\s+["'].*config\/features["']/);
  });

  it("seedDatabase call is wrapped in a features.seedSystem guard", () => {
    expect(appSource).toMatch(/features\.seedSystem/);
  });

  it("features.seedSystem is false in production (import.meta.env.DEV)", () => {
    expect(featuresSource).toContain("seedSystem: import.meta.env.DEV");
  });

  it("seedDatabase is still imported/called in source (conditionally)", () => {
    // seedDatabase must still be in the file — just gated
    expect(appSource).toContain("seedDatabase");
  });

  it("features.seedSystem guard appears before seedDatabase() call in source", () => {
    const guardIdx = appSource.indexOf("features.seedSystem");
    const seedIdx = appSource.indexOf("seedDatabase()");
    expect(guardIdx).toBeGreaterThanOrEqual(0);
    expect(seedIdx).toBeGreaterThanOrEqual(0);
    expect(guardIdx).toBeLessThanOrEqual(seedIdx);
  });
});
