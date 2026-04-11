#!/usr/bin/env node
/**
 * scripts/demo-setup.cjs — One-command sales demo provisioning.
 *
 * Usage:  node scripts/demo-setup.cjs
 *   or:   npm run demo:setup
 *
 * Pipeline:
 *   1. Checks .env.local exists (copies template if missing)
 *   2. Validates required env vars are set and not placeholders
 *   3. Runs database migrations
 *   4. Runs demo reset (clears prior demo data)
 *   5. Runs demo seed (populates hero load + supporting rows)
 *   6. Prints success summary with next steps
 *
 * All paths use path.join / os.tmpdir — works on Windows, Mac, and Linux.
 */
"use strict";

const { execSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const ENV_LOCAL = path.join(PROJECT_ROOT, ".env.local");
const ENV_TEMPLATE = path.join(PROJECT_ROOT, ".env.example.sales-demo");

/* ------------------------------------------------------------------ */
/*  Color helpers (no-op when piped)                                   */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  Step 1: Ensure .env.local exists                                   */
/* ------------------------------------------------------------------ */

function ensureEnvLocal() {
  if (fs.existsSync(ENV_LOCAL)) {
    info(".env.local found.");
    return true;
  }

  if (fs.existsSync(ENV_TEMPLATE)) {
    fs.copyFileSync(ENV_TEMPLATE, ENV_LOCAL);
    warn(
      ".env.local was missing. Copied from .env.example.sales-demo.\n" +
        "\n" +
        "  Please open " + ENV_LOCAL + "\n" +
        "  and fill in all <fill-in> placeholder values, then re-run:\n" +
        "\n" +
        "    npm run demo:setup\n"
    );
  } else {
    fail(
      ".env.local is missing and no template was found at:\n" +
        "  " + ENV_TEMPLATE + "\n" +
        "\n" +
        "  Create .env.local with the required variables and re-run."
    );
  }
  return false;
}

/* ------------------------------------------------------------------ */
/*  Step 2: Validate required env vars                                 */
/* ------------------------------------------------------------------ */

/**
 * Minimal .env parser — handles KEY=VALUE, KEY="VALUE", comments, blanks.
 * Does not expand variables ($VAR). Sufficient for validation.
 */
function parseEnvFile(filePath) {
  const vars = {};
  const content = fs.readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIdx = line.indexOf("=");
    if (eqIdx < 1) continue;
    const key = line.slice(0, eqIdx).trim();
    let value = line.slice(eqIdx + 1).trim();
    // Strip surrounding quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    vars[key] = value;
  }
  return vars;
}

const REQUIRED_VARS = [
  { key: "DB_HOST" },
  { key: "DB_PORT" },
  { key: "DB_USER" },
  { key: "DB_PASSWORD" },
  { key: "DB_NAME" },
  { key: "SALES_DEMO_ADMIN_FIREBASE_UID" },
  { key: "SALES_DEMO_DRIVER_FIREBASE_UID" },
  { key: "VITE_DEMO_NAV_MODE", exact: "sales" },
  { key: "ALLOW_DEMO_RESET", exact: "1" },
];

const PLACEHOLDER_PATTERN = /<fill[- ]?in>/i;

function validateEnvVars() {
  const vars = parseEnvFile(ENV_LOCAL);
  const problems = [];

  for (const spec of REQUIRED_VARS) {
    const value = vars[spec.key];

    if (value === undefined || value === "") {
      problems.push("  - " + spec.key + " is missing or empty");
      continue;
    }

    if (PLACEHOLDER_PATTERN.test(value)) {
      problems.push("  - " + spec.key + " still contains a <fill-in> placeholder");
      continue;
    }

    if (spec.exact && value !== spec.exact) {
      problems.push(
        "  - " + spec.key + ' must be "' + spec.exact + '" (got "' + value + '")'
      );
    }
  }

  if (problems.length > 0) {
    fail(
      "The following .env.local variables need attention:\n" +
        "\n" +
        problems.join("\n") +
        "\n" +
        "\n" +
        "  Fix them in " + ENV_LOCAL + " and re-run:\n" +
        "    npm run demo:setup\n"
    );
    return false;
  }

  success("All required env vars validated.");
  return true;
}

/* ------------------------------------------------------------------ */
/*  Step 3-5: Run commands                                             */
/* ------------------------------------------------------------------ */

function runStep(stepNum, totalSteps, label, cmd) {
  const prefix =
    BOLD + "[" + stepNum + "/" + totalSteps + "]" + RESET + " " + label;
  info(prefix);
  info("  > " + cmd);

  try {
    execSync(cmd, {
      cwd: PROJECT_ROOT,
      stdio: "inherit",
      timeout: 180000, // 3 min per step
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

/* ------------------------------------------------------------------ */
/*  Step 6: Success summary                                            */
/* ------------------------------------------------------------------ */

function printSummary() {
  const divider = "=".repeat(48);
  process.stdout.write(
    "\n" +
      GREEN + divider + RESET + "\n" +
      GREEN + BOLD + "  Demo setup complete!" + RESET + "\n" +
      GREEN + divider + RESET + "\n" +
      "\n" +
      "  Next steps:\n" +
      "    1. Start the backend:  " + BOLD + "npm run server" + RESET + "\n" +
      "    2. Start the frontend: " + BOLD + "npm run dev" + RESET + "\n" +
      "    3. Open " + BOLD + "http://localhost:3000" + RESET + " in Chrome\n" +
      "    4. Log in with the admin Firebase user\n" +
      "\n"
  );
}

/* ------------------------------------------------------------------ */
/*  Main                                                               */
/* ------------------------------------------------------------------ */

function main() {
  process.stdout.write("\n");
  info("Sales Demo Setup");
  info("Project root: " + PROJECT_ROOT);
  process.stdout.write("\n");

  // Step 1: Ensure .env.local
  info(BOLD + "[1/5]" + RESET + " Checking .env.local...");
  if (!ensureEnvLocal()) {
    process.exit(1);
  }

  // Step 2: Validate env vars
  info(BOLD + "[2/5]" + RESET + " Validating environment variables...");
  if (!validateEnvVars()) {
    process.exit(1);
  }

  process.stdout.write("\n");

  // Step 3: Run migrations
  runStep(3, 5, "Running database migrations",
    "node " + path.join("server", "scripts", "apply-all-migrations.cjs"));

  // Step 4: Reset demo
  runStep(4, 5, "Resetting demo tenant",
    "npx ts-node --transpile-only " + path.join("server", "scripts", "reset-sales-demo.ts"));

  // Step 5: Seed demo
  runStep(5, 5, "Seeding demo data",
    "npx ts-node --transpile-only " + path.join("server", "scripts", "seed-sales-demo.ts"));

  // Done
  printSummary();
  process.exit(0);
}

// Export for testability; run main only when executed directly.
module.exports = {
  parseEnvFile,
  REQUIRED_VARS,
  PLACEHOLDER_PATTERN,
};

if (require.main === module) {
  main();
}
