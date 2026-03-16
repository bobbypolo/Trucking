// Tests R-P1-02
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// Read source to verify structural requirements
const source = fs.readFileSync(path.resolve("config/features.ts"), "utf-8");

describe("config/features.ts (R-P1-02)", () => {
  it("exports features object", () => {
    expect(source).toContain("export const features");
  });

  it("has simulateActions key gated on import.meta.env.DEV", () => {
    expect(source).toContain("simulateActions");
    expect(source).toMatch(/simulateActions:\s*import\.meta\.env\.DEV/);
  });

  it("has apiTester key gated on import.meta.env.DEV", () => {
    expect(source).toContain("apiTester");
    expect(source).toMatch(/apiTester:\s*import\.meta\.env\.DEV/);
  });

  it("has seedSystem key gated on import.meta.env.DEV", () => {
    expect(source).toContain("seedSystem");
    expect(source).toMatch(/seedSystem:\s*import\.meta\.env\.DEV/);
  });

  it("has injectRecord key gated on import.meta.env.DEV", () => {
    expect(source).toContain("injectRecord");
    expect(source).toMatch(/injectRecord:\s*import\.meta\.env\.DEV/);
  });

  it("has debugPanels key gated on import.meta.env.DEV", () => {
    expect(source).toContain("debugPanels");
    expect(source).toMatch(/debugPanels:\s*import\.meta\.env\.DEV/);
  });

  it("all 5 required keys are present", () => {
    const requiredKeys = [
      "simulateActions",
      "apiTester",
      "seedSystem",
      "injectRecord",
      "debugPanels",
    ];
    for (const key of requiredKeys) {
      expect(source).toContain(key);
    }
  });
});
