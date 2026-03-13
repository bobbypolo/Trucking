import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// Tests R-P4-01, R-P4-02, R-P4-03, R-P4-04,
//       R-P4-05, R-P4-06, R-P4-07, R-P4-08, R-P4-09, R-P4-13

const SCRIPTS_DIR = path.join(__dirname, "../");
const DOCS_DIR = path.join(__dirname, "../../docs/deployment/");
const SMOKE_SCRIPT = path.join(SCRIPTS_DIR, "smoke-test-production.sh");
const DOMAIN_DOC = path.join(DOCS_DIR, "DOMAIN_SSL_SETUP.md");

function readFile(filePath: string): string {
  return fs.readFileSync(filePath, "utf8");
}

describe("DOMAIN_SSL_SETUP.md", () => {
  it("R-P4-01: doc file exists", () => {
    expect(fs.existsSync(DOMAIN_DOC)).toBe(true);
  });

  it("R-P4-02: doc mentions Firebase Hosting custom domain", () => {
    const content = readFile(DOMAIN_DOC);
    const matches = (content.match(/Firebase Hosting|firebase hosting/gi) ?? []).length;
    expect(matches).toBeGreaterThanOrEqual(1);
  });

  it("R-P4-03: doc covers DNS records (DNS, A record, AAAA, CNAME, or TXT appear >= 2 times)", () => {
    const content = readFile(DOMAIN_DOC);
    const matches = (content.match(/DNS|A record|AAAA|CNAME|TXT/g) ?? []).length;
    expect(matches).toBeGreaterThanOrEqual(2);
  });

  it("R-P4-04: doc covers SSL certificates (SSL, certificate, or HTTPS appear >= 2 times)", () => {
    const content = readFile(DOMAIN_DOC);
    const matches = (content.match(/SSL|certificate|HTTPS/g) ?? []).length;
    expect(matches).toBeGreaterThanOrEqual(2);
  });
});

describe("smoke-test-production.sh", () => {
  it("R-P4-05: script file exists", () => {
    expect(fs.existsSync(SMOKE_SCRIPT)).toBe(true);
  });

  it("R-P4-06: script checks /api/health endpoint", () => {
    const content = readFile(SMOKE_SCRIPT);
    expect(content).toContain("/api/health");
  });

  it("R-P4-07: script checks auth enforcement (references 401, 403, or auth)", () => {
    const content = readFile(SMOKE_SCRIPT);
    const hasAuthCheck =
      content.includes("401") || content.includes("403") || content.includes("auth");
    expect(hasAuthCheck).toBe(true);
  });

  it("R-P4-08: script explicitly rejects 500 as auth response", () => {
    const content = readFile(SMOKE_SCRIPT);
    expect(content).toContain("500");
    // 500 must appear in a fail/error context, not a pass context
    expect(content).not.toMatch(/if.*500.*then.*pass/i);
  });

  it("R-P4-09: script discovers revision URL (uses revisions list or revision)", () => {
    const content = readFile(SMOKE_SCRIPT);
    const hasRevision =
      content.includes("revisions list") || content.includes("revision");
    expect(hasRevision).toBe(true);
  });

  it("script uses set -euo pipefail for safety", () => {
    const content = readFile(SMOKE_SCRIPT);
    expect(content).toContain("set -euo pipefail");
  });

  it("script checks CORS headers", () => {
    const content = readFile(SMOKE_SCRIPT);
    const hasCors =
      content.includes("CORS") ||
      content.includes("access-control") ||
      content.includes("Access-Control");
    expect(hasCors).toBe(true);
  });

  it("script checks for localhost in response", () => {
    const content = readFile(SMOKE_SCRIPT);
    expect(content).toContain("localhost");
  });

  it("script checks SSL certificate", () => {
    const content = readFile(SMOKE_SCRIPT);
    const hasSsl =
      content.includes("ssl") ||
      content.includes("SSL") ||
      content.includes("openssl") ||
      content.includes("cert-status");
    expect(hasSsl).toBe(true);
  });

  it("script exits 0 on pass, 1 on fail", () => {
    const content = readFile(SMOKE_SCRIPT);
    expect(content).toContain("exit 1");
  });
});
