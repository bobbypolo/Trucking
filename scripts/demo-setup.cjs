#!/usr/bin/env node
/**
 * scripts/demo-setup.cjs - One-command sales demo provisioning.
 *
 * Usage: node scripts/demo-setup.cjs
 *    or: npm run demo:setup
 *
 * Pipeline:
 *   1. Ensure .env.local exists
 *   2. Validate required env vars
 *   3. Run database migrations
 *   4. Reset the demo tenant
 *   5. Seed the demo tenant
 *   6. Print the next-step launch command
 */
"use strict";

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const {
  ENV_LOCAL,
  ENV_TEMPLATE,
  PLACEHOLDER_PATTERN,
  REQUIRED_DEMO_VARS,
  formatDemoEnvProblems,
  validateDemoEnvFile,
} = require("./demo-env.cjs");

const PROJECT_ROOT = path.resolve(__dirname, "..");

const IS_TTY = process.stdout.isTTY;
const RED = IS_TTY ? "\x1b[31m" : "";
const GREEN = IS_TTY ? "\x1b[32m" : "";
const YELLOW = IS_TTY ? "\x1b[33m" : "";
const CYAN = IS_TTY ? "\x1b[36m" : "";
const BOLD = IS_TTY ? "\x1b[1m" : "";
const RESET = IS_TTY ? "\x1b[0m" : "";

function info(msg) {
  process.stdout.write(CYAN + "[demo-setup] " + RESET + msg + "\n");
}

function success(msg) {
  process.stdout.write(GREEN + "[demo-setup] " + RESET + msg + "\n");
}

function warn(msg) {
  process.stdout.write(YELLOW + "[demo-setup] " + RESET + msg + "\n");
}

function fail(msg) {
  process.stderr.write(RED + "[demo-setup] ERROR: " + RESET + msg + "\n");
}

function ensureEnvLocal() {
  if (fs.existsSync(ENV_LOCAL)) {
    info(".env.local found.");
    return true;
  }

  if (!fs.existsSync(ENV_TEMPLATE)) {
    fail(
      ".env.local is missing and no template was found at:\n" +
        "  " +
        ENV_TEMPLATE +
        "\n\n" +
        "Create .env.local with the required variables and re-run.",
    );
    return false;
  }

  fs.copyFileSync(ENV_TEMPLATE, ENV_LOCAL);
  warn(
    ".env.local was missing. Copied from .env.example.sales-demo.\n\n" +
      "Open " +
      ENV_LOCAL +
      " and fill in every <fill-in> placeholder value, then re-run:\n\n" +
      "  npm run demo:setup\n",
  );
  return false;
}

function validateEnvVars() {
  const { vars, problems } = validateDemoEnvFile(ENV_LOCAL, {
    requireGemini: true,
  });

  if (problems.length > 0) {
    fail(formatDemoEnvProblems(problems, ENV_LOCAL));
    return false;
  }

  if (PLACEHOLDER_PATTERN.test(vars.GEMINI_API_KEY || "")) {
    fail("GEMINI_API_KEY still contains a placeholder value in .env.local.");
    return false;
  }

  success("All required env vars validated.");
  return true;
}

function runStep(stepNum, totalSteps, label, cmd) {
  const prefix = BOLD + "[" + stepNum + "/" + totalSteps + "]" + RESET + " " + label;
  info(prefix);
  info("  > " + cmd);

  try {
    execSync(cmd, {
      cwd: PROJECT_ROOT,
      stdio: "inherit",
      timeout: 180000,
      env: { ...process.env },
    });
  } catch (err) {
    fail(label + " failed (exit code " + (err.status || "unknown") + ").");
    if (err.stderr) {
      process.stderr.write(String(err.stderr) + "\n");
    }
    process.exit(1);
  }

  success(label + " completed.");
}

function printSummary() {
  const divider = "=".repeat(48);
  process.stdout.write(
    "\n" +
      GREEN + divider + RESET + "\n" +
      GREEN + BOLD + "  Demo setup complete!" + RESET + "\n" +
      GREEN + divider + RESET + "\n\n" +
      "Next steps:\n" +
      "  1. Launch the demo host: " +
      BOLD +
      "npm run demo:host:sales" +
      RESET +
      "\n" +
      "  2. Open " +
      BOLD +
      "http://localhost:3000" +
      RESET +
      " in Chrome\n" +
      "  3. Log in with the admin Firebase user\n\n",
  );
}

function main() {
  process.stdout.write("\n");
  info("Sales Demo Setup");
  info("Project root: " + PROJECT_ROOT);
  process.stdout.write("\n");

  info(BOLD + "[1/5]" + RESET + " Checking .env.local...");
  if (!ensureEnvLocal()) {
    process.exit(1);
  }

  info(BOLD + "[2/5]" + RESET + " Validating environment variables...");
  if (!validateEnvVars()) {
    process.exit(1);
  }

  process.stdout.write("\n");

  runStep(
    3,
    5,
    "Running database migrations",
    "node " + path.join("server", "scripts", "apply-all-migrations.cjs"),
  );

  runStep(
    4,
    5,
    "Resetting demo tenant",
    "npx ts-node --transpile-only " +
      path.join("server", "scripts", "reset-sales-demo.ts"),
  );

  runStep(
    5,
    5,
    "Seeding demo data",
    "npx ts-node --transpile-only " +
      path.join("server", "scripts", "seed-sales-demo.ts"),
  );

  printSummary();
  process.exit(0);
}

module.exports = {
  parseEnvFile: require("./demo-env.cjs").parseEnvFile,
  REQUIRED_VARS: REQUIRED_DEMO_VARS,
  PLACEHOLDER_PATTERN,
};

if (require.main === module) {
  main();
}
