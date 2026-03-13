import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// Tests R-P4-10, R-P4-11, R-P4-12, R-P4-14

const SCRIPTS_DIR = path.join(__dirname, "../");
const VERIFY_SCRIPT = path.join(SCRIPTS_DIR, "verify-production.sh");

function readScript(filePath: string): string {
  return fs.readFileSync(filePath, "utf8");
}

describe("verify-production.sh", () => {
  it("R-P4-10: script file exists", () => {
    expect(fs.existsSync(VERIFY_SCRIPT)).toBe(true);
  });

  it("R-P4-11: script checks /api/health endpoint", () => {
    const content = readScript(VERIFY_SCRIPT);
    expect(content).toContain("/api/health");
  });

  it("R-P4-12: script checks CORS headers (CORS or access-control)", () => {
    const content = readScript(VERIFY_SCRIPT);
    const hasCors =
      content.includes("CORS") ||
      content.includes("access-control") ||
      content.includes("Access-Control");
    expect(hasCors).toBe(true);
  });

  it("R-P4-14: script accepts CLOUD_RUN_URL as env var", () => {
    const content = readScript(VERIFY_SCRIPT);
    expect(content).toContain("CLOUD_RUN_URL");
  });

  it("R-P4-14: script accepts FIREBASE_URL or PRODUCTION_URL as env var", () => {
    const content = readScript(VERIFY_SCRIPT);
    const hasFirebaseUrl = content.includes("FIREBASE_URL");
    const hasProductionUrl = content.includes("PRODUCTION_URL");
    expect(hasFirebaseUrl || hasProductionUrl).toBe(true);
  });

  it("script checks Cloud Logging for errors", () => {
    const content = readScript(VERIFY_SCRIPT);
    const hasCloudLogging =
      content.includes("gcloud logging") ||
      content.includes("Cloud Logging") ||
      content.includes("cloud logging");
    expect(hasCloudLogging).toBe(true);
  });

  it("script checks deployed revision", () => {
    const content = readScript(VERIFY_SCRIPT);
    const hasRevisionCheck =
      content.includes("revision") || content.includes("REVISION");
    expect(hasRevisionCheck).toBe(true);
  });

  it("script checks auth enforcement (rejects 500)", () => {
    const content = readScript(VERIFY_SCRIPT);
    expect(content).toContain("500");
    expect(content).toContain("401");
  });

  it("script uses set -euo pipefail for safety", () => {
    const content = readScript(VERIFY_SCRIPT);
    expect(content).toContain("set -euo pipefail");
  });
});
