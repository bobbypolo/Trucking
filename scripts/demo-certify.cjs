#!/usr/bin/env node
/**
 * scripts/demo-certify.cjs — Windows-safe Sales Demo Certification appender.
 *
 * Usage: node scripts/demo-certify.cjs [logFilePath] [evidenceFilePath]
 *
 * Defaults:
 *   logFilePath:      <os.tmpdir()>/sales-demo-cert-latest.log
 *   evidenceFilePath: docs/release/evidence.md   (relative to process.cwd())
 *
 * Behavior (R-P7-01..R-P7-03):
 *   - Reads the log file from argv[2] or falls back to the default location
 *     under os.tmpdir(). Never references the literal Unix temp directory —
 *     all temp-dir resolution flows through os.tmpdir() so the script works
 *     unchanged on Windows.
 *   - If the log file does not exist the script prints a clear error and
 *     exits with code 1 (R-P7-02).
 *   - Otherwise it appends an ISO-timestamped "### <timestamp>" block under
 *     the "## Sales Demo Certification" H2 section of the evidence file and
 *     writes the last 50 lines of the log into that block (R-P7-01).
 *
 * This script is invoked by the root npm script "demo:certify:sales":
 *     node scripts/demo-certify.cjs
 */
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

const EVIDENCE_H2 = "## Sales Demo Certification";
const DEFAULT_LOG_BASENAME = "sales-demo-cert-latest.log";
const MAX_LOG_TAIL_LINES = 50;

/**
 * Resolve the default log path under the OS temp directory. This is the
 * canonical Windows-safe temp location (uses os.tmpdir() rather than a
 * hardcoded Unix path).
 *
 * @returns {string} Absolute path to the default log file.
 */
function defaultLogPath() {
  return path.join(os.tmpdir(), DEFAULT_LOG_BASENAME);
}

/**
 * Resolve the default evidence markdown file path relative to the current
 * working directory. Uses path.join so the separator matches the host OS.
 *
 * @returns {string} Absolute path to docs/release/evidence.md under cwd.
 */
function defaultEvidencePath() {
  return path.join(process.cwd(), "docs", "release", "evidence.md");
}

/**
 * Take the last N lines of a string. Preserves trailing whitespace-free
 * output so the appended block does not introduce spurious blank lines.
 *
 * @param {string} text - Full log contents.
 * @param {number} maxLines - Maximum number of trailing lines to keep.
 * @returns {string} The trailing slice joined with "\n".
 */
function tailLines(text, maxLines) {
  const lines = text.split(/\r?\n/);
  // Drop a single trailing empty line that comes from a terminal newline.
  if (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }
  const start = Math.max(0, lines.length - maxLines);
  return lines.slice(start).join("\n");
}

/**
 * Append a timestamped certification block to the evidence file. If the
 * evidence file does not yet contain the H2 section heading, the heading
 * is created before the block is appended so the file remains a valid
 * structured markdown artifact.
 *
 * @param {string} evidenceFile - Absolute path to evidence markdown.
 * @param {string} timestamp - ISO timestamp used as the H3 heading.
 * @param {string} tailText - Last N lines of the certification log.
 * @returns {void}
 */
function appendCertificationBlock(evidenceFile, timestamp, tailText) {
  let current = "";
  if (fs.existsSync(evidenceFile)) {
    current = fs.readFileSync(evidenceFile, "utf8");
  }
  const hasHeading = current.includes(EVIDENCE_H2);
  const parts = [];
  if (current.length > 0 && !current.endsWith("\n")) {
    parts.push("\n");
  }
  if (!hasHeading) {
    parts.push("\n");
    parts.push(EVIDENCE_H2);
    parts.push("\n");
  }
  parts.push("\n");
  parts.push("### ");
  parts.push(timestamp);
  parts.push("\n\n");
  parts.push("```");
  parts.push("\n");
  parts.push(tailText);
  parts.push("\n");
  parts.push("```");
  parts.push("\n");
  fs.appendFileSync(evidenceFile, parts.join(""), "utf8");
}

/**
 * Entry point. Parses argv, validates the log file, and appends a block.
 * Exits 1 on any failure so the npm script fails loudly.
 *
 * @returns {void}
 */
function main() {
  const logFile = process.argv[2] || defaultLogPath();
  const evidenceFile = process.argv[3] || defaultEvidencePath();

  if (!fs.existsSync(logFile)) {
    process.stderr.write(
      "demo-certify: log file not found: " + logFile + "\n",
    );
    process.exit(1);
  }

  const logText = fs.readFileSync(logFile, "utf8");
  const tail = tailLines(logText, MAX_LOG_TAIL_LINES);
  const timestamp = new Date().toISOString();

  appendCertificationBlock(evidenceFile, timestamp, tail);

  process.stdout.write(
    "demo-certify: appended block dated " +
      timestamp +
      " to " +
      evidenceFile +
      "\n",
  );
}

// Export for unit tests; run main only when executed directly.
module.exports = {
  defaultLogPath: defaultLogPath,
  defaultEvidencePath: defaultEvidencePath,
  tailLines: tailLines,
  appendCertificationBlock: appendCertificationBlock,
};

if (require.main === module) {
  main();
}
