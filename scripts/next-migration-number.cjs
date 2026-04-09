#!/usr/bin/env node
/**
 * next-migration-number.cjs
 *
 * Reads server/migrations/, extracts leading integers from filenames,
 * returns max+1. Writes result to stdout and optionally to next-migration.txt.
 *
 * Usage:
 *   node scripts/next-migration-number.cjs
 *   node scripts/next-migration-number.cjs --write  # also writes next-migration.txt
 */
'use strict';

const fs = require('fs');
const path = require('path');

const migrationsDir = path.join(__dirname, '..', 'server', 'migrations');

if (!fs.existsSync(migrationsDir)) {
  console.error(JSON.stringify({ error: 'migrations_dir_not_found', path: migrationsDir }));
  process.exit(1);
}

const files = fs.readdirSync(migrationsDir);
const numbers = files
  .map(f => {
    const match = f.match(/^(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  })
  .filter(n => n !== null);

if (numbers.length === 0) {
  console.error(JSON.stringify({ error: 'no_migrations_found' }));
  process.exit(1);
}

const max = Math.max(...numbers);
const next = max + 1;
const padded = String(next).padStart(3, '0');

console.log(JSON.stringify({ current_max: max, next: next, padded: padded }));

if (process.argv.includes('--write')) {
  const outPath = path.join(__dirname, '..', 'next-migration.txt');
  fs.writeFileSync(outPath, String(next), 'utf8');
  console.log(`Written to ${outPath}`);
}
