// Tests R-P5-04
import { describe, it, expect } from "vitest";
import { glossary } from "../../../data/truckingGlossary";

const REQUIRED_TERMS = [
  "IFTA",
  "BOL",
  "POD",
  "RPM",
  "HOS",
  "ELD",
  "MC",
  "DOT",
  "TONU",
  "LUMPER",
  "DETENTION",
  "DEADHEAD",
  "ACCESSORIAL",
];

describe("data/truckingGlossary.ts (R-P5-04)", () => {
  it("exports a glossary object", () => {
    expect(glossary).toBeDefined();
    expect(typeof glossary).toBe("object");
  });

  it("has at least 25 entries", () => {
    const count = Object.keys(glossary).length;
    expect(count).toBeGreaterThanOrEqual(25);
  });

  it.each(REQUIRED_TERMS)("contains required term: %s", (term) => {
    expect(glossary).toHaveProperty(term);
    expect(typeof glossary[term]).toBe("string");
    expect(glossary[term].length).toBeGreaterThan(0);
  });

  it("all definitions are non-empty strings", () => {
    for (const [key, value] of Object.entries(glossary)) {
      expect(typeof value, `definition for ${key}`).toBe("string");
      expect(
        value.length,
        `definition for ${key} should not be empty`,
      ).toBeGreaterThan(0);
    }
  });

  it("all keys are uppercase strings", () => {
    for (const key of Object.keys(glossary)) {
      expect(key, `key ${key} should be uppercase`).toBe(key.toUpperCase());
    }
  });
});
