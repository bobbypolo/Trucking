import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const HOST_SCRIPT = path.join(REPO_ROOT, "scripts", "demo-host.cjs");
const SETUP_SCRIPT = path.join(REPO_ROOT, "scripts", "demo-setup.cjs");

function read(filePath: string): string {
  expect(fs.existsSync(filePath)).toBe(true);
  const body = fs.readFileSync(filePath, "utf8");
  expect(body.length).toBeGreaterThan(0);
  return body;
}

describe("sales demo host launcher contracts", () => {
  it("demo-host.cjs exists and launches the local host processes", () => {
    const body = read(HOST_SCRIPT);
    expect(body).toContain("npm run demo:setup");
    expect(body).toContain("Waiting for services...");
    expect(body).toContain("validateDemoEnvFile(ENV_LOCAL");
    expect(body).toContain("requireGemini: true");
  });

  it("demo-setup.cjs exists and points operators at the host launcher", () => {
    const body = read(SETUP_SCRIPT);
    expect(body).toContain("npm run demo:host:sales");
    expect(body).toContain("validateDemoEnvFile(ENV_LOCAL");
    expect(body).toContain("requireGemini: true");
  });
});
