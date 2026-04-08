/**
 * Doc-as-spec tests for docs/sales-demo-seed-contract.md and
 * .env.example.sales-demo.
 *
 * Tests R-P1-06, R-P1-11.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const REPO_ROOT = path.resolve(__dirname, "../../..");
const CONTRACT_PATH = path.join(
  REPO_ROOT,
  "docs",
  "sales-demo-seed-contract.md",
);
const ENV_EXAMPLE_PATH = path.join(REPO_ROOT, ".env.example.sales-demo");

// Tests R-P1-06 — docs/sales-demo-seed-contract.md contains the 5 required H2 sections.
describe("docs/sales-demo-seed-contract.md — Phase 1 doc-as-spec", () => {
  it("R-P1-06: file exists and is non-empty", () => {
    expect(fs.existsSync(CONTRACT_PATH)).toBe(true);
    const stat = fs.statSync(CONTRACT_PATH);
    expect(stat.size).toBeGreaterThan(0);
  });

  it("R-P1-06: contains all 5 required H2 sections", () => {
    const src = fs.readFileSync(CONTRACT_PATH, "utf-8");

    const required = [
      "## Rows present after reset",
      "## Firebase UID env contract",
      "## GL accounts that must exist",
      "## Hidden routes & rationale",
      "## Known SaaS follow-ups (out of scope this sprint)",
    ];
    for (const section of required) {
      expect(src).toContain(section);
    }
  });

  it("R-P1-06: mentions both IFTA GL accounts GL-6900 and GL-2200", () => {
    const src = fs.readFileSync(CONTRACT_PATH, "utf-8");
    expect(src).toContain("GL-6900");
    expect(src).toContain("GL-2200");
  });
});

// Tests R-P1-11 — .env.example.sales-demo file exists at the repo root and contains
// placeholder lines for all 7 required keys.
describe(".env.example.sales-demo — Phase 1 env contract", () => {
  it("R-P1-11: file exists at the repo root", () => {
    expect(fs.existsSync(ENV_EXAMPLE_PATH)).toBe(true);
  });

  it("R-P1-11: contains all 7 required placeholder keys", () => {
    const src = fs.readFileSync(ENV_EXAMPLE_PATH, "utf-8");
    const requiredKeys = [
      "DB_HOST",
      "DB_PORT",
      "DB_USER",
      "DB_PASSWORD",
      "DB_NAME",
      "SALES_DEMO_ADMIN_FIREBASE_UID",
      "SALES_DEMO_DRIVER_FIREBASE_UID",
    ];
    for (const key of requiredKeys) {
      // Each key must appear as a KEY=value line (anchored on word boundary).
      const re = new RegExp(`^${key}=`, "m");
      expect(re.test(src)).toBe(true);
    }
  });
});
