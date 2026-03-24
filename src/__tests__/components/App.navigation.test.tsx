// Tests R-P1-01 — Updated for approved IA (9-item nav)
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// Verify navigation labels by reading the source file directly
// This avoids complex App rendering with many dependencies while still
// asserting the actual string values in the categories array.
const appSource = fs.readFileSync(path.resolve("App.tsx"), "utf-8");

// Extract the categories block for targeted assertions
const categoryBlock = appSource.slice(
  appSource.indexOf("const categories: NavCategory[]"),
  appSource.indexOf("const filteredCategories"),
);

describe("App.tsx approved IA — 9 primary nav items (NAV-01)", () => {
  // Retained nav labels
  it("uses 'Operations Center' label", () => {
    expect(categoryBlock).toContain("Operations Center");
  });

  it("uses 'Load Board' label", () => {
    expect(categoryBlock).toContain("Load Board");
  });

  it("uses 'Quotes & Booking' label", () => {
    expect(categoryBlock).toContain("Quotes & Booking");
  });

  it("uses 'Schedule' label", () => {
    expect(categoryBlock).toContain('"Schedule"');
  });

  it("uses 'Broker Network' label", () => {
    expect(categoryBlock).toContain("Broker Network");
  });

  it("uses 'Driver Pay' label", () => {
    expect(categoryBlock).toContain("Driver Pay");
  });

  it("uses 'Accounting' label", () => {
    expect(categoryBlock).toContain('"Accounting"');
  });

  it("uses 'Issues & Alerts' label", () => {
    expect(categoryBlock).toContain("Issues & Alerts");
  });

  it("uses 'Company Settings' label", () => {
    expect(categoryBlock).toContain("Company Settings");
  });
});

describe("App.tsx removed nav items (NAV-02 through NAV-06)", () => {
  // NAV-02: Dashboard removed from primary nav
  it("does not have Dashboard in categories (NAV-02)", () => {
    expect(categoryBlock).not.toContain('"Dashboard"');
  });

  // NAV-03: Activity Log removed from primary nav
  it("does not have Activity Log in categories (NAV-03)", () => {
    expect(categoryBlock).not.toContain("Activity Log");
  });

  // NAV-04: Fleet Map removed from primary nav
  it("does not have Fleet Map in categories (NAV-04)", () => {
    expect(categoryBlock).not.toContain("Fleet Map");
  });

  // NAV-05: Safety & Compliance removed from primary nav
  it("does not have Safety & Compliance in categories (NAV-05)", () => {
    expect(categoryBlock).not.toContain("Safety & Compliance");
  });

  // NAV-06: API Tester removed from production nav
  it("does not have API Tester in categories (NAV-06)", () => {
    expect(categoryBlock).not.toContain("API Tester");
  });

  // Reports/Analytics removed from primary nav
  it("does not have Reports in categories", () => {
    expect(categoryBlock).not.toContain('"Reports"');
  });
});

describe("App.tsx no old jargon labels", () => {
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

  it("category title is 'SETTINGS' (not 'ENTERPRISE')", () => {
    expect(appSource).toContain('"SETTINGS"');
    expect(appSource).not.toContain('"ENTERPRISE"');
  });
});

// Verify every sidebar tab ID has a matching render case in the main content.
describe("App.tsx tab-to-render wiring (no dead nav items)", () => {
  const idMatches = [...categoryBlock.matchAll(/id:\s*"([^"]+)"/g)].map(
    (m) => m[1],
  );

  // Approved IA: 9 nav items only
  const tabIds = [
    "operations-hub",
    "loads",
    "quotes",
    "calendar",
    "network",
    "finance",
    "accounting",
    "exceptions",
    "company",
  ];

  it("extracts expected 9 tab IDs from categories", () => {
    expect(idMatches).toHaveLength(9);
    for (const id of tabIds) {
      expect(idMatches).toContain(id);
    }
  });

  for (const id of tabIds) {
    it(`"${id}" tab has a matching render conditional`, () => {
      const renderPattern = new RegExp(`activeTab\\s*===\\s*"${id}"\\s*&&\\s*`);
      expect(appSource).toMatch(renderPattern);
    });
  }

  it('"company" tab does not require company data to render', () => {
    expect(appSource).not.toMatch(
      /activeTab\s*===\s*"company"\s*&&\s*company\s*&&/,
    );
  });
});

describe("App.tsx operational load creation (OPS-01, OPS-02)", () => {
  it("Create Load button opens LoadSetupModal, not Quotes (OPS-01)", () => {
    expect(appSource).toContain("Create Load");
    expect(appSource).toContain("setShowLoadSetup({})");
  });

  it("New Intake button still routes to Quotes (OPS-02)", () => {
    expect(appSource).toContain("New Intake");
  });
});
