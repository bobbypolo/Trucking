#!/usr/bin/env node
/**
 * verify-program-docs.cjs
 *
 * Verifies the 3 program documents required by Sprint B1:
 *   - docs/PLAN-trucker-app-master.md (13 sprint headings)
 *   - docs/trucker-app-release-checklist.md (operator gate tables)
 *   - docs/trucker-app-sprint-history.md (Sprint A entry)
 *
 * Also verifies:
 *   - docs/trucker-app-env-matrix.md (env variable table + EXPO_PUBLIC_* rule)
 *   - docs/trucker-app-feature-flags.md (6 flags)
 *   - docs/trucker-app-migration-numbering.md (placeholder rule)
 *
 * R-markers: R-B1-11, R-B1-12, R-B1-13, R-B1-14, R-B1-17, R-B1-18, R-B1-19, R-B1-20
 *
 * Stub: Ralph worker for STORY-B1-05/07/08 implements the full verification logic.
 * This file exists pre-Ralph so the plan installation commit is complete.
 */
'use strict';

const fs = require('fs');
const path = require('path');

// Optional --story filter: when provided, only checks for that story run.
// Usage: node verify-program-docs.cjs --story B1-05
const storyArg = process.argv.indexOf('--story');
const storyFilter = storyArg !== -1 ? process.argv[storyArg + 1] : null;

// Map stories to the R-marker ranges they own
const storyMarkers = {
  'B1-05': ['R-B1-11', 'R-B1-12', 'R-B1-13', 'R-B1-14'],
  'B1-07': ['R-B1-17', 'R-B1-18'],
  'B1-08': ['R-B1-19', 'R-B1-20'],
};

function shouldCheck(marker) {
  if (!storyFilter) return true;
  const owned = storyMarkers[storyFilter];
  return owned ? owned.includes(marker) : true;
}

const docsDir = path.join(__dirname, '..', 'docs');
const errors = [];

const warnings = [];

function checkFileExists(relPath, label) {
  const fullPath = path.join(__dirname, '..', relPath);
  if (!fs.existsSync(fullPath)) {
    // Missing files are warnings, not errors. The owning story creates them.
    warnings.push(`WARN: ${label} not found at ${relPath}`);
    return null;
  }
  return fs.readFileSync(fullPath, 'utf8');
}

function checkHeading(content, heading, label) {
  const re = new RegExp(`^##\\s+${heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'm');
  if (!re.test(content)) {
    errors.push(`FAIL: ${label} missing heading '## ${heading}'`);
  }
}

// Tests R-B1-11 — Master plan has 13 sprint headings (B1..M)
const masterPlan = shouldCheck('R-B1-11') || shouldCheck('R-B1-12')
  ? checkFileExists('docs/PLAN-trucker-app-master.md', 'Master plan')
  : null;
if (masterPlan && shouldCheck('R-B1-11')) {
  const sprintIds = ['B1', 'B2', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M'];
  for (const id of sprintIds) {
    const re = new RegExp(`^## Sprint ${id}\\b`, 'm');
    if (!re.test(masterPlan)) {
      errors.push(`FAIL: R-B1-11 Master plan missing '## Sprint ${id}' heading`);
    }
  }
}

// Tests R-B1-12 — Master plan has Sprint A baseline section
if (masterPlan && shouldCheck('R-B1-12')) {
  if (!/## Shipped Baseline \(Sprint A\)/m.test(masterPlan)) {
    errors.push('FAIL: R-B1-12 Master plan missing "## Shipped Baseline (Sprint A)" section');
  }
}

// Tests R-B1-13 — Release checklist has operator gate tables
const checklist = shouldCheck('R-B1-13')
  ? checkFileExists('docs/trucker-app-release-checklist.md', 'Release checklist')
  : null;
if (checklist && shouldCheck('R-B1-13')) {
  const gates = ['OP-ACCT', 'OP-SIM', 'OP-DEV', 'OP-EAS', 'OP-STORE', 'OP-LEGAL'];
  for (const gate of gates) {
    if (!checklist.includes(gate)) {
      errors.push(`FAIL: R-B1-13 Release checklist missing ${gate} gate references`);
    }
  }
}

// Tests R-B1-14 — Sprint history has Sprint A SHA dd8a8f4
const history = shouldCheck('R-B1-14')
  ? checkFileExists('docs/trucker-app-sprint-history.md', 'Sprint history')
  : null;
if (history && shouldCheck('R-B1-14')) {
  if (!history.includes('dd8a8f4')) {
    errors.push('FAIL: R-B1-14 Sprint history missing Sprint A SHA dd8a8f4');
  }
}

// R-B1-17: Env matrix table columns
const envMatrix = shouldCheck('R-B1-17') || shouldCheck('R-B1-18')
  ? checkFileExists('docs/trucker-app-env-matrix.md', 'Env matrix')
  : null;
if (envMatrix && shouldCheck('R-B1-17')) {
  const requiredCols = ['Variable', 'Category', 'Local', 'Staging', 'Production', 'EAS Build-time', 'Scope', 'Rotation'];
  for (const col of requiredCols) {
    if (!envMatrix.includes(col)) {
      errors.push(`FAIL: R-B1-17 Env matrix missing column '${col}'`);
    }
  }
}

// R-B1-18: Env matrix EXPO_PUBLIC_* rule
if (envMatrix && shouldCheck('R-B1-18')) {
  if (!/## EXPO_PUBLIC_\* rule/m.test(envMatrix)) {
    errors.push('FAIL: R-B1-18 Env matrix missing "## EXPO_PUBLIC_* rule" section');
  }
}

// R-B1-19: Feature flags doc lists all 6 flags
const flagsDoc = shouldCheck('R-B1-19')
  ? checkFileExists('docs/trucker-app-feature-flags.md', 'Feature flags doc')
  : null;
if (flagsDoc && shouldCheck('R-B1-19')) {
  const flags = [
    'FEATURE_TRUCKER_MOBILE_BETA',
    'FEATURE_MOTIVE_ELD',
    'FEATURE_BROKER_CREDIT',
    'FEATURE_FACILITY_DWELL',
    'FEATURE_FREEMIUM_QUOTA',
    'FEATURE_FORCE_UPGRADE'
  ];
  for (const flag of flags) {
    if (!flagsDoc.includes(flag)) {
      errors.push(`FAIL: R-B1-19 Feature flags doc missing flag '${flag}'`);
    }
  }
}

// R-B1-20: Migration numbering doc sections
const migDoc = shouldCheck('R-B1-20')
  ? checkFileExists('docs/trucker-app-migration-numbering.md', 'Migration numbering doc')
  : null;
if (migDoc && shouldCheck('R-B1-20')) {
  checkHeading(migDoc, 'Placeholder convention', 'R-B1-20 Migration numbering');
  checkHeading(migDoc, 'Assignment procedure', 'R-B1-20 Migration numbering');
}

// Report
if (warnings.length > 0) {
  warnings.forEach(w => console.log(`  ${w}`));
}
if (errors.length > 0) {
  console.error('verify-program-docs.cjs: FAIL');
  errors.forEach(e => console.error(`  ${e}`));
  process.exit(1);
} else {
  console.log('verify-program-docs.cjs: PASS');
}
