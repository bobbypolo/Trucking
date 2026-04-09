#!/usr/bin/env node
/**
 * verify-shared-contracts-barrel.cjs
 *
 * Verifies shared/contracts/index.ts barrel file contains all expected
 * exports (both pre-existing and new mobile-* additions).
 *
 * Used by: Sprint B2 (STORY-B2-05)
 * R-markers: R-B2-13, R-B2-14
 *
 * Stub: Ralph worker for STORY-B2-05 implements full verification.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const barrelPath = path.join(__dirname, '..', 'shared', 'contracts', 'index.ts');
const errors = [];

if (!fs.existsSync(barrelPath)) {
  console.error('verify-shared-contracts-barrel.cjs: FAIL');
  console.error('  shared/contracts/index.ts not found');
  process.exit(1);
}

const content = fs.readFileSync(barrelPath, 'utf8');

// Pre-existing exports (FROZEN baseline)
const frozenExports = ['load', 'tracking', 'finance', 'entities', 'operations'];
for (const name of frozenExports) {
  const re = new RegExp(`export.*from.*['\\./ ]+${name}['\"]`, 'i');
  if (!re.test(content)) {
    errors.push(`Missing frozen export: ${name}`);
  }
}

// Mobile contract exports (added by B2)
const mobileContracts = [
  'mobile-trip', 'mobile-document', 'mobile-auth', 'mobile-compliance',
  'mobile-settlement', 'mobile-expense', 'mobile-notification',
  'mobile-hos', 'mobile-support'
];
for (const name of mobileContracts) {
  const re = new RegExp(`export.*from.*['\\./ ]+${name}['\"]`, 'i');
  if (!re.test(content)) {
    errors.push(`Missing mobile contract export: ${name}`);
  }
}

if (errors.length > 0) {
  console.error('verify-shared-contracts-barrel.cjs: FAIL');
  errors.forEach(e => console.error(`  ${e}`));
  process.exit(1);
} else {
  console.log('verify-shared-contracts-barrel.cjs: PASS');
  console.log(`  ${frozenExports.length} frozen + ${mobileContracts.length} mobile exports verified`);
}
