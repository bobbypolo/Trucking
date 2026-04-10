#!/usr/bin/env node
/**
 * scripts/demo-host.cjs - One-command launch path for the sales demo host.
 *
 * Usage: npm run demo:host:sales
 *
 * This command validates the single .env.local contract, refreshes the seeded
 * demo data, starts the backend on :5000 and Vite on :3000, waits for both
 * services to be healthy, then keeps both processes running until interrupted.
 */
"use strict";

const { execSync, spawn } = require("child_process");
const fs = require("fs");
const http = require("http");
const net = require("net");
const path = require("path");
const {
  ENV_LOCAL,
  PROJECT_ROOT,
  ensureEnvLocalFile,
  formatDemoEnvProblems,
  loadEnvFileIntoProcess,
  validateDemoEnvFile,
} = require("./demo-env.cjs");

const BACKEND_PORT = 5000;
const FRONTEND_PORT = 3000;
const HEALTH_TIMEOUT_MS = 90000;
const HEALTH_POLL_MS = 1000;

const IS_TTY = process.stdout.isTTY;
const RED = IS_TTY ? "\x1b[31m" : "";
const GREEN = IS_TTY ? "\x1b[32m" : "";
const CYAN = IS_TTY ? "\x1b[36m" : "";
const BOLD = IS_TTY ? "\x1b[1m" : "";
const RESET = IS_TTY ? "\x1b[0m" : "";

function info(msg) {
  process.stdout.write(CYAN + "[demo-host] " + RESET + msg + "\n");
}

function success(msg) {
  process.stdout.write(GREEN + "[demo-host] " + RESET + msg + "\n");
}

function fail(msg) {
  process.stderr.write(RED + "[demo-host] ERROR: " + RESET + msg + "\n");
}

function waitForHealthy(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;

    function poll() {
      if (Date.now() > deadline) {
        reject(new Error("Health check timed out: " + url));
        return;
      }

      const req = http.get(url, (res) => {
        if (res.statusCode >= 200 && res.statusCode < 400) {
          res.resume();
          resolve();
        } else {
          res.resume();
          setTimeout(poll, HEALTH_POLL_MS);
        }
      });

      req.on("error", () => {
        setTimeout(poll, HEALTH_POLL_MS);
      });

      req.setTimeout(3000, () => {
        req.destroy();
        setTimeout(poll, HEALTH_POLL_MS);
      });
    }

    poll();
  });
}

function assertPortAvailable(port, label) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.once("error", (error) => {
      if (error && error.code === "EADDRINUSE") {
        reject(
          new Error(
            label +
              " port " +
              port +
              " is already in use. Stop the stale process and retry the demo host launch.",
          ),
        );
        return;
      }
      reject(error);
    });

    server.once("listening", () => {
      server.close(() => resolve());
    });

    server.listen(port, "127.0.0.1");
  });
}

function validateDemoHostEnv() {
  if (!ensureEnvLocalFile()) {
    throw new Error(
      ".env.local is missing. Copy .env.example.sales-demo to .env.local and fill in the required values.",
    );
  }

  loadEnvFileIntoProcess(ENV_LOCAL);
  const { problems } = validateDemoEnvFile(ENV_LOCAL, {
    requireGemini: true,
  });
  if (problems.length > 0) {
    throw new Error(formatDemoEnvProblems(problems, ENV_LOCAL));
  }

  const hasInlineServiceAccount =
    typeof process.env.FIREBASE_SERVICE_ACCOUNT === "string" &&
    process.env.FIREBASE_SERVICE_ACCOUNT.trim() !== "";
  const hasGoogleApplicationCredentials =
    typeof process.env.GOOGLE_APPLICATION_CREDENTIALS === "string" &&
    process.env.GOOGLE_APPLICATION_CREDENTIALS.trim() !== "";
  const localServiceAccountPath = path.join(
    PROJECT_ROOT,
    "server",
    "serviceAccount.json",
  );
  const hasLocalServiceAccountFile = fs.existsSync(localServiceAccountPath);

  if (
    !hasInlineServiceAccount &&
    !hasGoogleApplicationCredentials &&
    !hasLocalServiceAccountFile
  ) {
    throw new Error(
      "Firebase Admin credentials are missing. Set FIREBASE_SERVICE_ACCOUNT, GOOGLE_APPLICATION_CREDENTIALS, or provide server/serviceAccount.json for the demo host.",
    );
  }
}

function runSetup() {
  info(BOLD + "Refreshing seeded demo data..." + RESET);
  info("  > npm run demo:setup");
  execSync("npm run demo:setup", {
    cwd: PROJECT_ROOT,
    stdio: "inherit",
    env: { ...process.env },
  });
}

function spawnServer(label, cmd, args, env) {
  info("Starting " + label + ": " + cmd + " " + args.join(" "));
  const child = spawn(cmd, args, {
    cwd: PROJECT_ROOT,
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
    env: { ...process.env, ...env },
  });

  child.stdout.on("data", (data) => {
    process.stdout.write("[" + label + "] " + data.toString());
  });

  child.stderr.on("data", (data) => {
    process.stderr.write("[" + label + ":err] " + data.toString());
  });

  child.on("exit", (code) => {
    if (code !== null && code !== 0) {
      process.stderr.write("[" + label + "] exited with code " + code + "\n");
    }
  });

  return child;
}

function killProcess(child, label) {
  if (!child || child.killed) return;

  try {
    if (process.platform === "win32") {
      execSync("taskkill /pid " + child.pid + " /T /F", {
        stdio: "ignore",
        timeout: 5000,
      });
    } else {
      child.kill("SIGTERM");
    }
    info("Stopped " + label + ".");
  } catch {
    // Ignore already-stopped processes.
  }
}

async function main() {
  info("Sales Demo Host");
  info("Project root: " + PROJECT_ROOT);
  process.stdout.write("\n");

  try {
    validateDemoHostEnv();
    success("Environment validated.");
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  try {
    runSetup();
  } catch (error) {
    fail(
      "Demo setup failed. Fix the first error above before retrying the host launch.",
    );
    process.exit(1);
  }

  const backendCommand = process.platform === "win32" ? "npx.cmd" : "npx";
  const viteCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  let backendChild = null;
  let viteChild = null;

  const cleanup = () => {
    killProcess(backendChild, "backend");
    killProcess(viteChild, "vite");
  };

  process.on("SIGINT", () => {
    cleanup();
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    cleanup();
    process.exit(0);
  });

  try {
    await assertPortAvailable(BACKEND_PORT, "backend");
    await assertPortAvailable(FRONTEND_PORT, "vite");

    backendChild = spawnServer(
      "backend",
      backendCommand,
      ["ts-node", "--transpile-only", "server/index.ts"],
      { ALLOW_DEMO_RESET: "1", PORT: String(BACKEND_PORT) },
    );

    viteChild = spawnServer(
      "vite",
      viteCommand,
      [
        "run",
        "dev",
        "--",
        "--port",
        String(FRONTEND_PORT),
        "--strictPort",
        "--host",
        "0.0.0.0",
      ],
      { VITE_DEMO_NAV_MODE: "sales" },
    );

    info(BOLD + "Waiting for services..." + RESET);
    await Promise.all([
      waitForHealthy(
        "http://localhost:" + BACKEND_PORT + "/api/health",
        HEALTH_TIMEOUT_MS,
      ),
      waitForHealthy("http://localhost:" + FRONTEND_PORT + "/", HEALTH_TIMEOUT_MS),
    ]);

    success("Sales demo host is ready.");
    process.stdout.write(
      "\n" +
        BOLD +
        "Open these URLs:" +
        RESET +
        "\n" +
        "  Demo UI: http://localhost:" +
        FRONTEND_PORT +
        "\n" +
        "  API health: http://localhost:" +
        BACKEND_PORT +
        "/api/health\n\n" +
        "Press Ctrl+C to stop the demo host.\n",
    );
  } catch (error) {
    cleanup();
    fail(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
