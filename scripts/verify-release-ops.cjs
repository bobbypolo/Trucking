#!/usr/bin/env node
/**
 * verify-release-ops.cjs
 *
 * Verifies docs/trucker-app-release-ops.md:
 *   - Release train cadence
 *   - Version numbering scheme
 *   - Phased rollout procedure
 *   - Hotfix process
 *   - Rollback procedure
 *   - Build identification
 *
 * Used by: Sprint L (final story)
 */
'use strict';

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'docs', 'trucker-app-release-ops.md');

if (!fs.existsSync(filePath)) {
  console.error('verify-release-ops.cjs: FAIL');
  console.error('  docs/trucker-app-release-ops.md not found');
  process.exit(1);
}

const content = fs.readFileSync(filePath, 'utf8');
const errors = [];

const requiredSections = [
  'Release train',
  'Version numbering',
  'Phased rollout',
  'Hotfix',
  'Rollback',
  'Build identification'
];

for (const section of requiredSections) {
  const re = new RegExp(section, 'i');
  if (!re.test(content)) {
    errors.push(`Missing content about: ${section}`);
  }
}

if (errors.length > 0) {
  console.error('verify-release-ops.cjs: FAIL');
  errors.forEach(e => console.error(`  ${e}`));
  process.exit(1);
} else {
  console.log('verify-release-ops.cjs: PASS');
}
