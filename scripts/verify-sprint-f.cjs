/**
 * verify-sprint-f.cjs
 *
 * Combined verification script for Sprint F: Push Notifications + Driver
 * Profile + Settings. Invokes every Sprint F phase verify-*.cjs script via
 * child_process.spawnSync and then checks the sprint-history file for a
 * `## Sprint F` heading.
 *
 * Run: node scripts/verify-sprint-f.cjs
 *
 * # Tests R-P12-01, R-P12-02, R-P12-03
 *
 * Each block below is an inline test( describe(...) ) for one R-marker.
 *
 *   inline test(R-P12-01): verify-sprint-f.cjs references all 5 Sprint F
 *     mobile verify scripts (verify-push-service.cjs,
 *     verify-auth-push-wiring.cjs, verify-push-deep-link.cjs,
 *     verify-profile-screen.cjs, verify-settings-screen.cjs).
 *   inline test(R-P12-02): this script calls process.exit with a non-zero
 *     integer argument on any verify-script failure or on sprint-history
 *     heading absence (regex /process\.exit\s*\(\s*[1-9]\d*\s*\)/).
 *   inline test(R-P12-03): docs/trucker-app-sprint-history.md contains an
 *     H2 heading matching /^## Sprint F/m.
 */

"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const SPRINT_HISTORY_PATH = path.join(
  ROOT,
  "docs",
  "trucker-app-sprint-history.md",
);

// ============================================================
// R-P12-01: list of Sprint F mobile verify scripts to run in order
// ============================================================
//
// These literal filenames MUST appear verbatim in this source file so the
// R-P12-01 regex count succeeds: verify-push-service.cjs,
// verify-auth-push-wiring.cjs, verify-push-deep-link.cjs,
// verify-profile-screen.cjs, verify-settings-screen.cjs.
const SPRINT_F_SCRIPTS = [
  "verify-push-service.cjs",
  "verify-auth-push-wiring.cjs",
  "verify-push-deep-link.cjs",
  "verify-profile-screen.cjs",
  "verify-settings-screen.cjs",
];

let scriptsPassed = 0;
let scriptsFailed = 0;

process.stdout.write("\n=== Sprint F Combined Verification ===\n\n");

// Run each Sprint F phase verify script via spawnSync("node", [script]).
for (const script of SPRINT_F_SCRIPTS) {
  const scriptPath = path.join(ROOT, "scripts", script);

  if (!fs.existsSync(scriptPath)) {
    scriptsFailed++;
    process.stderr.write("[MISSING] " + script + " not found at " + scriptPath + "\n");
    continue;
  }

  process.stdout.write("[RUN]  " + script + "\n");
  const result = spawnSync("node", [scriptPath], {
    cwd: ROOT,
    stdio: "inherit",
    timeout: 60000,
  });

  if (result.error) {
    scriptsFailed++;
    process.stderr.write(
      "[FAIL] " + script + " spawn error: " + result.error.message + "\n\n",
    );
    continue;
  }

  if (typeof result.status === "number" && result.status === 0) {
    scriptsPassed++;
    process.stdout.write("[OK]   " + script + " passed\n\n");
  } else {
    scriptsFailed++;
    process.stderr.write(
      "[FAIL] " + script + " exited with status " + String(result.status) + "\n\n",
    );
  }
}

// ============================================================
// R-P12-03: sprint-history heading check
// ============================================================

process.stdout.write("--- Sprint History Heading Check ---\n\n");

let historyHeadingFound = false;
if (!fs.existsSync(SPRINT_HISTORY_PATH)) {
  process.stderr.write(
    "[FAIL] sprint history file not found: " + SPRINT_HISTORY_PATH + "\n",
  );
} else {
  const historyContent = fs.readFileSync(SPRINT_HISTORY_PATH, "utf8");
  historyHeadingFound = /^## Sprint F/m.test(historyContent);
  if (historyHeadingFound) {
    process.stdout.write(
      "  PASS [R-P12-03]: docs/trucker-app-sprint-history.md contains `## Sprint F` heading\n",
    );
  } else {
    process.stderr.write(
      "  FAIL [R-P12-03]: docs/trucker-app-sprint-history.md missing `## Sprint F` heading\n",
    );
  }
}

// ============================================================
// Summary
// ============================================================

process.stdout.write("\n=== Summary ===\n");
process.stdout.write(
  "Sprint F scripts: " + scriptsPassed + " passed, " + scriptsFailed + " failed\n",
);
process.stdout.write(
  "History heading:  " + (historyHeadingFound ? "PASS" : "FAIL") + "\n\n",
);

// # Tests R-P12-02
// Non-zero exit on any failure so CI pipelines and the Sprint F gate
// command can detect regressions.
if (scriptsFailed > 0 || !historyHeadingFound) {
  process.exit(1);
}
process.exit(0);
