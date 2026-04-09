#!/usr/bin/env node
/**
 * verify-privacy-manifest.cjs
 *
 * Verifies Apple privacy manifest (PrivacyInfo.xcprivacy):
 *   - File exists at expected location
 *   - Valid XML structure
 *   - Required privacy keys declared
 *
 * Used by: Sprint M (STORY-M-08)
 * R-marker: validates PrivacyInfo.xcprivacy XML
 */
'use strict';

const fs = require('fs');
const path = require('path');

const errors = [];

const manifestPath = path.join(__dirname, '..', 'apps', 'trucker', 'ios', 'PrivacyInfo.xcprivacy');
const altPath = path.join(__dirname, '..', 'apps', 'trucker', 'PrivacyInfo.xcprivacy');

let content = null;
if (fs.existsSync(manifestPath)) {
  content = fs.readFileSync(manifestPath, 'utf8');
} else if (fs.existsSync(altPath)) {
  content = fs.readFileSync(altPath, 'utf8');
} else {
  errors.push('PrivacyInfo.xcprivacy not found');
}

if (content) {
  // Basic XML structure check
  if (!content.includes('<?xml') || !content.includes('<plist')) {
    errors.push('PrivacyInfo.xcprivacy is not valid XML/plist');
  }

  // Check for required privacy type declarations
  if (!content.includes('NSPrivacyAccessedAPIType')) {
    errors.push('Missing NSPrivacyAccessedAPIType declarations');
  }
}

if (errors.length > 0) {
  console.error('verify-privacy-manifest.cjs: FAIL');
  errors.forEach(e => console.error(`  ${e}`));
  process.exit(1);
} else {
  console.log('verify-privacy-manifest.cjs: PASS');
}
