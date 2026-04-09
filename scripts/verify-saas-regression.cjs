#!/usr/bin/env node
/**
 * verify-saas-regression.cjs
 *
 * SaaS non-regression gate. Runs the existing web app test suites
 * to verify no regression from trucker-app sprint work.
 *
 * Tests run:
 *   - Root frontend: npx vitest run src/__tests__/
 *   - Server: npx vitest run on accounting, ifta, requireAuth tests
 *
 * Respects baseline debt register (docs/trucker-app-baseline-debt.md)
 * for known-failing tests that are excluded from the pass/fail gate.
 *
 * R-marker: R-B1-25
 *
 * Stub: Ralph worker for STORY-B1-10 implements the full logic.
 */
'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const errors = [];

function runCommand(cmd, args, cwd) {
  const result = spawnSync(cmd, args, {
    cwd: cwd || path.join(__dirname, '..'),
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: true
  });
  return result;
}

// Load baseline debt exclusions if available
const debtPath = path.join(__dirname, '..', 'docs', 'trucker-app-baseline-debt.md');
let baselineExclusions = [];
if (fs.existsSync(debtPath)) {
  const debtContent = fs.readFileSync(debtPath, 'utf8');
  // Extract file paths from markdown table rows
  const rows = debtContent.match(/\|[^|]+\|[^|]+\|/gm) || [];
  baselineExclusions = rows
    .map(r => r.split('|')[1]?.trim())
    .filter(f => f && !f.startsWith('-') && !f.startsWith('file') && f.includes('/'));
}

console.log('verify-saas-regression.cjs: Running SaaS non-regression gate...');
if (baselineExclusions.length > 0) {
  console.log(`  Baseline debt exclusions: ${baselineExclusions.length} files`);
}

// Run root frontend tests
console.log('  Running root frontend tests...');
const frontendResult = runCommand('npx', ['vitest', 'run', '--reporter=verbose'], path.join(__dirname, '..'));
if (frontendResult.status !== 0) {
  errors.push('Root frontend tests failed');
  if (frontendResult.stderr) {
    console.error('  Frontend stderr:', frontendResult.stderr.slice(0, 500));
  }
}

// Run server regression tests
console.log('  Running server regression tests...');
const serverTests = [
  '__tests__/routes/accounting.test.ts',
  '__tests__/routes/ifta.test.ts',
  '__tests__/middleware/requireAuth.test.ts'
];
const serverResult = runCommand('npx', ['vitest', 'run', ...serverTests], path.join(__dirname, '..', 'server'));
if (serverResult.status !== 0) {
  errors.push('Server regression tests failed');
  if (serverResult.stderr) {
    console.error('  Server stderr:', serverResult.stderr.slice(0, 500));
  }
}

if (errors.length > 0) {
  console.error('verify-saas-regression.cjs: FAIL');
  errors.forEach(e => console.error(`  ${e}`));
  process.exit(1);
} else {
  console.log('verify-saas-regression.cjs: PASS');
}
