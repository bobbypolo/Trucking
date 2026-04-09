/**
 * Verification script for Sprint B2 Phase 5 — Baseline Debt Cleanup
 *
 * Tests R-P5-01: @types/jszip in devDependencies or type declaration exists
 * Tests R-P5-02: server/__tests__/helpers/port-env.ts exists with process.env.PORT assignment
 * Tests R-P5-03: .claude/hooks/tests/ directory exists
 * Tests R-P5-04: docs/trucker-app-baseline-debt.md has resolution annotations
 */

"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
let failures = 0;

function assert(condition, message) {
  if (!condition) {
    failures++;
    process.stderr.write("[FAIL] " + message + "\n");
  } else {
    process.stdout.write("[PASS] " + message + "\n");
  }
}

// Tests R-P5-01
// jszip types available for e2e
{
  const pkgPath = path.join(ROOT, "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  const devDeps = pkg.devDependencies || {};
  const hasTypesJszip = "@types/jszip" in devDeps;

  // Also check for a local type declaration file
  const declPath = path.join(ROOT, "e2e", "jszip.d.ts");
  const hasLocalDecl = fs.existsSync(declPath);

  assert(
    hasTypesJszip || hasLocalDecl,
    "R-P5-01: @types/jszip is in devDependencies or a type declaration exists for jszip"
  );
}

// Tests R-P5-02
// port-env.ts exists and sets process.env.PORT
{
  const portEnvPath = path.join(
    ROOT,
    "server",
    "__tests__",
    "helpers",
    "port-env.ts"
  );
  assert(
    fs.existsSync(portEnvPath),
    "R-P5-02a: server/__tests__/helpers/port-env.ts exists"
  );

  if (fs.existsSync(portEnvPath)) {
    const content = fs.readFileSync(portEnvPath, "utf8");
    const hasProcessEnvPort = /process\.env\.PORT\s*=/.test(content);
    assert(
      hasProcessEnvPort,
      "R-P5-02b: port-env.ts contains process.env.PORT assignment (not shell syntax)"
    );

    // Must NOT use shell PORT=5000 syntax — must use JavaScript assignment
    const hasShellSyntax = /^PORT=\d+/m.test(content);
    assert(
      !hasShellSyntax,
      "R-P5-02c: port-env.ts does not use shell PORT=5000 syntax"
    );
  }
}

// Tests R-P5-03
// .claude/hooks/tests/ directory exists
{
  const hooksTestsDir = path.join(ROOT, ".claude", "hooks", "tests");
  assert(
    fs.existsSync(hooksTestsDir),
    "R-P5-03: .claude/hooks/tests/ directory exists"
  );
}

// Tests R-P5-04
// debt register has resolution annotations
{
  const debtDocPath = path.join(ROOT, "docs", "trucker-app-baseline-debt.md");
  assert(
    fs.existsSync(debtDocPath),
    "R-P5-04a: docs/trucker-app-baseline-debt.md exists"
  );

  if (fs.existsSync(debtDocPath)) {
    const content = fs.readFileSync(debtDocPath, "utf8");

    // Each of the 3 debt entries must have a resolution annotation
    const resolvedPattern = /resolved|closed|fixed/gi;
    const matches = content.match(resolvedPattern) || [];
    assert(
      matches.length >= 3,
      "R-P5-04b: debt register contains at least 3 resolution annotations (found " +
        matches.length +
        ")"
    );

    // Specific debt items should have resolution notes
    assert(
      /jszip.*(?:resolved|fixed|closed)/is.test(content),
      "R-P5-04c: jszip types debt entry has resolution annotation"
    );
    assert(
      /PORT.*(?:resolved|fixed|closed)/is.test(content),
      "R-P5-04d: PORT env debt entry has resolution annotation"
    );
    assert(
      /hooks.*tests.*(?:resolved|fixed|closed)/is.test(content),
      "R-P5-04e: hooks/tests dir debt entry has resolution annotation"
    );
  }
}

// Final result
if (failures > 0) {
  process.stderr.write(
    "\n" + failures + " assertion(s) failed. Baseline debt NOT fully resolved.\n"
  );
  process.exit(1);
} else {
  process.stdout.write("\nAll baseline debt items verified as resolved.\n");
  process.exit(0);
}
