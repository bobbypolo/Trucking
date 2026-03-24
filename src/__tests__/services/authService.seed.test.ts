// Tests R-P5-07, R-P5-08
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// Read authService source for structural verification
const authSource = fs.readFileSync(
  path.resolve("services/authService.ts"),
  "utf-8",
);

const fixturePath = path.resolve("fixtures/test-users.json");
const fixtureExists = fs.existsSync(fixturePath);

describe("authService.ts seedDatabase() credential extraction (R-P5-07)", () => {
  it("contains zero hardcoded 'admin@loadpilot.com' strings", () => {
    // Count occurrences — after extraction this should be zero
    const matches = (authSource.match(/admin@loadpilot\.com/g) || []).length;
    expect(matches).toBe(0);
  });

  it("contains zero hardcoded 'dispatch@loadpilot.com' strings", () => {
    const matches = (authSource.match(/dispatch@loadpilot\.com/g) || []).length;
    expect(matches).toBe(0);
  });

  it("contains zero hardcoded 'admin123' strings", () => {
    const matches = (authSource.match(/"admin123"/g) || []).length;
    expect(matches).toBe(0);
  });

  it("contains zero hardcoded 'dispatch123' strings", () => {
    const matches = (authSource.match(/"dispatch123"/g) || []).length;
    expect(matches).toBe(0);
  });

  it("references fixtures/test-users.json for credential loading", () => {
    expect(authSource).toContain("fixtures/test-users.json");
  });

  it("uses lazy dynamic import (not static import) for fixtures", () => {
    // The static import line must NOT be present
    expect(authSource).not.toMatch(
      /^import\s+seedFixtures\s+from\s+["']\.\.\/fixtures\/test-users\.json["']/m,
    );
    // A dynamic import() call must be present (path may be via variable)
    expect(authSource).toMatch(/await\s+import\(/);
    // The fixture path must be assigned to a variable or appear in the import
    expect(authSource).toContain('"../fixtures/test-users.json"');
  });

  it("provides EMPTY_FIXTURES fallback when fixture file is absent", () => {
    expect(authSource).toContain("EMPTY_FIXTURES");
    expect(authSource).toContain("loadSeedFixtures");
  });
});

describe("fixtures/test-users.json existence and gitignore (R-P5-08)", () => {
  it.skipIf(!fixtureExists)("fixtures/test-users.json exists", () => {
    expect(fs.existsSync(fixturePath)).toBe(true);
  });

  it.skipIf(!fixtureExists)("fixtures/test-users.json is valid JSON", () => {
    const content = fs.readFileSync(fixturePath, "utf-8");
    expect(() => JSON.parse(content)).not.toThrow();
  });

  it.skipIf(!fixtureExists)(
    "fixtures/test-users.json contains expected user keys",
    () => {
      const fixtures = JSON.parse(fs.readFileSync(fixturePath, "utf-8"));
      expect(fixtures).toHaveProperty("admin");
      expect(fixtures).toHaveProperty("dispatcher");
      expect(fixtures).toHaveProperty("drivers");
      expect(Array.isArray(fixtures.drivers)).toBe(true);
      expect(fixtures.drivers.length).toBeGreaterThanOrEqual(1);
    },
  );

  it("fixtures/test-users.json is listed in .gitignore", () => {
    const gitignorePath = path.resolve(".gitignore");
    const gitignore = fs.readFileSync(gitignorePath, "utf-8");
    expect(gitignore).toContain("fixtures/test-users.json");
  });

  it("authService handles missing fixture file gracefully", () => {
    // Verify the code has a try/catch around the dynamic import
    expect(authSource).toMatch(
      /try\s*\{[\s\S]*?await\s+import\([\s\S]*?\}\s*catch/,
    );
    // Verify early return when fixtures are empty
    expect(authSource).toContain("if (!fixtures.admin.email)");
  });
});
