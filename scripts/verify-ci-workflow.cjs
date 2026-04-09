#!/usr/bin/env node
/**
 * verify-ci-workflow.cjs
 *
 * Verifies .github/workflows/trucker-mobile-ci.yml:
 *   - Parses as valid YAML
 *   - Has 4 required jobs (install, typecheck, test, expo-config-validate)
 *   - Uses npm ci, not npm install
 *
 * Used by: Sprint B2 (STORY-B2-06)
 * R-markers: R-B2-15, R-B2-16, R-B2-17
 *
 * Stub: Ralph worker for STORY-B2-06 implements full verification.
 * Requires js-yaml as a dependency (installed in apps/trucker or root).
 */
'use strict';

const fs = require('fs');
const path = require('path');

const workflowPath = path.join(__dirname, '..', '.github', 'workflows', 'trucker-mobile-ci.yml');

if (!fs.existsSync(workflowPath)) {
  console.error('verify-ci-workflow.cjs: FAIL');
  console.error('  .github/workflows/trucker-mobile-ci.yml not found');
  process.exit(1);
}

const content = fs.readFileSync(workflowPath, 'utf8');
const errors = [];

// Basic YAML structure check (without js-yaml dependency for now)
if (!content.includes('jobs:')) {
  errors.push('R-B2-15: No "jobs:" key found - not valid workflow YAML');
}

// R-B2-16: Check for required jobs
const requiredJobs = ['install', 'typecheck', 'test', 'expo-config-validate'];
for (const job of requiredJobs) {
  const re = new RegExp(`^\\s+${job}:`, 'm');
  if (!re.test(content)) {
    errors.push(`R-B2-16: Missing required job '${job}'`);
  }
}

// R-B2-17: Uses npm ci, not npm install
if (content.includes('npm install') && !content.includes('npm ci')) {
  errors.push('R-B2-17: Workflow uses "npm install" instead of "npm ci"');
}
if (!content.includes('npm ci')) {
  errors.push('R-B2-17: Workflow does not contain "npm ci"');
}

if (errors.length > 0) {
  console.error('verify-ci-workflow.cjs: FAIL');
  errors.forEach(e => console.error(`  ${e}`));
  process.exit(1);
} else {
  console.log('verify-ci-workflow.cjs: PASS');
}
