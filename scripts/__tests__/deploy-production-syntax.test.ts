/**
 * deploy-production-syntax.test.ts
 *
 * Syntax validation tests for scripts/deploy-production.sh.
 * Tests read file content and grep for required patterns — no live GCP needed.
 *
 * Tests R-P2-10, R-P2-11, R-P2-12, R-P2-13, R-P2-14, R-P2-15, R-P2-16, R-P2-17
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const SCRIPT_PATH = path.resolve(__dirname, '../../scripts/deploy-production.sh');

let scriptContent: string;

beforeAll(() => {
  scriptContent = fs.existsSync(SCRIPT_PATH)
    ? fs.readFileSync(SCRIPT_PATH, 'utf-8')
    : '';
});

describe('deploy-production.sh syntax validation', () => {
  it('R-P2-10: script file exists', () => {
    expect(fs.existsSync(SCRIPT_PATH)).toBe(true);
  });

  it('R-P2-11: deploy script uses --no-traffic flag (zero initial traffic)', () => {
    const matches = scriptContent.match(/--no-traffic|no-traffic/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(1);
  });

  it('R-P2-12: deploy script sets NODE_ENV=production', () => {
    const matches = scriptContent.match(/NODE_ENV=production/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(1);
  });

  it('R-P2-13: deploy script uses --min-instances=1 (no cold starts in production)', () => {
    const hasMinInstances1 =
      scriptContent.includes('--min-instances=1') || scriptContent.includes('--min-instances 1');
    expect(hasMinInstances1).toBe(true);
  });

  it('R-P2-14: deploy script uses production service account (loadpilot-api-prod-sa)', () => {
    const matches = scriptContent.match(/loadpilot-api-prod-sa/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(1);
  });

  it('R-P2-15: deploy script uses production Cloud SQL connection (loadpilot-prod)', () => {
    expect(scriptContent).toContain('loadpilot-prod');
    expect(scriptContent).toContain('gen-lang-client-0535844903');
  });

  it('R-P2-16: deploy script sets DB_SOCKET_PATH for production', () => {
    expect(scriptContent).toContain('DB_SOCKET_PATH');
    expect(scriptContent).toContain('/cloudsql/');
  });

  it('deploy script uses Artifact Registry (docker.pkg.dev, not gcr.io)', () => {
    expect(scriptContent).toContain('docker.pkg.dev');
    expect(scriptContent).not.toContain('gcr.io');
  });

  it('deploy script targets loadpilot-api-prod Cloud Run service', () => {
    expect(scriptContent).toContain('loadpilot-api-prod');
  });

  it('deploy script uses set -euo pipefail for strict error handling', () => {
    expect(scriptContent).toContain('set -euo pipefail');
  });

  it('deploy script uses production secrets with _PROD suffix', () => {
    expect(scriptContent).toContain('DB_PASSWORD_PROD');
    expect(scriptContent).toContain('GEMINI_API_KEY_PROD');
  });

  it('deploy script prints deployed revision name for traffic management', () => {
    const hasRevision = scriptContent.includes('REVISION_NAME') || scriptContent.includes('revision');
    expect(hasRevision).toBe(true);
  });
});
