/**
 * Verification script for STORY-002 Phase 2: AuthContext push-token wiring.
 *
 * Asserts that apps/trucker/src/contexts/AuthContext.tsx wires the 5 push
 * notification functions from ../services/pushNotifications into the auth
 * lifecycle: on login, request permission → fetch token → register on
 * backend → attach rotation listener; on logout, unregister BEFORE calling
 * Firebase signOut. All assertions are source-level regex checks (no runtime
 * RN environment is spun up) so this script can run in Node on CI.
 *
 * Run: node scripts/verify-auth-push-wiring.cjs
 *
 * # Tests R-P2-01, R-P2-02, R-P2-03, R-P2-04, R-P2-05
 *
 * Each block below is an inline test( describe(...) ) for one R-marker.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const AUTH_CONTEXT_PATH = path.join(
  ROOT,
  'apps',
  'trucker',
  'src',
  'contexts',
  'AuthContext.tsx',
);

let passed = 0;
let failed = 0;

function check(id, description, condition) {
  if (condition) {
    console.log(`  PASS [${id}]: ${description}`);
    passed++;
  } else {
    console.error(`  FAIL [${id}]: ${description}`);
    failed++;
  }
}

const exists = fs.existsSync(AUTH_CONTEXT_PATH);
check('SETUP', 'AuthContext.tsx file exists', exists);
const source = exists ? fs.readFileSync(AUTH_CONTEXT_PATH, 'utf8') : '';

// -- R-P2-01: Single import statement pulling all 5 push functions from ../services/pushNotifications --
// Tests R-P2-01
console.log(
  '\nR-P2-01: single import pulls all 5 push functions from ../services/pushNotifications',
);
{
  // Find an import block that ends with `from "../services/pushNotifications"`
  // and capture its specifier list.
  const importRe =
    /import\s*\{([\s\S]*?)\}\s*from\s*["']\.\.\/services\/pushNotifications["']/;
  const match = source.match(importRe);
  check(
    'R-P2-01',
    'has an `import { ... } from "../services/pushNotifications"` block',
    match !== null,
  );
  const specifiers = match ? match[1] : '';
  const required = [
    'requestPushPermissions',
    'getPushToken',
    'registerPushToken',
    'unregisterPushToken',
    'attachTokenRefreshListener',
  ];
  for (const name of required) {
    check(
      'R-P2-01',
      `single import specifier list includes \`${name}\``,
      new RegExp(`\\b${name}\\b`).test(specifiers),
    );
  }
}

// -- R-P2-02: useEffect body calls the 4 functions IN ORDER with isAuthenticated in deps --
// Tests R-P2-02
console.log(
  '\nR-P2-02: useEffect body calls requestPushPermissions → getPushToken → registerPushToken → attachTokenRefreshListener in order, with isAuthenticated in deps',
);
{
  // Multiline regex: useEffect( ... ) then body references the four functions
  // in order, then a dependency array that includes isAuthenticated.
  const orderedRe =
    /useEffect\s*\(\s*\(\s*\)\s*=>\s*\{[\s\S]*?requestPushPermissions[\s\S]*?getPushToken[\s\S]*?registerPushToken[\s\S]*?attachTokenRefreshListener[\s\S]*?\}\s*,\s*\[[^\]]*isAuthenticated[^\]]*\]\s*\)/;
  check(
    'R-P2-02',
    'useEffect callback references the 4 push functions in order and deps include `isAuthenticated`',
    orderedRe.test(source),
  );
}

// -- R-P2-03: registerPushToken call chain is wrapped in try { ... } catch --
// Tests R-P2-03
console.log(
  '\nR-P2-03: registerPushToken call chain is wrapped in try { ... } catch',
);
{
  const tryCatchRe =
    /try\s*\{[\s\S]{0,500}registerPushToken[\s\S]{0,200}\}\s*catch/;
  check(
    'R-P2-03',
    'matches `try { ... registerPushToken ... } catch` within the required char windows',
    tryCatchRe.test(source),
  );
}

// -- R-P2-04: attachTokenRefreshListener receives a callback that re-invokes registerPushToken --
// Tests R-P2-04
console.log(
  '\nR-P2-04: attachTokenRefreshListener callback invokes registerPushToken with the rotated token',
);
{
  const rotationRe =
    /attachTokenRefreshListener\s*\(\s*(?:async\s*)?\(?[^)]*\)?\s*=>\s*\{[\s\S]{0,200}registerPushToken/;
  check(
    'R-P2-04',
    'attachTokenRefreshListener passes an arrow callback whose body calls registerPushToken within 200 chars',
    rotationRe.test(source),
  );
}

// -- R-P2-05: logout calls unregisterPushToken BEFORE signOut(auth) --
// Tests R-P2-05
console.log(
  '\nR-P2-05: logout calls unregisterPushToken before signOut(auth)',
);
{
  const logoutOrderRe =
    /async\s+function\s+logout[\s\S]*?unregisterPushToken[\s\S]*?signOut\s*\(\s*auth\s*\)/;
  check(
    'R-P2-05',
    'matches `async function logout ... unregisterPushToken ... signOut(auth)` in order',
    logoutOrderRe.test(source),
  );
}

// -- Summary --
console.log(`\n--- Results: ${passed} passed, ${failed} failed ---`);
if (failed > 0) {
  process.exit(1);
}
