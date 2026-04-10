#!/usr/bin/env node
/**
 * scripts/demo-certify.cjs — Windows-safe Sales Demo Certification pipeline.
 *
 * Usage: node scripts/demo-certify.cjs [--append-only logFilePath]
 *
 * Full pipeline (default):
 *   1. Runs demo:reset:sales (resets the SALES-DEMO-001 tenant)
 *   2. Runs demo:seed:sales  (seeds the hero load + supporting rows)
 *   3. Starts the backend server (server/) on port 5000
 *   4. Starts the frontend dev server (vite) on port 3101
 *   5. Waits for both to be healthy
 *   6. Runs Playwright against e2e/sales-demo/ specs
 *   7. Captures Playwright stdout to a temp log
 *   8. Appends the last 50 lines of the log to docs/release/evidence.md
 *   9. Kills both servers
 *  10. Exits with the Playwright exit code
 *
 * Append-only mode (--append-only <logFile>):
 *   Legacy behavior — reads an existing log file and appends to evidence.
 *   Kept for backward compatibility with manual workflows.
 *
 * Environment:
 *   All temp files use os.tmpdir() so the script works on Windows unchanged.
 *   The script sets SALES_DEMO_E2E=1 and E2E_SERVER_RUNNING=1 for Playwright.
 */
"use strict";

const { execSync, spawn } = require("child_process");
const fs = require("fs");
const http = require("http");
const net = require("net");
const os = require("os");
const path = require("path");
const {
  ENV_LOCAL,
  ensureEnvLocalFile,
  formatDemoEnvProblems,
  loadEnvFileIntoProcess,
  validateDemoEnvFile,
} = require("./demo-env.cjs");

const EVIDENCE_H2 = "## Sales Demo Certification";
const DEFAULT_LOG_BASENAME = "sales-demo-cert-latest.log";
const MAX_LOG_TAIL_LINES = 50;
const SERVER_PORT = 5000;
const VITE_PORT = 3101;
const HEALTH_TIMEOUT_MS = 90000;
const HEALTH_POLL_MS = 1000;

function preflightDemoEnv() {
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
}

/* ------------------------------------------------------------------ */
/*  Utility helpers (also exported for unit tests)                     */
/* ------------------------------------------------------------------ */

function defaultLogPath() {
  return path.join(os.tmpdir(), DEFAULT_LOG_BASENAME);
}

function defaultEvidencePath() {
  return path.join(process.cwd(), "docs", "release", "evidence.md");
}

function tailLines(text, maxLines) {
  const lines = text.split(/\r?\n/);
  if (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }
  const start = Math.max(0, lines.length - maxLines);
  return lines.slice(start).join("\n");
}

function appendCertificationBlock(evidenceFile, timestamp, tailText) {
  let current = "";
  if (fs.existsSync(evidenceFile)) {
    current = fs.readFileSync(evidenceFile, "utf8");
  }
  const hasHeading = current.includes(EVIDENCE_H2);
  const parts = [];
  if (current.length > 0 && !current.endsWith("\n")) {
    parts.push("\n");
  }
  if (!hasHeading) {
    parts.push("\n");
    parts.push(EVIDENCE_H2);
    parts.push("\n");
  }
  parts.push("\n");
  parts.push("### ");
  parts.push(timestamp);
  parts.push("\n\n");
  parts.push("```");
  parts.push("\n");
  parts.push(tailText);
  parts.push("\n");
  parts.push("```");
  parts.push("\n");
  fs.appendFileSync(evidenceFile, parts.join(""), "utf8");
}

/* ------------------------------------------------------------------ */
/*  Health check — polls HTTP until 200 or timeout                     */
/* ------------------------------------------------------------------ */

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
              " is already in use. Stop the stale process and retry certification.",
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

/* ------------------------------------------------------------------ */
/*  Sync command runner with logging                                    */
/* ------------------------------------------------------------------ */

function runSync(label, cmd, opts) {
  process.stdout.write("[certify] " + label + ": " + cmd + "\n");
  try {
    execSync(cmd, {
      cwd: process.cwd(),
      stdio: "inherit",
      timeout: 120000,
      ...opts,
    });
  } catch (err) {
    process.stderr.write("[certify] FAILED: " + label + "\n");
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Spawn a background server, return the ChildProcess                 */
/* ------------------------------------------------------------------ */

function spawnServer(label, cmd, args, opts) {
  process.stdout.write(
    "[certify] Starting " + label + ": " + cmd + " " + args.join(" ") + "\n",
  );
  const child = spawn(cmd, args, {
    cwd: opts.cwd || process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
    env: { ...process.env, ...(opts.env || {}) },
    detached: false,
  });
  child.stdout.on("data", (d) => {
    process.stdout.write("[" + label + "] " + d.toString());
  });
  child.stderr.on("data", (d) => {
    process.stderr.write("[" + label + ":err] " + d.toString());
  });
  child.on("exit", (code) => {
    if (code !== null && code !== 0) {
      process.stderr.write("[" + label + "] exited with code " + code + "\n");
    }
  });
  return child;
}

/* ------------------------------------------------------------------ */
/*  Kill helper (Windows-safe)                                         */
/* ------------------------------------------------------------------ */

function killProcess(child, label) {
  if (!child || child.killed) return;
  try {
    // On Windows, child.kill() may not kill the tree. Use taskkill.
    if (process.platform === "win32") {
      try {
        execSync("taskkill /pid " + child.pid + " /T /F", {
          stdio: "ignore",
          timeout: 5000,
        });
      } catch {
        child.kill("SIGKILL");
      }
    } else {
      child.kill("SIGTERM");
    }
    process.stdout.write("[certify] Stopped " + label + "\n");
  } catch {
    // Already dead — that's fine
  }
}

/* ------------------------------------------------------------------ */
/*  Full certification pipeline                                        */
/* ------------------------------------------------------------------ */

async function runFullPipeline() {
  preflightDemoEnv();

  const logFile = defaultLogPath();
  const evidenceFile = defaultEvidencePath();
  let backendChild = null;
  let viteChild = null;
  let exitCode = 1;

  try {
    // Step 1: Reset
    process.stdout.write("\n[certify] === Step 1/6: Reset demo tenant ===\n");
    runSync("reset", "npx ts-node --transpile-only server/scripts/reset-sales-demo.ts");

    // Step 2: Seed
    process.stdout.write("\n[certify] === Step 2/6: Seed demo tenant ===\n");
    runSync("seed", "npx ts-node --transpile-only server/scripts/seed-sales-demo.ts");

    // Step 3: Start backend
    process.stdout.write("\n[certify] === Step 3/6: Start backend server ===\n");
    await assertPortAvailable(SERVER_PORT, "backend");
    backendChild = spawnServer("backend", "npx", ["ts-node", "--transpile-only", "server/index.ts"], {
      env: { ALLOW_DEMO_RESET: "1", PORT: String(SERVER_PORT) },
    });

    // Step 4: Start Vite dev server on port 3101
    process.stdout.write("\n[certify] === Step 4/6: Start Vite dev server ===\n");
    await assertPortAvailable(VITE_PORT, "vite");
    const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
    viteChild = spawnServer("vite", npmCmd, ["run", "dev", "--", "--port", String(VITE_PORT), "--strictPort"], {
      env: { VITE_DEMO_NAV_MODE: "sales" },
    });

    // Step 5: Wait for both servers to be healthy
    process.stdout.write("\n[certify] === Step 5/6: Waiting for servers ===\n");
    await Promise.all([
      waitForHealthy("http://localhost:" + SERVER_PORT + "/api/health", HEALTH_TIMEOUT_MS),
      waitForHealthy("http://localhost:" + VITE_PORT + "/", HEALTH_TIMEOUT_MS),
    ]);
    process.stdout.write("[certify] Both servers healthy.\n");

    // Step 6: Run Playwright
    process.stdout.write("\n[certify] === Step 6/6: Run Playwright e2e/sales-demo ===\n");
    const playwrightCmd =
      "npx playwright test e2e/sales-demo/ --reporter=list";
    try {
      const output = execSync(playwrightCmd, {
        cwd: process.cwd(),
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
        timeout: 300000, // 5 min max for e2e
        env: {
          ...process.env,
          SALES_DEMO_E2E: "1",
          // Servers are already running — tell Playwright to reuse them
          E2E_SERVER_RUNNING: "1",
          E2E_APP_URL: "http://localhost:" + VITE_PORT,
          E2E_API_URL: "http://localhost:" + SERVER_PORT,
          VITE_DEMO_NAV_MODE: "sales",
        },
      });
      fs.writeFileSync(logFile, output, "utf8");
      exitCode = 0;
      process.stdout.write("[certify] Playwright PASSED.\n");
    } catch (playwrightErr) {
      const output = playwrightErr.stdout || playwrightErr.stderr || String(playwrightErr);
      fs.writeFileSync(logFile, output, "utf8");
      exitCode = 1;
      process.stderr.write("[certify] Playwright FAILED.\n");
    }

    // Append to evidence regardless of pass/fail
    const logText = fs.readFileSync(logFile, "utf8");
    const tail = tailLines(logText, MAX_LOG_TAIL_LINES);
    const passLabel = exitCode === 0 ? "PASS" : "FAIL";
    const timestamp = new Date().toISOString() + " [" + passLabel + "]";
    appendCertificationBlock(evidenceFile, timestamp, tail);
    process.stdout.write(
      "[certify] Appended " + passLabel + " block to " + evidenceFile + "\n",
    );
  } finally {
    // Cleanup: kill servers
    killProcess(viteChild, "vite");
    killProcess(backendChild, "backend");
  }

  return exitCode;
}

/* ------------------------------------------------------------------ */
/*  Append-only mode (legacy)                                          */
/* ------------------------------------------------------------------ */

function runAppendOnlyLegacy(logFilePath, evidenceFilePath) {
  const logFile = logFilePath || defaultLogPath();
  const evidenceFile = evidenceFilePath || defaultEvidencePath();

  if (!fs.existsSync(logFile)) {
    process.stderr.write(
      "demo-certify: log file not found: " + logFile + "\n",
    );
    process.exit(1);
  }

  const logText = fs.readFileSync(logFile, "utf8");
  const tail = tailLines(logText, MAX_LOG_TAIL_LINES);
  const timestamp = new Date().toISOString();

  appendCertificationBlock(evidenceFile, timestamp, tail);
  process.stdout.write(
    "demo-certify: appended block dated " + timestamp + " to " + evidenceFile + "\n",
  );
}

function runAppendOnly(logFilePath) {
  const logFile = logFilePath || defaultLogPath();
  const evidenceFile = defaultEvidencePath();

  if (!fs.existsSync(logFile)) {
    process.stderr.write(
      "demo-certify: log file not found: " + logFile + "\n",
    );
    process.exit(1);
  }

  const logText = fs.readFileSync(logFile, "utf8");
  const tail = tailLines(logText, MAX_LOG_TAIL_LINES);
  const timestamp = new Date().toISOString();

  appendCertificationBlock(evidenceFile, timestamp, tail);
  process.stdout.write(
    "demo-certify: appended block dated " + timestamp + " to " + evidenceFile + "\n",
  );
}

/* ------------------------------------------------------------------ */
/*  Entry point                                                        */
/* ------------------------------------------------------------------ */

function main() {
  const args = process.argv.slice(2);

  // Legacy append-only mode (explicit flag)
  if (args[0] === "--append-only") {
    runAppendOnly(args[1]);
    return;
  }

  // Legacy: positional args (backward compat with old API)
  // Old usage: node demo-certify.cjs <logFile> [evidenceFile]
  if (args[0] && fs.existsSync(args[0])) {
    runAppendOnlyLegacy(args[0], args[1]);
    return;
  }

  // Legacy: non-existent file arg means missing log (old R-P7-02 behavior)
  if (args[0] && !args[0].startsWith("-")) {
    process.stderr.write(
      "demo-certify: log file not found: " + args[0] + "\n",
    );
    process.exit(1);
  }

  // Full pipeline
  runFullPipeline()
    .then((code) => {
      process.exit(code);
    })
    .catch((err) => {
      process.stderr.write("[certify] Pipeline error: " + err.message + "\n");
      process.exit(1);
    });
}

// Export for unit tests; run main only when executed directly.
module.exports = {
  defaultLogPath,
  defaultEvidencePath,
  tailLines,
  appendCertificationBlock,
};

if (require.main === module) {
  main();
}
