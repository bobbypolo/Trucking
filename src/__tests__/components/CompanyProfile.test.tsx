// Tests R-P1-04
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const source = fs.readFileSync(
  path.resolve("components/CompanyProfile.tsx"),
  "utf-8",
);

describe("CompanyProfile.tsx jargon removal (R-P1-04)", () => {
  const bannedTerms = [
    "Authority DNA",
    "Logic Seed",
    "Identity Matrix",
    "Duty Cockpit",
    "Global Authority Profile",
    "Synchronize Matrix",
    "Terminate Duty Cycle",
    "Cargo Unit Telemetry",
    "Active Duty Engine",
    "Terminal Nodes",
    "Authority Structure",
    "Load Numbering Matrix",
    "Access Decision Matrix",
    "Acknowledge Exit",
    "Duty Cycle Terminated",
    "Legal Entity Entity",
    "Establishing Authority Connection",
    "Personnel Registry",
    "Hierarchy Permissions",
    "Compliance Governance",
    "Financial Protocols",
    "Secure File Download",
    "Authority Global State Synchronized",
    "Initial Duty Acknowledge",
    "Finalizing Cargo",
    "Operational DNA",
    "Authority ID",
  ];

  for (const term of bannedTerms) {
    it(`does not contain "${term}"`, () => {
      expect(source).not.toContain(term);
    });
  }
});
