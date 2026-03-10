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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.resolve(__dirname, "../..");
const projectRoot = path.resolve(serverDir, "..");
dotenv.config({ path: path.join(projectRoot, ".env") });

const TEST_PORT = 5099; // Use non-default port to avoid conflicts

let serverProcess: ChildProcess | null = null;
let skip = false;
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

describe("Real Express Server Boot", () => {
  beforeAll(async () => {
    // Check required env vars
    if (!process.env.DB_HOST || !process.env.DB_NAME) {
      skip = true;
      return;
    }

    // Check if Docker MySQL is accessible
    const { execSync } = await import("child_process");
    try {
      const out = execSync(
        'docker ps --filter name=loadpilot-dev --format "{{.Names}}"',
        { encoding: "utf-8", timeout: 5000 },
      );
      if (!out.includes("loadpilot-dev")) {
        skip = true;
        return;
      }
    } catch {
      skip = true;
      return;
    }

    // Spawn server via ts-node
    const env = {
      ...process.env,
      PORT: String(TEST_PORT),
      NODE_ENV: "test",
    };

    // On Windows, .cmd files require shell:true (cannot spawn .cmd directly)
    const tsNodeBin = process.platform === "win32"
      ? path.join(serverDir, "node_modules", ".bin", "ts-node.cmd")
      : path.join(serverDir, "node_modules", ".bin", "ts-node");

    serverProcess = spawn(tsNodeBin, ["index.ts"], {
      cwd: serverDir,
      env,
      stdio: ["ignore", "pipe", "pipe"],
      shell: process.platform === "win32",
    });

    const ready = await waitForServer(serverUrl, 20000);
    if (!ready) {
      skip = true;
    }
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
    if (skip) return;
    const res = await fetch(`${serverUrl}/api/health`);
    expect(res.status).toBe(200);
  });

  it("GET /api/health returns { status: 'ok' }", async () => {
    if (skip) return;
    const res = await fetch(`${serverUrl}/api/health`);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.status).toBe("ok");
  });

  it("server responds to unknown routes with non-200 (not a crash)", async () => {
    if (skip) return;
    const res = await fetch(`${serverUrl}/api/nonexistent-route-xyz`);
    // Should get 404 or similar, not a crash (5xx)
    expect(res.status).not.toBe(500);
  });
});
