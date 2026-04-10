/**
 * verify-sprint-cde.cjs
 *
 * Combined verification script for Sprints C, D, E.
 * Invokes all phase verify-*.cjs scripts and reports aggregated pass/fail totals.
 *
 * Tests R-P11-01, R-P11-02, R-P11-03, R-P11-04
 */

"use strict";

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const TRUCKER = path.join(ROOT, "apps", "trucker");

let totalPassed = 0;
let totalFailed = 0;
let scriptsPassed = 0;
let scriptsFailed = 0;

function check(id, description, condition) {
  if (condition) {
    totalPassed++;
    process.stdout.write("  PASS [" + id + "]: " + description + "\n");
  } else {
    totalFailed++;
    process.stderr.write("  FAIL [" + id + "]: " + description + "\n");
  }
}

function countMatches(str, regex) {
  const m = str.match(new RegExp(regex.source, "g"));
  return m ? m.length : 0;
}

// ============================================================
// Phase verification scripts to invoke
// ============================================================

// # Tests R-P11-03
const PHASE_SCRIPTS = [
  "verify-expo-project.cjs",
  "verify-mobile-auth.cjs",
  "verify-mobile-nav.cjs",
  "verify-trip-workspace.cjs",
  "verify-load-detail.cjs",
  "verify-status-update.cjs",
  "verify-camera-capture.cjs",
  "verify-doc-upload.cjs",
  "verify-doc-list.cjs",
  "verify-offline-core.cjs",
  "verify-upload-queue.cjs",
  "verify-queue-ui.cjs",
  "verify-background-sync.cjs",
];

process.stdout.write("\n=== Sprint CDE Combined Verification ===\n\n");

// Run each phase script
for (const script of PHASE_SCRIPTS) {
  const scriptPath = path.join(ROOT, "scripts", script);
  if (!fs.existsSync(scriptPath)) {
    process.stdout.write("[SKIP] " + script + " (not found)\n");
    continue;
  }

  process.stdout.write("[RUN]  " + script + "\n");
  try {
    execSync("node " + JSON.stringify(scriptPath), {
      cwd: ROOT,
      stdio: "inherit",
      timeout: 30000,
    });
    scriptsPassed++;
    process.stdout.write("[OK]   " + script + " passed\n\n");
  } catch (err) {
    scriptsFailed++;
    process.stderr.write("[FAIL] " + script + " failed\n\n");
  }
}

// ============================================================
// Home screen dashboard checks (R-P11-01, R-P11-02)
// ============================================================

process.stdout.write("\n--- Home Screen Dashboard Checks ---\n\n");

const homeScreenPath = path.join(TRUCKER, "src", "app", "(tabs)", "index.tsx");
const homeExists = fs.existsSync(homeScreenPath);

// # Tests R-P11-01
check("R-P11-01", "index.tsx exists", homeExists);
if (homeExists) {
  const homeContent = fs.readFileSync(homeScreenPath, "utf8");

  check(
    "R-P11-01",
    "index.tsx imports fetchLoads",
    /import\s*\{[^}]*fetchLoads[^}]*\}/.test(homeContent) ||
      /from\s+["'].*loads["']/.test(homeContent),
  );
  check(
    "R-P11-01",
    "index.tsx calls fetchLoads()",
    /fetchLoads\s*\(/.test(homeContent),
  );
  check(
    "R-P11-01",
    'index.tsx renders "Active Loads" card',
    /Active\s+Loads/.test(homeContent),
  );
  check(
    "R-P11-01",
    "index.tsx filters by active statuses (dispatched, in_transit, arrived)",
    /dispatched/.test(homeContent) &&
      /in_transit/.test(homeContent) &&
      /arrived/.test(homeContent),
  );
  check(
    "R-P11-01",
    "index.tsx counts active loads",
    /activeLoadCount/.test(homeContent) || /\.filter\(/.test(homeContent),
  );

  // # Tests R-P11-02
  check(
    "R-P11-02",
    "index.tsx imports getQueueItems",
    /import\s*\{[^}]*getQueueItems[^}]*\}/.test(homeContent) ||
      /from\s+["'].*uploadQueue["']/.test(homeContent),
  );
  check(
    "R-P11-02",
    "index.tsx calls getQueueItems()",
    /getQueueItems\s*\(/.test(homeContent),
  );
  check(
    "R-P11-02",
    'index.tsx renders "Pending Uploads" card',
    /Pending\s+Uploads/.test(homeContent),
  );
  check(
    "R-P11-02",
    "index.tsx shows pending uploads only when count > 0",
    /pendingUploadCount\s*>\s*0/.test(homeContent) ||
      /count\s*>\s*0/.test(homeContent),
  );
}

// ============================================================
// Script existence checks (R-P11-03)
// ============================================================

process.stdout.write("\n--- Phase Script Existence Checks ---\n\n");

// # Tests R-P11-03
const coreScripts = [
  "verify-trip-workspace.cjs",
  "verify-load-detail.cjs",
  "verify-status-update.cjs",
  "verify-camera-capture.cjs",
  "verify-doc-upload.cjs",
  "verify-doc-list.cjs",
  "verify-offline-core.cjs",
  "verify-upload-queue.cjs",
  "verify-queue-ui.cjs",
  "verify-expo-project.cjs",
];

let coreScriptsFound = 0;
for (const script of coreScripts) {
  const exists = fs.existsSync(path.join(ROOT, "scripts", script));
  if (exists) {
    coreScriptsFound++;
  }
  check("R-P11-03", script + " exists", exists);
}

check(
  "R-P11-03",
  "All 10 core phase verify scripts found",
  coreScriptsFound === 10,
);

// ============================================================
// Summary
// ============================================================

process.stdout.write("\n=== Summary ===\n");
process.stdout.write(
  "Phase scripts: " +
    scriptsPassed +
    " passed, " +
    scriptsFailed +
    " failed\n",
);
process.stdout.write(
  "Local checks:  " +
    totalPassed +
    " passed, " +
    totalFailed +
    " failed\n",
);

const failures = scriptsFailed + totalFailed;
const passes = scriptsPassed + totalPassed;
process.stdout.write(
  "Total:         " + passes + " passed, " + failures + " failed\n\n",
);

// # Tests R-P11-04
if (failures > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
