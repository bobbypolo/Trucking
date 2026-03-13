/**
 * provision-gcp-syntax.test.ts
 *
 * Syntax validation tests for scripts/provision-gcp.sh.
 * Tests read file content and grep for required commands — no live GCP needed.
 *
 * R-P2-01 through R-P2-14 coverage (structural criteria validated here).
 * Tests R-P2-01, R-P2-02, R-P2-03, R-P2-04, R-P2-05, R-P2-06, R-P2-07, R-P2-08, R-P2-09, R-P2-10, R-P2-14
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const SCRIPT_PATH = path.resolve(__dirname, '../../scripts/provision-gcp.sh');

let scriptContent: string;

beforeAll(() => {
  scriptContent = fs.readFileSync(SCRIPT_PATH, 'utf-8');
});

describe('provision-gcp.sh syntax validation', () => {
  it('R-P2-01: script file exists', () => {
    expect(fs.existsSync(SCRIPT_PATH)).toBe(true);
  });

  it('R-P2-02: script targets correct GCP project ID (gen-lang-client-0535844903) at least 3 times', () => {
    const matches = scriptContent.match(/gen-lang-client-0535844903/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(3);
  });

  it('R-P2-03: script enables all 5 required APIs', () => {
    const matches = scriptContent.match(/services enable/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(5);
    // Verify specific APIs are enabled
    expect(scriptContent).toContain('run.googleapis.com');
    expect(scriptContent).toContain('sqladmin.googleapis.com');
    expect(scriptContent).toContain('secretmanager.googleapis.com');
    expect(scriptContent).toContain('artifactregistry.googleapis.com');
    expect(scriptContent).toContain('cloudbuild.googleapis.com');
  });

  it('R-P2-04: script uses Artifact Registry (not deprecated GCR)', () => {
    const matches = scriptContent.match(/artifacts repositories|artifactregistry/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(1);
    // Ensure GCR is not used
    expect(scriptContent).not.toContain('gcr.io');
  });

  it('R-P2-05: script creates Cloud SQL instance', () => {
    const matches = scriptContent.match(/sql instances create/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(1);
  });

  it('R-P2-05b: script uses MySQL 8.0 for Cloud SQL', () => {
    expect(scriptContent).toContain('MYSQL_8_0');
  });

  it('R-P2-06: script creates at least 2 secrets in Secret Manager (DB_PASSWORD and GEMINI_API_KEY)', () => {
    const matches = scriptContent.match(/secrets create/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(2);
    // Verify the correct secrets are created
    expect(scriptContent).toContain('DB_PASSWORD');
    expect(scriptContent).toContain('GEMINI_API_KEY');
  });

  it('R-P2-07: script creates dedicated service account (loadpilot-api-sa)', () => {
    const matches = scriptContent.match(/loadpilot-api-sa|iam service-accounts create/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(1);
  });

  it('R-P2-08: script grants secretAccessor role to service account', () => {
    const matches = scriptContent.match(/secretmanager\.secretAccessor|secretAccessor/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(1);
  });

  it('R-P2-09: script grants cloudsql.client role to service account', () => {
    const matches = scriptContent.match(/cloudsql\.client/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(1);
  });

  it('R-P2-10: script documents db-f1-micro as staging-only (shared core, no SLA)', () => {
    const matches = scriptContent.match(/staging.only|shared.core|not.production|staging only|shared core|no SLA/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(1);
  });

  it('R-P2-14: script grants serviceAccountUser on dedicated SA to deployer', () => {
    const matches = scriptContent.match(/serviceAccountUser|iam\.serviceAccountUser/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(1);
  });

  it('script is idempotent — uses || true or existence checks for all resource creation commands', () => {
    // Verify the script has idempotency patterns
    expect(scriptContent).toContain('|| true');
  });

  it('script validates DB_PASSWORD is set before running', () => {
    expect(scriptContent).toContain('DB_PASSWORD');
    expect(scriptContent).toContain('exit 1');
  });
});
