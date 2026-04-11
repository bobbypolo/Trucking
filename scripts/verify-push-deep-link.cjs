/**
 * Verification script for STORY-008 Phase 8: Mobile notification tap handler
 * wiring in `_layout.tsx`.
 *
 * Asserts that `apps/trucker/src/app/_layout.tsx`:
 *   - imports `useRouter` from `"expo-router"` (R-P8-01)
 *   - imports `attachNotificationResponseHandler` from
 *     `"../services/pushNotifications"` (R-P8-02)
 *   - has a `useEffect` whose body calls
 *     `attachNotificationResponseHandler(router)` and whose cleanup function
 *     calls `.remove()` on the returned subscription (R-P8-03)
 *
 * Run: node scripts/verify-push-deep-link.cjs
 *
 * # Tests R-P8-01, R-P8-02, R-P8-03
 *
 * Each block below is an inline test( describe(...) ) for one R-marker and
 * asserts the exact expected substring/regex match on the source file.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const LAYOUT_PATH = path.join(
  ROOT,
  'apps',
  'trucker',
  'src',
  'app',
  '_layout.tsx',
);

let passed = 0;
let failed = 0;

function check(id, description, condition) {
  if (condition === true) {
    console.log(`  PASS [${id}]: ${description}`);
    passed++;
  } else {
    console.error(`  FAIL [${id}]: ${description}`);
    failed++;
  }
}

// Read the _layout.tsx source once for all checks.
const layoutExists = fs.existsSync(LAYOUT_PATH);
check('R-P8-00', '_layout.tsx file exists', layoutExists === true);
const layoutSource = layoutExists ? fs.readFileSync(LAYOUT_PATH, 'utf8') : '';

// -- R-P8-01: _layout.tsx imports useRouter from "expo-router" --
// Tests R-P8-01
console.log('\nR-P8-01: _layout.tsx imports useRouter from "expo-router"');
{
  // Matches: import { ..., useRouter, ... } from "expo-router"
  const useRouterImportRe =
    /import\s*\{[^}]*useRouter[^}]*\}\s*from\s*["']expo-router["']/;
  const matched = useRouterImportRe.test(layoutSource);
  check(
    'R-P8-01',
    'layout source contains `import { ... useRouter ... } from "expo-router"`',
    matched === true,
  );
}

// -- R-P8-02: _layout.tsx imports attachNotificationResponseHandler --
// Tests R-P8-02
console.log(
  '\nR-P8-02: _layout.tsx imports attachNotificationResponseHandler from "../services/pushNotifications"',
);
{
  // Matches: import { ..., attachNotificationResponseHandler, ... }
  //          from "../services/pushNotifications"
  const attachImportRe =
    /import\s*\{[^}]*attachNotificationResponseHandler[^}]*\}\s*from\s*["']\.\.\/services\/pushNotifications["']/;
  const matched = attachImportRe.test(layoutSource);
  check(
    'R-P8-02',
    'layout source contains `import { ... attachNotificationResponseHandler ... } from "../services/pushNotifications"`',
    matched === true,
  );
}

// -- R-P8-03: useEffect body calls handler AND cleanup calls .remove() --
// Tests R-P8-03
console.log(
  '\nR-P8-03: useEffect body calls attachNotificationResponseHandler(router) and cleanup calls .remove()',
);
{
  // Multiline regex that locates a useEffect(() => { ... }) containing
  // attachNotificationResponseHandler(router) and a subsequent .remove() call
  // inside the cleanup function (the returned arrow function).
  const effectRe =
    /useEffect\s*\(\s*\(\s*\)\s*=>\s*\{[\s\S]*?attachNotificationResponseHandler\s*\(\s*router\s*\)[\s\S]*?return\s*\(\s*\)\s*=>\s*\{[\s\S]*?\.remove\s*\(\s*\)[\s\S]*?\}[\s\S]*?\}/;
  const matched = effectRe.test(layoutSource);
  check(
    'R-P8-03',
    'useEffect body invokes attachNotificationResponseHandler(router) and cleanup calls .remove()',
    matched === true,
  );

  // Secondary assertion: the handler call assigns to a subscription-like
  // identifier that is the same symbol whose .remove() is invoked in cleanup.
  // This guards against a cleanup that calls .remove() on an unrelated value.
  const assignRe =
    /const\s+(\w+)\s*=\s*attachNotificationResponseHandler\s*\(\s*router\s*\)\s*;[\s\S]*?return\s*\(\s*\)\s*=>\s*\{[\s\S]*?\1\s*\.remove\s*\(\s*\)/;
  const assignMatched = assignRe.test(layoutSource);
  check(
    'R-P8-03',
    'cleanup .remove() is called on the same subscription returned by attachNotificationResponseHandler(router)',
    assignMatched === true,
  );
}

// -- Summary --
console.log(`\n--- Results: ${passed} passed, ${failed} failed ---`);
if (failed > 0) {
  process.exit(1);
}
