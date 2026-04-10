/**
 * Verification script for Phase 7: Connectivity Service + Offline Banner
 *
 * Asserts that all required connectivity/offline files exist with correct structure.
 * Run: node scripts/verify-offline-core.cjs
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TRUCKER = path.join(ROOT, 'apps', 'trucker');

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

// -- R-P7-01: package.json declares @react-native-community/netinfo in dependencies --
// Tests R-P7-01
console.log('\nR-P7-01: @react-native-community/netinfo dependency');
{
  const pkgPath = path.join(TRUCKER, 'package.json');
  const content = fs.readFileSync(pkgPath, 'utf8');
  const pkg = JSON.parse(content);
  const deps = pkg.dependencies || {};
  check(
    'R-P7-01',
    'package.json declares "@react-native-community/netinfo" in dependencies',
    deps['@react-native-community/netinfo'] !== undefined
  );
}

// -- R-P7-02: connectivity.ts calls NetInfo.addEventListener and exports isOnline --
// Tests R-P7-02
console.log('\nR-P7-02: connectivity.ts uses NetInfo');
{
  const filePath = path.join(TRUCKER, 'src', 'services', 'connectivity.ts');
  const exists = fs.existsSync(filePath);
  check('R-P7-02', 'connectivity.ts exists', exists);

  if (exists) {
    const content = fs.readFileSync(filePath, 'utf8');
    check(
      'R-P7-02',
      'connectivity.ts imports or references NetInfo',
      /NetInfo/.test(content)
    );
    check(
      'R-P7-02',
      'connectivity.ts calls addEventListener',
      /addEventListener/.test(content)
    );
    check(
      'R-P7-02',
      'connectivity.ts exports isOnline boolean',
      /isOnline/.test(content) && /export/.test(content)
    );
  }
}

// -- R-P7-03: ConnectivityContext.tsx exports ConnectivityProvider and useConnectivity --
// Tests R-P7-03
console.log('\nR-P7-03: ConnectivityContext exports provider and hook');
{
  const filePath = path.join(TRUCKER, 'src', 'contexts', 'ConnectivityContext.tsx');
  const exists = fs.existsSync(filePath);
  check('R-P7-03', 'ConnectivityContext.tsx exists', exists);

  if (exists) {
    const content = fs.readFileSync(filePath, 'utf8');
    check(
      'R-P7-03',
      'ConnectivityContext.tsx exports ConnectivityProvider',
      /export\s+(function|const)\s+ConnectivityProvider/.test(content)
    );
    check(
      'R-P7-03',
      'ConnectivityContext.tsx exports useConnectivity hook',
      /export\s+function\s+useConnectivity/.test(content)
    );
    check(
      'R-P7-03',
      'useConnectivity returns { isOnline: boolean }',
      /isOnline/.test(content) && /boolean/.test(content)
    );
  }
}

// -- R-P7-04: OfflineBanner.tsx calls useConnectivity and renders "You are offline" --
// Tests R-P7-04
console.log('\nR-P7-04: OfflineBanner reads connectivity context');
{
  const filePath = path.join(TRUCKER, 'src', 'components', 'OfflineBanner.tsx');
  const exists = fs.existsSync(filePath);
  check('R-P7-04', 'OfflineBanner.tsx exists', exists);

  if (exists) {
    const content = fs.readFileSync(filePath, 'utf8');
    check(
      'R-P7-04',
      'OfflineBanner.tsx calls useConnectivity()',
      /useConnectivity\(\)/.test(content)
    );
    check(
      'R-P7-04',
      'OfflineBanner.tsx renders "You are offline" text',
      /You are offline/.test(content)
    );
    check(
      'R-P7-04',
      'OfflineBanner.tsx conditionally renders based on isOnline',
      /isOnline/.test(content)
    );
    check(
      'R-P7-04',
      'OfflineBanner.tsx returns null when online',
      /return\s+null/.test(content)
    );
  }
}

// -- R-P7-05: Root _layout.tsx wraps with ConnectivityProvider and renders OfflineBanner --
// Tests R-P7-05
console.log('\nR-P7-05: Root layout wraps with ConnectivityProvider');
{
  const filePath = path.join(TRUCKER, 'src', 'app', '_layout.tsx');
  const content = fs.readFileSync(filePath, 'utf8');
  check(
    'R-P7-05',
    '_layout.tsx includes ConnectivityProvider',
    /ConnectivityProvider/.test(content)
  );
  check(
    'R-P7-05',
    '_layout.tsx renders <ConnectivityProvider> JSX element',
    /<ConnectivityProvider/.test(content)
  );
  check(
    'R-P7-05',
    '_layout.tsx includes OfflineBanner',
    /OfflineBanner/.test(content)
  );
  check(
    'R-P7-05',
    '_layout.tsx renders <OfflineBanner',
    /<OfflineBanner/.test(content)
  );
}

// -- Summary --
console.log(`\n--- Results: ${passed} passed, ${failed} failed ---`);
if (failed > 0) {
  process.exit(1);
}
