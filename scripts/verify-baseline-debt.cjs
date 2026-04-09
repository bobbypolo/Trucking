#!/usr/bin/env node
/**
 * verify-baseline-debt.cjs
 *
 * Verifies docs/trucker-app-baseline-debt.md exists and has the correct format:
 *   - Markdown table with columns: file | failure | owner | first-seen | expiry | justification
 *   - Contains >= 1 real entry OR explicit placeholder row
 *
 * R-markers: R-B1-15, R-B1-16
 */
'use strict';

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'docs', 'trucker-app-baseline-debt.md');
const errors = [];

if (!fs.existsSync(filePath)) {
  console.error('verify-baseline-debt.cjs: FAIL');
  console.error('  docs/trucker-app-baseline-debt.md not found');
  process.exit(1);
}

const content = fs.readFileSync(filePath, 'utf8');

// R-B1-15: Check table has correct columns
const requiredCols = ['file', 'failure', 'owner', 'first-seen', 'expiry', 'justification'];
const headerLine = content.split('\n').find(l => /^\|/.test(l) && requiredCols.some(c => l.toLowerCase().includes(c)));
if (!headerLine) {
  errors.push('R-B1-15: Table header with required columns not found');
} else {
  for (const col of requiredCols) {
    if (!headerLine.toLowerCase().includes(col)) {
      errors.push(`R-B1-15: Missing column '${col}' in table header`);
    }
  }
}

// R-B1-16: Has >= 1 real entry OR explicit placeholder
const tableRows = content.split('\n').filter(l => /^\|/.test(l));
// Skip header and separator rows
const dataRows = tableRows.filter(l => !/^[\|\s-]+$/.test(l) && !requiredCols.some(c => l.toLowerCase().includes(c)));
const hasPlaceholder = content.includes('verified clean at');
const hasRealEntries = dataRows.length > 0;

if (!hasRealEntries && !hasPlaceholder) {
  errors.push('R-B1-16: Register has neither real entries nor explicit placeholder row');
}

if (errors.length > 0) {
  console.error('verify-baseline-debt.cjs: FAIL');
  errors.forEach(e => console.error(`  ${e}`));
  process.exit(1);
} else {
  console.log('verify-baseline-debt.cjs: PASS');
  console.log(`  ${dataRows.length} data rows, placeholder=${hasPlaceholder}`);
}
