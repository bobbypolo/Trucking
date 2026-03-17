// Tests R-P1-14, R-S31-01, R-S31-02
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const source = fs.readFileSync(
  path.resolve("components/CustomerPortalView.tsx"),
  "utf-8",
);

describe("CustomerPortalView.tsx jargon removal (R-P1-14)", () => {
  it('does not contain "Voyage Progress"', () => {
    expect(source).not.toContain("Voyage Progress");
  });

  it('does not contain "Tracking Master-ID"', () => {
    expect(source).not.toContain("Tracking Master-ID");
  });
});

describe("CustomerPortalView.tsx honest tracking labels (R-S31-01, R-S31-02)", () => {
  it('does not contain misleading "View Live Track" button label', () => {
    expect(source).not.toContain("View Live Track");
  });

  it('uses honest "View Tracking" label instead', () => {
    expect(source).toContain("View Tracking");
  });
});
