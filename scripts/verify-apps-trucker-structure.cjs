#!/usr/bin/env node
/**
 * verify-apps-trucker-structure.cjs
 *
 * Verifies the apps/trucker/ directory structure matches the locked
 * skeleton defined in the program plan. Every directory must exist
 * with either a real source file or a .gitkeep.
 *
 * Used by: Sprint B2 (STORY-B2-01)
 * R-marker: R-B2-04
 *
 * Stub: Ralph worker for STORY-B2-01 populates the full directory list.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const baseDir = path.join(__dirname, '..', 'apps', 'trucker');
const errors = [];

if (!fs.existsSync(baseDir)) {
  console.error('verify-apps-trucker-structure.cjs: FAIL');
  console.error('  apps/trucker/ directory not found');
  process.exit(1);
}

// The locked directory structure (populated during B2 implementation)
// This is the source of truth for the directory skeleton.
const requiredDirs = [
  'app',
  'app/(app)',
  'app/(onboarding)',
  'src',
  'src/components',
  'src/config',
  'src/hooks',
  'src/lib',
  'src/services',
  'assets',
  '__tests__'
];

for (const dir of requiredDirs) {
  const fullPath = path.join(baseDir, dir);
  if (!fs.existsSync(fullPath)) {
    errors.push(`Missing directory: apps/trucker/${dir}`);
  } else {
    // Check for content (real file or .gitkeep)
    const contents = fs.readdirSync(fullPath);
    if (contents.length === 0) {
      errors.push(`Empty directory (needs .gitkeep or source file): apps/trucker/${dir}`);
    }
  }
}

if (errors.length > 0) {
  console.error('verify-apps-trucker-structure.cjs: FAIL');
  errors.forEach(e => console.error(`  ${e}`));
  process.exit(1);
} else {
  console.log('verify-apps-trucker-structure.cjs: PASS');
  console.log(`  ${requiredDirs.length} directories verified`);
}
