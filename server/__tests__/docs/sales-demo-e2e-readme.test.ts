/**
 * Tests R-P7-05: e2e/sales-demo/README.md lists all 4 specs
 * (00-smoke, 01-document-automation, 02-ifta-walkthrough,
 * 03-crm-walkthrough).
 *
 * Also verifies R-P7-06: package.json demo:certify:sales script value
 * is exactly "node scripts/demo-certify.cjs" (no cross-env, no shell
 * wrappers, no && chains).
 *
 * These checks run in plain Node / Vitest — no DB, no spawned process.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const README_PATH = path.join(REPO_ROOT, "e2e", "sales-demo", "README.md");
const PACKAGE_JSON_PATH = path.join(REPO_ROOT, "package.json");

// Canonical spec filenames — exactly what lives on disk under
// e2e/sales-demo/. Update this list only when the suite changes.
const REQUIRED_SPECS = [
  "00-smoke.spec.ts",
  "01-document-automation.spec.ts",
  "02-ifta-walkthrough.spec.ts",
  "03-crm-walkthrough.spec.ts",
];

describe("e2e/sales-demo/README.md — R-P7-05", () => {
  it("README.md file exists at the expected path", () => {
    expect(fs.existsSync(README_PATH)).toBe(true);
  });

  it("lists all 4 spec filenames in order", () => {
    const body = fs.readFileSync(README_PATH, "utf8");
    for (const spec of REQUIRED_SPECS) {
      expect(body).toContain(spec);
    }

    // The numeric order must be preserved so the reader can follow the
    // pipeline. Check that each spec appears after its predecessor.
    const positions = REQUIRED_SPECS.map((spec) => body.indexOf(spec));
    for (let i = 1; i < positions.length; i += 1) {
      expect(positions[i]).toBeGreaterThan(positions[i - 1]);
    }
  });

  it("lists at least 4 spec filenames total", () => {
    const body = fs.readFileSync(README_PATH, "utf8");
    // Count *.spec.ts occurrences — must be >= 4 to leave room for
    // future additions without forcing a test edit for every rename.
    const matches = body.match(/[0-9][0-9]-[a-z0-9-]+\.spec\.ts/g) || [];
    const unique = Array.from(new Set(matches));
    expect(unique.length).toBeGreaterThanOrEqual(4);
  });

  it("every required spec file actually exists on disk", () => {
    const specDir = path.join(REPO_ROOT, "e2e", "sales-demo");
    for (const spec of REQUIRED_SPECS) {
      expect(fs.existsSync(path.join(specDir, spec))).toBe(true);
    }
  });
});

describe("package.json demo:certify:sales script — R-P7-06", () => {
  it("demo:certify:sales script value is exactly 'node scripts/demo-certify.cjs'", () => {
    const raw = fs.readFileSync(PACKAGE_JSON_PATH, "utf8");
    const pkg = JSON.parse(raw);
    expect(pkg.scripts).toBeDefined();
    expect(pkg.scripts["demo:certify:sales"]).toBe(
      "node scripts/demo-certify.cjs",
    );
  });

  it("demo:certify:sales script does not contain shell wrappers", () => {
    const raw = fs.readFileSync(PACKAGE_JSON_PATH, "utf8");
    const pkg = JSON.parse(raw);
    const value: string = pkg.scripts["demo:certify:sales"];
    // No cross-env prefix.
    expect(value).not.toContain("cross-env");
    // No && chain — the script must be single-command so Windows cmd.exe,
    // PowerShell, and bash all run it identically.
    expect(value).not.toContain("&&");
    // No Unix-style env var injection like "FOO=bar node ...".
    expect(value).not.toMatch(/^[A-Z_]+=/);
  });
});
