#!/usr/bin/env node
/**
 * verify-architecture-docs.cjs
 *
 * Verifies the 4 architecture docs created in Sprint B2:
 *   - docs/trucker-app-auth-architecture.md (7 H2 sections)
 *   - docs/trucker-app-api-map.md (>= 20 route rows)
 *   - docs/trucker-app-navigation-map.md (screen tree)
 *   - docs/trucker-app-design-system-notes.md (color, typography, spacing, a11y)
 *
 * Used by: Sprint B2 (STORY-B2-08)
 * R-markers: R-B2-21, R-B2-22, R-B2-23, R-B2-24
 */
'use strict';

const fs = require('fs');
const path = require('path');

const docsDir = path.join(__dirname, '..', 'docs');
const errors = [];

function readDoc(filename) {
  const fullPath = path.join(docsDir, filename);
  if (!fs.existsSync(fullPath)) {
    errors.push(`FAIL: ${filename} not found`);
    return null;
  }
  return fs.readFileSync(fullPath, 'utf8');
}

// R-B2-21: Auth architecture has 7 H2 sections
const authDoc = readDoc('trucker-app-auth-architecture.md');
if (authDoc) {
  const requiredSections = [
    'Token lifecycle',
    'Session persistence',
    'Refresh token rotation',
    'Biometric unlock',
    'JWT rotation procedure',
    'Device ID format',
    'Force logout flow'
  ];
  for (const section of requiredSections) {
    const re = new RegExp(`^##\\s+.*${section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'im');
    if (!re.test(authDoc)) {
      errors.push(`R-B2-21: Auth architecture missing section '${section}'`);
    }
  }
}

// R-B2-22: API map has >= 20 route rows
const apiMap = readDoc('trucker-app-api-map.md');
if (apiMap) {
  const tableRows = apiMap.split('\n').filter(l => /^\|/.test(l) && !/^[\|\s-]+$/.test(l));
  // Subtract header row
  const dataRows = tableRows.length > 0 ? tableRows.length - 1 : 0;
  if (dataRows < 20) {
    errors.push(`R-B2-22: API map has ${dataRows} route rows (need >= 20)`);
  }
}

// R-B2-23: Navigation map contains screens
const navMap = readDoc('trucker-app-navigation-map.md');
if (navMap) {
  const screenKeywords = ['home', 'trip', 'profile', 'settings'];
  for (const kw of screenKeywords) {
    if (!navMap.toLowerCase().includes(kw)) {
      errors.push(`R-B2-23: Navigation map missing screen reference: ${kw}`);
    }
  }
}

// R-B2-24: Design system doc sections
const designDoc = readDoc('trucker-app-design-system-notes.md');
if (designDoc) {
  const requiredSections = ['Color', 'Typography', 'Spacing', 'Accessibility'];
  for (const section of requiredSections) {
    const re = new RegExp(`^##\\s+.*${section}`, 'im');
    if (!re.test(designDoc)) {
      errors.push(`R-B2-24: Design system doc missing section '${section}'`);
    }
  }
}

if (errors.length > 0) {
  console.error('verify-architecture-docs.cjs: FAIL');
  errors.forEach(e => console.error(`  ${e}`));
  process.exit(1);
} else {
  console.log('verify-architecture-docs.cjs: PASS');
}
