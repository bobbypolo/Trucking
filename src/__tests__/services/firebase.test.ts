// Tests R-P1-03
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// Read the source file to verify the implementation pattern
const source = fs.readFileSync(path.resolve("services/firebase.ts"), "utf-8");

describe("services/firebase.ts DEMO_MODE hardening (R-P1-03)", () => {
  it("DEMO_MODE condition includes import.meta.env.MODE !== 'production'", () => {
    expect(source).toMatch(
      /import\.meta\.env\.MODE\s*!==\s*['"]production['"]/,
    );
  });

  it("DEMO_MODE condition includes import.meta.env.DEV", () => {
    expect(source).toMatch(/import\.meta\.env\.DEV/);
  });

  it("production guard exists: throws if PROD && DEMO_MODE", () => {
    expect(source).toMatch(/import\.meta\.env\.PROD\s*&&\s*DEMO_MODE/);
    expect(source).toMatch(/throw new Error/);
  });

  it("DEMO_MODE is defined with MODE !== production guard in the condition", () => {
    // Verify the full pattern: DEV && !apiKey && MODE !== 'production'
    expect(source).toMatch(
      /DEMO_MODE\s*=[\s\S]*?import\.meta\.env\.DEV[\s\S]*?!firebaseConfig\.apiKey[\s\S]*?import\.meta\.env\.MODE\s*!==\s*['"]production['"]/,
    );
  });

  it("production guard throws Error with clear message", () => {
    expect(source).toContain("DEMO_MODE cannot be active in production");
  });
});
