// Tests R-P1-11
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const source = fs.readFileSync(
  path.resolve("components/CommandCenterView.tsx"),
  "utf-8",
);

describe("CommandCenterView.tsx jargon removal (R-P1-11)", () => {
  it('does not contain "Attachment protocol"', () => {
    expect(source).not.toContain("Attachment protocol");
  });

  it('does not contain "operational target"', () => {
    expect(source).not.toContain("operational target");
  });

  it('does not contain "Operations Rack"', () => {
    expect(source).not.toContain("Operations Rack");
  });

  it('does not contain "Triage Inbox"', () => {
    expect(source).not.toContain("Triage Inbox");
  });

  it('does not contain "Asset recovery team activated"', () => {
    expect(source).not.toContain("Asset recovery team activated");
  });
});
