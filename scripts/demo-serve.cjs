#!/usr/bin/env node
/**
 * scripts/demo-serve.cjs - One-command demo server.
 *
 * Builds the frontend, runs migrations, seeds the demo tenant, and starts
 * Express serving both API and static frontend on a single port.
 *
 * Usage: node scripts/demo-serve.cjs
 * npm script: npm run demo:serve
 */
"use strict";

const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const { buildDemoRuntimeEnv } = require("./demo-env.cjs");

const ROOT = process.cwd();
const PORT = process.env.PORT || 5000;

function run(label, cmd, env) {
  process.stdout.write("\n[demo-serve] " + label + "...\n");
  try {
    execSync(cmd, {
      cwd: ROOT,
      stdio: "inherit",
      timeout: 300000,
      env,
    });
  } catch {
    process.stderr.write("[demo-serve] FAILED: " + label + "\n");
    process.exit(1);
  }
}

function main() {
  const envLocal = path.join(ROOT, ".env.local");
  if (!fs.existsSync(envLocal)) {
    process.stderr.write(
      "[demo-serve] .env.local not found. Run: npm run demo:setup\n",
    );
    process.exit(1);
  }

  require("dotenv").config({ path: envLocal, override: false });
  require("dotenv").config({ path: path.join(ROOT, ".env"), override: false });

  const runtimeEnv = buildDemoRuntimeEnv(process.env);

  run("Building frontend", "npx vite build", runtimeEnv);
  run(
    "Running migrations",
    "node server/scripts/apply-all-migrations.cjs",
    runtimeEnv,
  );
  run(
    "Resetting demo tenant",
    "npx ts-node --transpile-only server/scripts/reset-sales-demo.ts",
    runtimeEnv,
  );
  run(
    "Seeding demo tenant",
    "npx ts-node --transpile-only server/scripts/seed-sales-demo.ts",
    runtimeEnv,
  );

  process.stdout.write("\n[demo-serve] Starting server on port " + PORT + "...\n");
  process.stdout.write(
    "[demo-serve] Open http://localhost:" + PORT + " in your browser\n",
  );
  process.stdout.write(
    "[demo-serve] To expose externally: npm run demo:tunnel (in another terminal)\n\n",
  );

  const serverEnv = buildDemoRuntimeEnv({
    ...process.env,
    ALLOW_DEMO_RESET: "1",
    PORT: String(PORT),
    VITE_DEMO_NAV_MODE: "sales",
  });

  execSync("npx ts-node --transpile-only server/index.ts", {
    cwd: ROOT,
    stdio: "inherit",
    env: serverEnv,
  });
}

main();
