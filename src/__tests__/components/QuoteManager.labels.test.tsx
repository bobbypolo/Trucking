// Tests R-P1-13
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const source = fs.readFileSync(
  path.resolve("components/QuoteManager.tsx"),
  "utf-8",
);

describe("QuoteManager.tsx jargon removal (R-P1-13)", () => {
  it('does not contain "Queue Empty"', () => {
    expect(source).not.toContain("Queue Empty");
  });
});
