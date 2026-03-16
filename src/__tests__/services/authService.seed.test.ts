// Tests R-P5-07, R-P5-08
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// Read authService source for structural verification
const authSource = fs.readFileSync(
  path.resolve("services/authService.ts"),
  "utf-8",
);

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

  it("imports credentials from fixtures/test-users.json", () => {
    expect(authSource).toContain("fixtures/test-users.json");
  });
});

describe("fixtures/test-users.json existence and gitignore (R-P5-08)", () => {
  it("fixtures/test-users.json exists", () => {
    const fixturePath = path.resolve("fixtures/test-users.json");
    expect(fs.existsSync(fixturePath)).toBe(true);
  });

  it("fixtures/test-users.json is valid JSON", () => {
    const fixturePath = path.resolve("fixtures/test-users.json");
    const content = fs.readFileSync(fixturePath, "utf-8");
    expect(() => JSON.parse(content)).not.toThrow();
  });

  it("fixtures/test-users.json contains expected user keys", () => {
    const fixturePath = path.resolve("fixtures/test-users.json");
    const fixtures = JSON.parse(fs.readFileSync(fixturePath, "utf-8"));
    expect(fixtures).toHaveProperty("admin");
    expect(fixtures).toHaveProperty("dispatcher");
    expect(fixtures).toHaveProperty("drivers");
    expect(Array.isArray(fixtures.drivers)).toBe(true);
    expect(fixtures.drivers.length).toBeGreaterThanOrEqual(1);
  });

  it("fixtures/test-users.json is listed in .gitignore", () => {
    const gitignorePath = path.resolve(".gitignore");
    const gitignore = fs.readFileSync(gitignorePath, "utf-8");
    expect(gitignore).toContain("fixtures/test-users.json");
  });
});
