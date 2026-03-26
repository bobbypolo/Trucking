// Tests R-S20-01, R-S20-02, R-S20-03, R-S20-04
// NOTE: Source-inspection test — validates naming conventions, not behavior
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const authSource = fs.readFileSync(
  path.resolve("components/Auth.tsx"),
  "utf-8",
);
const appSource = fs.readFileSync(path.resolve("App.tsx"), "utf-8");
const bookingSource = fs.readFileSync(
  path.resolve("components/BookingPortal.tsx"),
  "utf-8",
);
const editUserSource = fs.readFileSync(
  path.resolve("components/EditUserModal.tsx"),
  "utf-8",
);
const intelligenceSource = fs.readFileSync(
  path.resolve("components/Intelligence.tsx"),
  "utf-8",
);
const loadListSource = fs.readFileSync(
  path.resolve("components/LoadList.tsx"),
  "utf-8",
);
const networkSource = fs.readFileSync(
  path.resolve("components/NetworkPortal.tsx"),
  "utf-8",
);
const sidebarSource = fs.readFileSync(
  path.resolve("components/SidebarTree.tsx"),
  "utf-8",
);
const companySource = fs.readFileSync(
  path.resolve("components/CompanyProfile.tsx"),
  "utf-8",
);

const allComponentSources = [
  { file: "Auth.tsx", src: authSource },
  { file: "BookingPortal.tsx", src: bookingSource },
  { file: "EditUserModal.tsx", src: editUserSource },
  { file: "Intelligence.tsx", src: intelligenceSource },
  { file: "LoadList.tsx", src: loadListSource },
  { file: "NetworkPortal.tsx", src: networkSource },
  { file: "SidebarTree.tsx", src: sidebarSource },
  { file: "CompanyProfile.tsx", src: companySource },
];

// R-S20-01: No "Authority" in any component
describe("R-S20-01: No Authority jargon in components/", () => {
  for (const { file, src } of allComponentSources) {
    it(`${file} does not contain "Authority"`, () => {
      expect(src).not.toContain("Authority");
    });
  }
});

// R-S20-02: No "Emergency Sign Out" in App.tsx
describe("R-S20-02: No Emergency Sign Out in App.tsx", () => {
  it('App.tsx does not contain "Emergency Sign Out"', () => {
    expect(appSource).not.toContain("Emergency Sign Out");
  });
});

// R-S20-03: Login/signup flows use plain language
describe("R-S20-03: Login/signup use plain language", () => {
  it('Auth.tsx contains "Sign In" (login label)', () => {
    expect(authSource).toContain("Sign In");
  });

  it('Auth.tsx contains "Create Account" (signup label)', () => {
    expect(authSource).toContain("Create Account");
  });

  it('App.tsx Sign Out button uses plain "Sign Out" label', () => {
    expect(appSource).toContain("Sign Out");
    expect(appSource).not.toContain("Emergency Sign Out");
  });
});

// R-S20-04: All replacements match the audit table
describe("R-S20-04: Replacement table fully applied", () => {
  it('Auth.tsx brand name is "LoadPilot" (not "LoadPilot Authority")', () => {
    expect(authSource).not.toContain("LoadPilot Authority");
    expect(authSource).toContain("LoadPilot");
  });

  it("Auth.tsx tagline uses plain trucking language", () => {
    expect(authSource).not.toContain("Hub of Authority");
    expect(authSource).toContain(
      "Dispatch management for trucking operations.",
    );
  });

  it("Auth.tsx email placeholder is plain (not authority@logistics.com)", () => {
    expect(authSource).not.toContain("authority@logistics.com");
    expect(authSource).toContain('placeholder="you@company.com"');
  });

  it('Auth.tsx signup step 2 uses "Company Details"', () => {
    expect(authSource).not.toContain("Authority & Billing");
    expect(authSource).toContain("Step 2: Company Details");
  });

  it('Auth.tsx finalize step uses "Complete Setup"', () => {
    expect(authSource).not.toContain("Finalize Authority Subscription");
    expect(authSource).toContain("Complete Setup");
  });

  it('Auth.tsx license uses "Subscription Plan"', () => {
    expect(authSource).not.toContain("Authority License");
    expect(authSource).toContain("Subscription Plan");
  });

  it('Auth.tsx CTA uses "Subscribe with Stripe" and "Start Free Trial"', () => {
    expect(authSource).not.toContain("Initialize Authority");
    expect(authSource).toContain("Subscribe with Stripe");
    expect(authSource).toContain("Start Free Trial");
  });

  it('BookingPortal.tsx client label is "Client" (not "Client Authority")', () => {
    expect(bookingSource).not.toContain("Client Authority");
  });

  it('EditUserModal.tsx tab label is "Access" (not "Authority Access")', () => {
    expect(editUserSource).not.toContain("Authority Access");
  });

  it('EditUserModal.tsx save button is "Save Changes"', () => {
    expect(editUserSource).not.toContain("Update Authority Profile");
    expect(editUserSource).toContain("Save Changes");
  });

  it('Intelligence.tsx heading is "Business Insights"', () => {
    expect(intelligenceSource).not.toContain("Authority Intelligence");
    expect(intelligenceSource).toContain("Business Insights");
  });

  it('Intelligence.tsx MC field uses "MC#:"', () => {
    expect(intelligenceSource).not.toContain("Authority MC:");
    expect(intelligenceSource).toContain("MC#:");
  });

  it('LoadList.tsx empty state is "No loads to show"', () => {
    expect(loadListSource).not.toContain("Authority Bridge Offline");
    expect(loadListSource).toContain("No loads to show");
  });

  it('NetworkPortal.tsx section is "Onboarding"', () => {
    expect(networkSource).not.toContain("Authority Matrix");
    expect(networkSource).toContain("Onboarding");
  });

  it('SidebarTree.tsx nav label is "Company Profile"', () => {
    expect(sidebarSource).not.toContain("Authority Profile");
    expect(sidebarSource).toContain("Company Profile");
  });

  it('CompanyProfile.tsx tab ID is "company_profile" (not "authority_dna")', () => {
    expect(companySource).not.toContain("authority_dna");
    expect(companySource).toContain("company_profile");
  });
});
