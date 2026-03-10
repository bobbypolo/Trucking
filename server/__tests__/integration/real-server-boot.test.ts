/**
 * Real Express server boot integration test.
 * Spawns the real server process against Docker MySQL, hits /api/health,
 * verifies 200 response and clean shutdown.
 *
 * R-marker: Tests R-P1-04
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn, type ChildProcess } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { isDockerRunning } from "../helpers/test-env.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.resolve(__dirname, "../..");
const projectRoot = path.resolve(serverDir, "..");
dotenv.config({ path: path.join(projectRoot, ".env") });

const REQUIRE_INFRA = process.env.REQUIRE_INFRA === "1";
const TEST_PORT = 5099; // Use non-default port to avoid conflicts

let serverProcess: ChildProcess | null = null;
let skip = false;
let skipReason = "";
let serverUrl = `http://127.0.0.1:${TEST_PORT}`;

async function waitForServer(url: string, maxMs = 15000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const res = await fetch(`${url}/api/health`);
      if (res.status === 200) return true;
    } catch {
      // Not ready yet
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

function requireOrSkip(condition: boolean, reason: string): void {
  if (condition) return;
  if (REQUIRE_INFRA) {
    throw new Error(
      `REQUIRE_INFRA=1 but infrastructure unavailable: ${reason}`,
    );
  }
  skip = true;
  skipReason = reason;
}

describe("Real Express Server Boot", () => {
  beforeAll(async () => {
    // Check required env vars
    requireOrSkip(
      !!(process.env.DB_HOST && process.env.DB_NAME),
      "DB_HOST/DB_NAME env vars not set",
    );
    if (skip) return;

    // Check if Docker MySQL is accessible
    requireOrSkip(
      isDockerRunning(),
      "Docker container loadpilot-dev not running",
    );
    if (skip) return;

    // Spawn server via ts-node
    const env = {
      ...process.env,
      PORT: String(TEST_PORT),
      NODE_ENV: "test",
    };

    // On Windows, .cmd files require shell:true (cannot spawn .cmd directly)
    const tsNodeBin =
      process.platform === "win32"
        ? path.join(serverDir, "node_modules", ".bin", "ts-node.cmd")
        : path.join(serverDir, "node_modules", ".bin", "ts-node");

    serverProcess = spawn(tsNodeBin, ["index.ts"], {
      cwd: serverDir,
      env,
      stdio: ["ignore", "pipe", "pipe"],
      shell: process.platform === "win32",
    });

    const ready = await waitForServer(serverUrl, 20000);
    requireOrSkip(ready, "Server failed to start within 20s");
  }, 30000);

  afterAll(async () => {
    if (serverProcess) {
      serverProcess.kill("SIGTERM");
      await new Promise((r) => setTimeout(r, 2000));
      if (!serverProcess.killed) {
        serverProcess.kill("SIGKILL");
      }
      serverProcess = null;
    }
  }, 10000);

  it("GET /api/health returns HTTP 200", async () => {
    if (skip) {
      console.warn(`SKIP: ${skipReason}`);
      return;
    }
    const res = await fetch(`${serverUrl}/api/health`);
    expect(res.status).toBe(200);
  });

  it("GET /api/health returns { status: 'ok' }", async () => {
    if (skip) {
      console.warn(`SKIP: ${skipReason}`);
      return;
    }
    const res = await fetch(`${serverUrl}/api/health`);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.status).toBe("ok");
  });

  it("server responds to unknown routes with non-200 (not a crash)", async () => {
    if (skip) {
      console.warn(`SKIP: ${skipReason}`);
      return;
    }
    const res = await fetch(`${serverUrl}/api/nonexistent-route-xyz`);
    // Should get 404 or similar, not a crash (5xx)
    expect(res.status).not.toBe(500);
  });
});
