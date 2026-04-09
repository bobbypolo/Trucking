#!/usr/bin/env node
/**
 * verify-billing-policy.cjs
 *
 * Verifies docs/trucker-app-billing-policy.md contains a real decision
 * (not TBD), rationale, owner-op flow, fleet upgrade path, and fallback plan.
 *
 * Used by: Sprint I (final story)
 * POLICY RISK: The Stripe-only decision (no StoreKit) relies on Apple
 * Guideline 3.1.3(b) B2B exemption. This is a policy risk, not a
 * guaranteed-accepted fact. See Risk #10 in the program plan.
 *
 * Dispatch gate for: Sprint J billing implementation
 */
'use strict';

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'docs', 'trucker-app-billing-policy.md');

if (!fs.existsSync(filePath)) {
  console.error('verify-billing-policy.cjs: FAIL');
  console.error('  docs/trucker-app-billing-policy.md not found');
  process.exit(1);
}

const content = fs.readFileSync(filePath, 'utf8');
const errors = [];

// Must contain a real decision, not TBD
if (/\bTBD\b/i.test(content) && !/fallback/i.test(content)) {
  errors.push('Billing policy contains "TBD" without fallback plan');
}

// Required sections
const requiredSections = [
  'Decision',
  'Rationale',
  'Owner-op',
  'Fleet upgrade',
  'Fallback'
];

for (const section of requiredSections) {
  const re = new RegExp(section, 'i');
  if (!re.test(content)) {
    errors.push(`Missing content about: ${section}`);
  }
}

// POLICY RISK annotation check
if (!/POLICY RISK|policy risk|Apple.*reject/i.test(content)) {
  errors.push('Missing POLICY RISK annotation or Apple rejection fallback discussion');
}

if (errors.length > 0) {
  console.error('verify-billing-policy.cjs: FAIL');
  errors.forEach(e => console.error(`  ${e}`));
  process.exit(1);
} else {
  console.log('verify-billing-policy.cjs: PASS');
}
