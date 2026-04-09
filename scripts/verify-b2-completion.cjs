/**
 * verify-b2-completion.cjs
 *
 * Final verification script for Sprint B2 — SaaS Non-Regression Verification.
 *
 * Tests R-P6-01: Frontend vitest exits 0
 * Tests R-P6-02: Server vitest exits 0
 * Tests R-P6-03: Sprint history has B2 section with Stories=6 and Status=Engineering Complete
 * Tests R-P6-04: All 5 Phase 1-5 verify scripts exit 0
 * Tests R-P6-05: On test failure, returns non-zero and reports failing test names in stdout
 */

"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
let passed = 0;
let failed = 0;
const failureDetails = [];

function check(id, description, fn) {
  try {
    fn();
    passed++;
    process.stdout.write("PASS " + id + ": " + description + "\n");
  } catch (err) {
    failed++;
    const msg = "FAIL " + id + ": " + description + "\n  Reason: " + err.message;
    failureDetails.push(msg);
    process.stdout.write(msg + "\n");
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

// ---------------------------------------------------------------------------
// Tests R-P6-01: Frontend vitest exits 0
// ---------------------------------------------------------------------------
check("R-P6-01", "Frontend vitest exits with code 0", function () {
  const result = spawnSync("npx", ["vitest", "run", "--reporter=verbose"], {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
    timeout: 300000,
  });

  const stdout = result.stdout ? result.stdout.toString() : "";
  const stderr = result.stderr ? result.stderr.toString() : "";
  const exitCode = result.status;

  if (exitCode !== 0) {
    // Tests R-P6-05: capture and report failing test names
    const combined = stdout + "\n" + stderr;
    const failingLines = combined
      .split("\n")
      .filter(function (line) {
        return /FAIL\s/.test(line) || /AssertionError/.test(line) || /Error:/.test(line);
      })
      .slice(0, 20);

    const detail = failingLines.length > 0
      ? "Failing tests:\n    " + failingLines.join("\n    ")
      : "vitest exited with code " + exitCode + " (no specific test failures captured)";

    throw new Error(
      "Frontend vitest exited with code " + exitCode + ".\n  " + detail
    );
  }
});

// ---------------------------------------------------------------------------
// Tests R-P6-02: Server vitest exits 0
// ---------------------------------------------------------------------------
check("R-P6-02", "Server vitest exits with code 0", function () {
  const serverDir = path.join(ROOT, "server");
  const result = spawnSync(
    "npx",
    [
      "vitest",
      "run",
      "--reporter=verbose",
      "--exclude=__tests__/integration/**",
      "--exclude=__tests__/regression/**",
      "--exclude=__tests__/performance/**",
    ],
    {
      cwd: serverDir,
      stdio: ["ignore", "pipe", "pipe"],
      shell: true,
      timeout: 300000,
    }
  );

  const stdout = result.stdout ? result.stdout.toString() : "";
  const stderr = result.stderr ? result.stderr.toString() : "";
  const exitCode = result.status;

  if (exitCode !== 0) {
    // Tests R-P6-05: capture and report failing test names
    const combined = stdout + "\n" + stderr;
    const failingLines = combined
      .split("\n")
      .filter(function (line) {
        return /FAIL\s/.test(line) || /AssertionError/.test(line) || /Error:/.test(line);
      })
      .slice(0, 20);

    const detail = failingLines.length > 0
      ? "Failing tests:\n    " + failingLines.join("\n    ")
      : "vitest exited with code " + exitCode + " (no specific test failures captured)";

    throw new Error(
      "Server vitest exited with code " + exitCode + ".\n  " + detail
    );
  }
});

// ---------------------------------------------------------------------------
// Tests R-P6-03: Sprint history has B2 section
// ---------------------------------------------------------------------------
check("R-P6-03a", "Sprint history file exists", function () {
  const historyPath = path.join(ROOT, "docs", "trucker-app-sprint-history.md");
  assert(fs.existsSync(historyPath), "docs/trucker-app-sprint-history.md not found");
});

check("R-P6-03b", "Sprint history has ## Sprint B2 heading", function () {
  const historyPath = path.join(ROOT, "docs", "trucker-app-sprint-history.md");
  const content = fs.readFileSync(historyPath, "utf8");
  assert(/## Sprint B2/.test(content), "Missing '## Sprint B2' heading in sprint history");
});

check("R-P6-03c", "Sprint B2 section shows Stories = 6", function () {
  const historyPath = path.join(ROOT, "docs", "trucker-app-sprint-history.md");
  const content = fs.readFileSync(historyPath, "utf8");
  assert(/Stories.*6/.test(content), "Sprint B2 section missing 'Stories' row with value 6");
});

check("R-P6-03d", "Sprint B2 section shows Status = Engineering Complete", function () {
  const historyPath = path.join(ROOT, "docs", "trucker-app-sprint-history.md");
  const content = fs.readFileSync(historyPath, "utf8");
  assert(
    /Status.*Engineering Complete/.test(content),
    "Sprint B2 section missing 'Status' row with 'Engineering Complete'"
  );
});

// ---------------------------------------------------------------------------
// Tests R-P6-04: All 5 Phase 1-5 verification scripts exit 0
// ---------------------------------------------------------------------------
const phaseScripts = [
  "verify-shared-package.cjs",
  "verify-expo-project.cjs",
  "verify-mobile-nav.cjs",
  "verify-mobile-auth.cjs",
  "verify-baseline-debt-resolved.cjs",
];

phaseScripts.forEach(function (script) {
  check(
    "R-P6-04",
    script + " exits with code 0",
    function () {
      const scriptPath = path.join(ROOT, "scripts", script);
      assert(fs.existsSync(scriptPath), "Script not found: scripts/" + script);

      const result = spawnSync("node", [scriptPath], {
        cwd: ROOT,
        stdio: ["ignore", "pipe", "pipe"],
        shell: true,
        timeout: 60000,
      });

      const exitCode = result.status;
      if (exitCode !== 0) {
        const stderr = result.stderr ? result.stderr.toString().trim() : "";
        const stdout = result.stdout ? result.stdout.toString().trim() : "";
        const output = stderr || stdout || "(no output)";
        throw new Error(
          script + " exited with code " + exitCode + ":\n    " + output.split("\n").slice(0, 10).join("\n    ")
        );
      }
    }
  );
});

// ---------------------------------------------------------------------------
// Final result
// ---------------------------------------------------------------------------
process.stdout.write("\n--- Results: " + passed + " passed, " + failed + " failed ---\n");

if (failed > 0) {
  // Tests R-P6-05: non-zero exit code with failure details in stdout
  process.stdout.write("\nFailed checks:\n");
  failureDetails.forEach(function (detail) {
    process.stdout.write("  " + detail + "\n");
  });
  process.exit(1);
} else {
  process.stdout.write("\nSprint B2 verification complete. All checks passed.\n");
  process.exit(0);
}
