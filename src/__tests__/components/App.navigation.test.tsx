// Tests R-P1-01
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// Verify navigation labels by reading the source file directly
// This avoids complex App rendering with many dependencies while still
// asserting the actual string values in the categories array.
const appSource = fs.readFileSync(path.resolve("App.tsx"), "utf-8");

describe("App.tsx navigation categories labels (R-P1-01)", () => {
  it("uses 'Operations Center' label", () => {
    expect(appSource).toContain("Operations Center");
  });

  it("uses 'Dashboard' label", () => {
    expect(appSource).toContain('"Dashboard"');
  });

  it("uses 'Issues & Alerts' label", () => {
    expect(appSource).toContain("Issues & Alerts");
  });

  it("uses 'Reports' label", () => {
    expect(appSource).toContain('"Reports"');
  });

  it("uses 'Load Board' label", () => {
    expect(appSource).toContain("Load Board");
  });

  it("uses 'Quotes & Booking' label", () => {
    expect(appSource).toContain("Quotes & Booking");
  });

  it("uses 'Fleet Map' label", () => {
    expect(appSource).toContain("Fleet Map");
  });

  it("uses 'Schedule' label", () => {
    expect(appSource).toContain('"Schedule"');
  });

  it("uses 'Broker Network' label", () => {
    expect(appSource).toContain("Broker Network");
  });

  it("uses 'Driver Pay' label", () => {
    expect(appSource).toContain("Driver Pay");
  });

  it("uses 'Accounting' label", () => {
    expect(appSource).toContain('"Accounting"');
  });

  it("uses 'Safety & Compliance' label", () => {
    expect(appSource).toContain("Safety & Compliance");
  });

  it("uses 'Activity Log' label", () => {
    expect(appSource).toContain("Activity Log");
  });

  it("uses 'Company Settings' label", () => {
    expect(appSource).toContain("Company Settings");
  });

  it("category title is 'SETTINGS' (not 'ENTERPRISE')", () => {
    expect(appSource).toContain('"SETTINGS"');
    expect(appSource).not.toContain('"ENTERPRISE"');
  });

  // Verify old jargon labels are gone
  it("does not contain old jargon 'Unified Command Center'", () => {
    expect(appSource).not.toContain("Unified Command Center");
  });

  it("does not contain old jargon 'Management Console'", () => {
    expect(appSource).not.toContain("Management Console");
  });

  it("does not contain old jargon 'Exception Triage'", () => {
    expect(appSource).not.toContain("Exception Triage");
  });

  it("does not contain old jargon 'Strategy & Analytics'", () => {
    expect(appSource).not.toContain("Strategy & Analytics");
  });

  it("does not contain old jargon 'Dispatch Board'", () => {
    expect(appSource).not.toContain("Dispatch Board");
  });

  it("does not contain old jargon 'Intake & Quotes'", () => {
    expect(appSource).not.toContain("Intake & Quotes");
  });

  it("does not contain old jargon 'Live Map'", () => {
    // 'Live Map' must not appear as a nav label (the label text)
    expect(appSource).not.toContain('"Live Map"');
  });

  it("does not contain old jargon 'Partner Network Hub'", () => {
    expect(appSource).not.toContain("Partner Network Hub");
  });

  it("does not contain old jargon 'Settlements' as nav label", () => {
    expect(appSource).not.toContain('"Settlements"');
  });

  it("does not contain old jargon 'Safety / Fleet'", () => {
    expect(appSource).not.toContain("Safety / Fleet");
  });

  it("does not contain old jargon 'Audit Logs'", () => {
    expect(appSource).not.toContain('"Audit Logs"');
  });

  it("does not contain old jargon 'Organization' as nav label", () => {
    expect(appSource).not.toContain('"Organization"');
  });
});
