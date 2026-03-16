import { describe, it, expect } from "vitest";
import { execSync } from "child_process";
import path from "path";
import fs from "fs";

// Tests CI-GUARD — forbidden pattern enforcement

const ROOT = path.resolve(__dirname, "../../..");
const SERVER = path.join(ROOT, "server");
const SERVICES = path.join(ROOT, "services");

function grepNonTest(pattern: string, dir: string, ext = "*.ts"): string[] {
  try {
    const result = execSync(
      `grep -r "${pattern}" "${dir}" --include="${ext}" -l`,
      { encoding: "utf-8" },
    );
    return result
      .trim()
      .split("\n")
      .filter((f) => f && !f.includes("__tests__") && !f.includes(".test."));
  } catch {
    return []; // grep returns exit code 1 when no matches
  }
}

describe("Forbidden Patterns — CI Guardrails", () => {
  it("no 'admin123' in server runtime code", () => {
    const hits = grepNonTest("admin123", SERVER);
    expect(hits).toEqual([]);
  });

  it("no 'iscope-authority-001' in server runtime code", () => {
    const hits = grepNonTest("iscope-authority-001", SERVER);
    expect(hits).toEqual([]);
  });

  it("no 'KCI-USA' in services runtime code", () => {
    const hits = grepNonTest("KCI-USA", SERVICES);
    expect(hits).toEqual([]);
  });

  it("no CDN tailwind in dist/", () => {
    const distDir = path.join(ROOT, "dist");
    if (!fs.existsSync(distDir)) return; // skip if not built
    const hits = grepNonTest("cdn.tailwindcss", distDir, "*");
    expect(hits).toEqual([]);
  });

  it("no aistudiocdn in dist/", () => {
    const distDir = path.join(ROOT, "dist");
    if (!fs.existsSync(distDir)) return;
    const hits = grepNonTest("aistudiocdn", distDir, "*");
    expect(hits).toEqual([]);
  });

  it("no importmap in dist/index.html", () => {
    const indexHtml = path.join(ROOT, "dist", "index.html");
    if (!fs.existsSync(indexHtml)) return;
    const content = fs.readFileSync(indexHtml, "utf-8");
    expect(content).not.toContain("importmap");
  });

  it("no req.query.companyId used for SQL tenant scoping", () => {
    const hits = grepNonTest("req.query.companyId", SERVER);
    expect(hits).toEqual([]);
  });
});
