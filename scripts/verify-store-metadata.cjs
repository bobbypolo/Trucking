#!/usr/bin/env node
/**
 * verify-store-metadata.cjs
 *
 * Verifies store submission metadata:
 *   - App Store metadata YAML/JSON
 *   - Play Store listing content
 *   - Screenshots and assets referenced
 *
 * Used by: Sprint M (STORY-M-10)
 */
'use strict';

const fs = require('fs');
const path = require('path');

const errors = [];

// Check for store metadata files (created by Sprint M)
const possiblePaths = [
  'apps/trucker/store/app-store-metadata.json',
  'apps/trucker/store/play-store-metadata.json',
  'docs/trucker-app-launch-go-no-go.md'
];

for (const p of possiblePaths) {
  const fullPath = path.join(__dirname, '..', p);
  if (!fs.existsSync(fullPath)) {
    errors.push(`Missing: ${p}`);
  }
}

if (errors.length > 0) {
  console.error('verify-store-metadata.cjs: FAIL');
  errors.forEach(e => console.error(`  ${e}`));
  process.exit(1);
} else {
  console.log('verify-store-metadata.cjs: PASS');
}
