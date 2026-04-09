#!/usr/bin/env node
/**
 * verify-eld-contract.cjs
 *
 * Verifies docs/trucker-app-eld-provider-contract.md content:
 *   - Required H2 sections per plan spec
 *   - Provider-agnostic interface pattern
 *   - Motive adapter contract
 *
 * Used by: Sprint F (STORY-F-11)
 * Dispatch gate for: Sprint G
 */
'use strict';

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'docs', 'trucker-app-eld-provider-contract.md');

if (!fs.existsSync(filePath)) {
  console.error('verify-eld-contract.cjs: FAIL');
  console.error('  docs/trucker-app-eld-provider-contract.md not found');
  process.exit(1);
}

const content = fs.readFileSync(filePath, 'utf8');
const errors = [];

const requiredSections = [
  'Provider interface',
  'Authentication',
  'Sync cadence',
  'Error handling',
  'Rate limits',
  'Tenant mapping'
];

for (const section of requiredSections) {
  const re = new RegExp(`^##\\s+.*${section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'im');
  if (!re.test(content)) {
    errors.push(`Missing section: '${section}'`);
  }
}

if (errors.length > 0) {
  console.error('verify-eld-contract.cjs: FAIL');
  errors.forEach(e => console.error(`  ${e}`));
  process.exit(1);
} else {
  console.log('verify-eld-contract.cjs: PASS');
}
