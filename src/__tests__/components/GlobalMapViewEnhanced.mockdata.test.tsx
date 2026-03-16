// Tests R-P3-11
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("GlobalMapViewEnhanced: no seed % patterns (R-P3-11)", () => {
  it("contains zero instances of seed % pattern used to generate fake isOnline/lastPing/heading data", () => {
    const filePath = path.resolve(
      __dirname,
      "../../../components/GlobalMapViewEnhanced.tsx",
    );
    const content = fs.readFileSync(filePath, "utf-8");

    // grep for 'seed %' - should return 0 matches
    const matches = content.match(/seed\s*%/g);
    expect(matches).toBeNull();
  });
});
