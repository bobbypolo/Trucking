// Tests R-P4-04
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const source = fs.readFileSync(
  path.resolve("components/DriverMobileHome.tsx"),
  "utf-8",
);

describe("DriverMobileHome text size accessibility (R-P4-04)", () => {
  it("has zero instances of text-[8px] in body text", () => {
    const matches = source.match(/text-\[8px\]/g);
    expect(
      matches,
      "Found text-[8px] classes — all body text must be at least text-xs (12px)",
    ).toBeNull();
  });

  it("has zero instances of text-[9px] in body text", () => {
    const matches = source.match(/text-\[9px\]/g);
    expect(
      matches,
      "Found text-[9px] classes — all body text must be at least text-xs (12px)",
    ).toBeNull();
  });

  it("has zero instances of text-[10px] in body text", () => {
    const matches = source.match(/text-\[10px\]/g);
    expect(
      matches,
      "Found text-[10px] classes — all body text must be at least text-xs (12px)",
    ).toBeNull();
  });
});
