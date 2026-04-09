#!/usr/bin/env node
/**
 * sprint-handoff.cjs
 *
 * Rolling handoff script for the trucker-app program.
 * Transitions from one completed sprint to the next.
 *
 * Usage:
 *   node scripts/sprint-handoff.cjs <current-branch> <next-sprint-id>
 *
 * Example:
 *   node scripts/sprint-handoff.cjs ralph/trucker-app-sprint-b1 b2
 *
 * Steps:
 *   1. git fetch origin
 *   2. Verify current branch is merged into main
 *   3. Capture merge SHA
 *   4. Append to docs/trucker-app-sprint-history.md
 *   5. Archive .claude/docs/PLAN.md
 *   6. Extract next sprint section from master plan
 *   7. Write extracted content to .claude/docs/PLAN.md
 *   8. Print ready message
 */
'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: node scripts/sprint-handoff.cjs <current-branch> <next-sprint-id>');
  console.error('Example: node scripts/sprint-handoff.cjs ralph/trucker-app-sprint-b1 b2');
  process.exit(1);
}

const currentBranch = args[0];
const nextSprintId = args[1].toUpperCase();
const nextSprintLower = args[1].toLowerCase();

function run(cmd) {
  return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}

// Step 1: fetch
console.log('Step 1: Fetching origin...');
try {
  run('git fetch origin');
} catch (e) {
  console.error('Warning: git fetch failed (offline?). Continuing with local state.');
}

// Step 2: Verify merged
console.log(`Step 2: Verifying ${currentBranch} is merged into main...`);
try {
  run(`git merge-base --is-ancestor origin/${currentBranch} origin/main`);
} catch (e) {
  console.error(`HALT: ${currentBranch} is not yet merged into main.`);
  console.error('Merge the PR first, then re-run this script.');
  process.exit(1);
}

// Step 3: Capture merge SHA
console.log('Step 3: Capturing merge SHA...');
const mergeSha = run(`git log --oneline -1 origin/main --format=%H`);
const mergeDate = new Date().toISOString();
console.log(`  Merge SHA: ${mergeSha}`);

// Step 4: Append to sprint history
console.log('Step 4: Appending to sprint history...');
const historyPath = path.join(__dirname, '..', 'docs', 'trucker-app-sprint-history.md');
if (fs.existsSync(historyPath)) {
  const sprintLabel = currentBranch.replace('ralph/trucker-app-sprint-', '').toUpperCase();
  const entry = `\n## Sprint ${sprintLabel}\n- Branch: ${currentBranch}\n- Merge SHA: ${mergeSha}\n- Merged at: ${mergeDate}\n`;
  fs.appendFileSync(historyPath, entry, 'utf8');
  console.log(`  Appended Sprint ${sprintLabel} entry.`);
} else {
  console.error('  Warning: sprint-history.md not found. Skipping.');
}

// Step 5: Archive current PLAN.md
console.log('Step 5: Archiving current PLAN.md...');
const planPath = path.join(__dirname, '..', '.claude', 'docs', 'PLAN.md');
const sprintTag = currentBranch.replace('ralph/trucker-app-sprint-', '');
const archivePath = path.join(__dirname, '..', 'docs', `PLAN-trucker-app-sprint-${sprintTag}-executed.md`);
if (fs.existsSync(planPath)) {
  fs.copyFileSync(planPath, archivePath);
  console.log(`  Archived to ${archivePath}`);
}

// Step 6: Extract next sprint from master plan
console.log(`Step 6: Extracting Sprint ${nextSprintId} from master plan...`);
const masterPlanPath = path.join(__dirname, '..', 'docs', 'PLAN-trucker-app.md');
if (!fs.existsSync(masterPlanPath)) {
  console.error('HALT: Master plan not found at docs/PLAN-trucker-app.md');
  process.exit(1);
}

const masterContent = fs.readFileSync(masterPlanPath, 'utf8');
// Find the sprint section (## Sprint X — ...)
const sprintHeaderRe = new RegExp(`^## Sprint ${nextSprintId}\\b.*$`, 'im');
const match = masterContent.match(sprintHeaderRe);
if (!match) {
  console.error(`HALT: Could not find '## Sprint ${nextSprintId}' section in master plan.`);
  process.exit(1);
}

const startIdx = masterContent.indexOf(match[0]);
// Find the next sprint section (## Sprint ...) or end of file
const afterStart = masterContent.slice(startIdx + match[0].length);
const nextSectionMatch = afterStart.match(/\n---\n\n## Sprint /);
let endIdx;
if (nextSectionMatch) {
  endIdx = startIdx + match[0].length + nextSectionMatch.index;
} else {
  // Check for other end markers
  const altEnd = afterStart.match(/\n---\n\n## /);
  endIdx = altEnd
    ? startIdx + match[0].length + altEnd.index
    : masterContent.length;
}

const sprintContent = masterContent.slice(startIdx, endIdx).trim();

// Step 7: Write to PLAN.md
console.log('Step 7: Writing Sprint PLAN.md...');
const header = `# Sprint ${nextSprintId} — Execution Plan\n\nExtracted from master plan at ${mergeDate}.\nPrevious sprint: ${currentBranch} (${mergeSha})\n\n---\n\n`;
fs.writeFileSync(planPath, header + sprintContent + '\n', 'utf8');
console.log(`  Written ${planPath}`);

// Step 8: Ready message
console.log('');
console.log('========================================');
console.log(`  HANDOFF COMPLETE: Sprint ${nextSprintId}`);
console.log('========================================');
console.log('');
console.log('Next steps:');
console.log(`  1. Regenerate prd.json: python .claude/hooks/prd_generator.py --plan .claude/docs/PLAN.md --output .claude/prd.json`);
console.log(`  2. Reset workflow state`);
console.log(`  3. Create branch: git checkout -b ralph/trucker-app-sprint-${nextSprintLower}`);
console.log(`  4. Run: /ralph`);
