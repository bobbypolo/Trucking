/**
 * Verification script for STORY-001 Phase 1: Shared Types Package Extraction
 *
 * Verifies all 7 acceptance criteria (R-P1-01 through R-P1-07) by reading
 * files via fs.readFileSync and asserting structure via JSON.parse and regex.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
let passed = 0;
let failed = 0;

function check(id, description, fn) {
  try {
    fn();
    passed++;
    console.log(`PASS ${id}: ${description}`);
  } catch (err) {
    failed++;
    console.error(`FAIL ${id}: ${description}`);
    console.error(`  Reason: ${err.message}`);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

// R-P1-01: packages/shared/package.json exists with correct name and version
// Tests R-P1-01
check('R-P1-01', 'packages/shared/package.json has name @loadpilot/shared and version 0.0.1', () => {
  const filePath = path.join(ROOT, 'packages', 'shared', 'package.json');
  assert(fs.existsSync(filePath), 'packages/shared/package.json does not exist');
  const content = fs.readFileSync(filePath, 'utf-8');
  const pkg = JSON.parse(content);
  assert(pkg.name === '@loadpilot/shared', `Expected name "@loadpilot/shared", got "${pkg.name}"`);
  assert(pkg.version === '0.0.1', `Expected version "0.0.1", got "${pkg.version}"`);
});

// R-P1-02: packages/shared/src/types.ts contains all 150 exported symbols
// Tests R-P1-02
check('R-P1-02', 'packages/shared/src/types.ts contains all 150 exported symbols', () => {
  const sharedTypesPath = path.join(ROOT, 'packages', 'shared', 'src', 'types.ts');
  assert(fs.existsSync(sharedTypesPath), 'packages/shared/src/types.ts does not exist');
  const sharedContent = fs.readFileSync(sharedTypesPath, 'utf-8');
  const exportRegex = /export (type|interface|const|enum|function)/g;
  const sharedMatches = sharedContent.match(exportRegex);
  const sharedCount = sharedMatches ? sharedMatches.length : 0;
  assert(sharedCount === 150, `Expected 150 exported symbols in packages/shared/src/types.ts, got ${sharedCount}`);
});

// R-P1-03: packages/shared/src/index.ts contains barrel re-export
// Tests R-P1-03
check('R-P1-03', 'packages/shared/src/index.ts contains barrel re-export', () => {
  const indexPath = path.join(ROOT, 'packages', 'shared', 'src', 'index.ts');
  assert(fs.existsSync(indexPath), 'packages/shared/src/index.ts does not exist');
  const content = fs.readFileSync(indexPath, 'utf-8');
  const barrelRegex = /export \* from ['"]\.\/types['"]/;
  assert(barrelRegex.test(content), 'packages/shared/src/index.ts does not contain "export * from \'./types\'"');
});

// R-P1-04: Root types.ts contains exactly one line: re-export shim
// Tests R-P1-04
check('R-P1-04', 'Root types.ts is a single-line re-export shim', () => {
  const shimPath = path.join(ROOT, 'types.ts');
  assert(fs.existsSync(shimPath), 'Root types.ts does not exist');
  const content = fs.readFileSync(shimPath, 'utf-8');
  const lines = content.trim().split('\n').filter(line => line.trim().length > 0);
  assert(lines.length === 1, `Expected exactly 1 non-empty line in root types.ts, got ${lines.length}`);
  const shimRegex = /^export \* from ['"]@loadpilot\/shared['"]/;
  assert(shimRegex.test(lines[0].trim()), `Root types.ts content "${lines[0].trim()}" does not match re-export shim pattern`);
});

// R-P1-05: Root package.json contains workspaces: ["packages/*"]
// Tests R-P1-05
check('R-P1-05', 'Root package.json has workspaces: ["packages/*"]', () => {
  const pkgPath = path.join(ROOT, 'package.json');
  const content = fs.readFileSync(pkgPath, 'utf-8');
  const pkg = JSON.parse(content);
  assert(Array.isArray(pkg.workspaces), 'Root package.json does not have "workspaces" array');
  assert(pkg.workspaces.includes('packages/*'), `Root package.json workspaces ${JSON.stringify(pkg.workspaces)} does not include "packages/*"`);
});

// R-P1-06: Root tsconfig.json contains path alias for @loadpilot/shared
// Tests R-P1-06
check('R-P1-06', 'Root tsconfig.json has @loadpilot/shared path alias', () => {
  const tsconfigPath = path.join(ROOT, 'tsconfig.json');
  const content = fs.readFileSync(tsconfigPath, 'utf-8');
  const tsconfig = JSON.parse(content);
  const paths = tsconfig.compilerOptions && tsconfig.compilerOptions.paths;
  assert(paths, 'Root tsconfig.json does not have compilerOptions.paths');
  const sharedPaths = paths['@loadpilot/shared'];
  assert(Array.isArray(sharedPaths), 'Root tsconfig.json paths does not have "@loadpilot/shared" entry');
  assert(
    sharedPaths.some(p => p === './packages/shared/src' || p === './packages/shared/src/index.ts'),
    `@loadpilot/shared paths ${JSON.stringify(sharedPaths)} does not point to "./packages/shared/src"`
  );
});

// R-P1-07: npx tsc --noEmit produces no errors related to @loadpilot/shared
// or the re-export shim. Pre-existing errors (e.g., jszip types in e2e/) are
// excluded -- those are tracked as baseline debt in STORY-005 (R-P5-01).
// Tests R-P1-07
check('R-P1-07', 'npx tsc --noEmit has no shared-types or shim-related errors', () => {
  const result = spawnSync('npx', ['tsc', '--noEmit'], {
    cwd: ROOT,
    stdio: 'pipe',
    shell: true,
    timeout: 120000,
  });
  const stdout = result.stdout ? result.stdout.toString() : '';
  const stderr = result.stderr ? result.stderr.toString() : '';
  const output = stdout + '\n' + stderr;

  // Filter for errors related to our changes (shared types / shim)
  const shimRelatedPatterns = [
    /@loadpilot\/shared/,
    /packages\/shared/,
    /Cannot find module '@loadpilot\/shared'/,
  ];

  const lines = output.split('\n').filter(l => l.trim().length > 0);
  const shimErrors = lines.filter(line =>
    shimRelatedPatterns.some(pattern => pattern.test(line))
  );

  assert(
    shimErrors.length === 0,
    `Found ${shimErrors.length} TypeScript errors related to shared types extraction:\n${shimErrors.join('\n')}`
  );

  // Also verify types.ts shim itself doesn't cause errors
  const typesShimErrors = lines.filter(line =>
    /types\.ts\(\d+,\d+\)/.test(line) && !/node_modules/.test(line)
  );
  assert(
    typesShimErrors.length === 0,
    `Found ${typesShimErrors.length} TypeScript errors in types.ts shim:\n${typesShimErrors.join('\n')}`
  );
});

// Summary
console.log(`\n--- Results: ${passed} passed, ${failed} failed ---`);
if (failed > 0) {
  process.exit(1);
}
