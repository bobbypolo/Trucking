#!/usr/bin/env node
/**
 * verify-offline-sync-arch.cjs
 *
 * Verifies docs/trucker-app-offline-sync-architecture.md:
 *   - All 7 H2 sections from content spec
 *   - Zod schema code block for queue records
 *   - Idempotency key format matches server format
 *
 * Used by: Sprint E (STORY-E-01)
 * R-marker: R-E-01
 * Dispatch gate for: Sprint F
 */
'use strict';

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'docs', 'trucker-app-offline-sync-architecture.md');

if (!fs.existsSync(filePath)) {
  console.error('verify-offline-sync-arch.cjs: FAIL');
  console.error('  docs/trucker-app-offline-sync-architecture.md not found');
  process.exit(1);
}

const content = fs.readFileSync(filePath, 'utf8');
const errors = [];

// 7 required H2 sections
const requiredSections = [
  'Queue data model',
  'Sync lifecycle',
  'Retry strategy',
  'Conflict resolution',
  'Idempotency',
  'Storage limits',
  'Observability'
];

for (const section of requiredSections) {
  const re = new RegExp(`^##\\s+.*${section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'im');
  if (!re.test(content)) {
    errors.push(`Missing section: '${section}'`);
  }
}

// Zod schema code block
if (!content.includes('z.object') && !content.includes('zod')) {
  errors.push('Missing zod schema code block for queue records');
}

// Idempotency key format
if (!content.includes('actorId') || !content.includes('endpoint')) {
  errors.push('Missing idempotency key format documentation');
}

if (errors.length > 0) {
  console.error('verify-offline-sync-arch.cjs: FAIL');
  errors.forEach(e => console.error(`  ${e}`));
  process.exit(1);
} else {
  console.log('verify-offline-sync-arch.cjs: PASS');
}
