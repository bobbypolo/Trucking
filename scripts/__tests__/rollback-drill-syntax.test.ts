/**
 * Syntax validation tests for rollback-drill.sh and setup-monitoring.sh
 *
 * Tests R-P4-01, R-P4-02, R-P4-03, R-P4-04, R-P4-05, R-P4-06, R-P4-07, R-P4-08,
 * R-P4-09 (self), R-P4-10
 *
 * These tests validate script content without executing them against real GCP infrastructure.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const REPO_ROOT = path.resolve(__dirname, "../..");
const ROLLBACK_SCRIPT = path.join(REPO_ROOT, "scripts", "rollback-drill.sh");
const MONITORING_SCRIPT = path.join(REPO_ROOT, "scripts", "setup-monitoring.sh");

function readScript(filePath: string): string {
  return fs.readFileSync(filePath, "utf-8");
}

function countMatches(content: string, pattern: RegExp | string): number {
  if (typeof pattern === "string") {
    return content.split(pattern).length - 1;
  }
  const matches = content.match(new RegExp(pattern.source, "g"));
  return matches ? matches.length : 0;
}

// ─── rollback-drill.sh ───────────────────────────────────────────────────────

describe("rollback-drill.sh — existence and structure", () => {
  it("R-P4-01: rollback-drill.sh exists", () => {
    expect(fs.existsSync(ROLLBACK_SCRIPT)).toBe(true);
  });

  it("R-P4-03: uses gcloud run services update-traffic command", () => {
    const content = readScript(ROLLBACK_SCRIPT);
    expect(countMatches(content, "update-traffic")).toBeGreaterThanOrEqual(1);
  });

  it("R-P4-04: checks /api/health before rollback", () => {
    const content = readScript(ROLLBACK_SCRIPT);
    const healthChecks = countMatches(content, "/api/health");
    expect(healthChecks).toBeGreaterThanOrEqual(2);
  });

  it("references loadpilot-api service name", () => {
    const content = readScript(ROLLBACK_SCRIPT);
    expect(content).toContain("loadpilot-api");
  });

  it("lists Cloud Run revisions", () => {
    const content = readScript(ROLLBACK_SCRIPT);
    expect(content).toContain("revisions list");
  });

  it("appends evidence to ROLLBACK_DRILL_EVIDENCE.md", () => {
    const content = readScript(ROLLBACK_SCRIPT);
    expect(content).toContain("ROLLBACK_DRILL_EVIDENCE");
  });

  it("has shebang line for bash", () => {
    const content = readScript(ROLLBACK_SCRIPT);
    expect(content.startsWith("#!/usr/bin/env bash") || content.startsWith("#!/bin/bash")).toBe(
      true,
    );
  });

  it("exits with non-zero code on health check failure", () => {
    const content = readScript(ROLLBACK_SCRIPT);
    // script must handle error conditions — look for exit 1 or error handling
    expect(content).toMatch(/exit\s+1|set\s+-e/);
  });
});

// ─── setup-monitoring.sh ─────────────────────────────────────────────────────

describe("setup-monitoring.sh — existence and structure", () => {
  it("R-P4-02: setup-monitoring.sh exists", () => {
    expect(fs.existsSync(MONITORING_SCRIPT)).toBe(true);
  });

  it("R-P4-05: does NOT use gcloud alpha commands", () => {
    const content = readScript(MONITORING_SCRIPT);
    expect(countMatches(content, "gcloud alpha")).toBe(0);
  });

  it("R-P4-06: uses --policy-from-file flag for alert policies", () => {
    const content = readScript(MONITORING_SCRIPT);
    expect(countMatches(content, "policy-from-file")).toBeGreaterThanOrEqual(1);
  });

  it("R-P4-07: references error rate threshold", () => {
    const content = readScript(MONITORING_SCRIPT);
    // must mention error rate in policy
    expect(content.toLowerCase()).toMatch(/error/);
  });

  it("R-P4-08: uses gcloud beta monitoring channels for notification channel creation", () => {
    const content = readScript(MONITORING_SCRIPT);
    expect(content).toMatch(/gcloud\s+beta\s+monitoring\s+channels/);
  });

  it("uses stable gcloud monitoring policies create (not alpha) for alert policies", () => {
    const content = readScript(MONITORING_SCRIPT);
    expect(content).toContain("gcloud monitoring policies create");
    expect(content).not.toContain("gcloud alpha monitoring");
  });

  it("references p99 latency threshold", () => {
    const content = readScript(MONITORING_SCRIPT);
    // must set a latency threshold — look for latency or p99 or 3s
    expect(content.toLowerCase()).toMatch(/latency|p99/);
  });

  it("generates JSON policy file content", () => {
    const content = readScript(MONITORING_SCRIPT);
    // policy files must be generated inline as JSON
    expect(content).toContain("displayName");
  });

  it("links notification channel to alert policies", () => {
    const content = readScript(MONITORING_SCRIPT);
    // script must link channel to policies
    expect(content).toMatch(/notificationChannels|notification.*channel/i);
  });

  it("has shebang line for bash", () => {
    const content = readScript(MONITORING_SCRIPT);
    expect(content.startsWith("#!/usr/bin/env bash") || content.startsWith("#!/bin/bash")).toBe(
      true,
    );
  });
});
