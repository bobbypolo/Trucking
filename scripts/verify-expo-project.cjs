/**
 * Verification script for Phase 2: Expo Project Initialization
 *
 * Asserts that all required Expo project files exist with correct structure.
 * Run: node scripts/verify-expo-project.cjs
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TRUCKER = path.join(ROOT, 'apps', 'trucker');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  PASS: ${message}`);
    passed++;
  } else {
    console.error(`  FAIL: ${message}`);
    failed++;
  }
}

// -- R-P2-01: package.json with expo, react-native, expo-router deps --
// Tests R-P2-01
console.log('\nR-P2-01: package.json dependencies');
{
  const pkgPath = path.join(TRUCKER, 'package.json');
  const content = fs.readFileSync(pkgPath, 'utf8');
  const pkg = JSON.parse(content);
  const deps = pkg.dependencies;
  assert(deps && typeof deps === 'object', 'dependencies object exists');
  assert('expo' in deps, '"expo" is a key in dependencies');
  assert('react-native' in deps, '"react-native" is a key in dependencies');
  assert('expo-router' in deps, '"expo-router" is a key in dependencies');
}

// -- R-P2-02: app.json with expo.name, expo.slug, expo.scheme, expo.platforms --
// Tests R-P2-02
console.log('\nR-P2-02: app.json structure');
{
  const appJsonPath = path.join(TRUCKER, 'app.json');
  const content = fs.readFileSync(appJsonPath, 'utf8');
  const appConfig = JSON.parse(content);
  const expo = appConfig.expo;
  assert(expo && typeof expo === 'object', 'expo object exists');
  assert(typeof expo.name === 'string' && expo.name.length > 0, 'expo.name is a non-empty string');
  assert(typeof expo.slug === 'string' && expo.slug.length > 0, 'expo.slug is a non-empty string');
  assert(typeof expo.scheme === 'string' && expo.scheme.length > 0, 'expo.scheme is a non-empty string');
  assert(Array.isArray(expo.platforms), 'expo.platforms is an array');
  assert(expo.platforms.includes('ios'), 'expo.platforms includes "ios"');
  assert(expo.platforms.includes('android'), 'expo.platforms includes "android"');
}

// -- R-P2-03: eas.json with build.development, build.preview, build.production --
// Tests R-P2-03
console.log('\nR-P2-03: eas.json build profiles');
{
  const easPath = path.join(TRUCKER, 'eas.json');
  const content = fs.readFileSync(easPath, 'utf8');
  const eas = JSON.parse(content);
  const build = eas.build;
  assert(build && typeof build === 'object', 'build object exists');
  assert('development' in build, '"development" profile exists in build');
  assert('preview' in build, '"preview" profile exists in build');
  assert('production' in build, '"production" profile exists in build');
}

// -- R-P2-04: _layout.tsx exports RootLayout with Slot or Stack --
// Tests R-P2-04
console.log('\nR-P2-04: _layout.tsx RootLayout export');
{
  const layoutPath = path.join(TRUCKER, 'src', 'app', '_layout.tsx');
  const content = fs.readFileSync(layoutPath, 'utf8');
  const matches = content.match(/export default function RootLayout/g);
  assert(matches !== null, '_layout.tsx contains "export default function RootLayout"');
  assert(matches !== null && matches.length === 1, 'exactly 1 match for "export default function RootLayout"');
}

// -- R-P2-05: index.tsx exists and has export default --
// Tests R-P2-05
console.log('\nR-P2-05: index.tsx export default');
{
  const indexPath = path.join(TRUCKER, 'src', 'app', 'index.tsx');
  const content = fs.readFileSync(indexPath, 'utf8');
  const matches = content.match(/export default/g);
  assert(matches !== null, 'index.tsx contains "export default"');
  assert(matches !== null && matches.length === 1, 'exactly 1 match for "export default"');
}

// -- R-P2-06: .gitignore contains apps/trucker/node_modules/ and apps/trucker/.expo/ --
// Tests R-P2-06
console.log('\nR-P2-06: .gitignore entries');
{
  const gitignorePath = path.join(ROOT, '.gitignore');
  const content = fs.readFileSync(gitignorePath, 'utf8');
  assert(
    /apps\/trucker\/node_modules\/?/.test(content),
    '.gitignore contains apps/trucker/node_modules/'
  );
  assert(
    /apps\/trucker\/\.expo\/?/.test(content),
    '.gitignore contains apps/trucker/.expo/'
  );
}

// -- Summary --
console.log(`\n--- Results: ${passed} passed, ${failed} failed ---`);
if (failed > 0) {
  process.exit(1);
}
