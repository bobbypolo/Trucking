// Tests R-S31-01, R-S31-02
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const source = fs.readFileSync(
  path.resolve("components/AccountingPortal.tsx"),
  "utf-8",
);

describe("AccountingPortal.tsx honest tracking labels (R-S31-01, R-S31-02)", () => {
  it('does not contain misleading "Real-Time Load P&L" heading', () => {
    expect(source).not.toContain("Real-Time Load P&L");
  });

  it('uses honest "Load P&L" heading instead', () => {
    expect(source).toContain("Load P&L");
  });
});
