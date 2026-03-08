import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Tests R-P1-09-AC1

describe('R-P1-09: Environment Validation on Boot', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    // Reset module cache so validateEnv re-reads process.env
    vi.resetModules();
    // Clone env to avoid cross-test contamination
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  const REQUIRED_VARS = [
    'DB_HOST',
    'DB_USER',
    'DB_PASSWORD',
    'DB_NAME',
  ];

  describe('AC1: Server fails fast with descriptive error if required env vars missing', () => {
    it('throws when all required vars are missing', async () => {
      // Remove all required vars
      for (const v of REQUIRED_VARS) {
        delete process.env[v];
      }
      delete process.env.FIREBASE_PROJECT_ID;
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS;

      const { validateEnv } = await import('../../lib/env');
      expect(() => validateEnv()).toThrow();
    });

    it('error message lists ALL missing vars, not just the first one', async () => {
      for (const v of REQUIRED_VARS) {
        delete process.env[v];
      }
      delete process.env.FIREBASE_PROJECT_ID;
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS;

      const { validateEnv } = await import('../../lib/env');
      try {
        validateEnv();
        expect.unreachable('Should have thrown');
      } catch (e: any) {
        // Should mention all missing DB vars
        for (const v of REQUIRED_VARS) {
          expect(e.message).toContain(v);
        }
        // Should mention Firebase requirement
        expect(e.message).toMatch(/FIREBASE_PROJECT_ID|GOOGLE_APPLICATION_CREDENTIALS/);
      }
    });

    it('throws when only DB_HOST is missing', async () => {
      process.env.DB_HOST = '';
      process.env.DB_USER = 'testuser';
      process.env.DB_PASSWORD = 'testpass';
      process.env.DB_NAME = 'testdb';
      process.env.FIREBASE_PROJECT_ID = 'test-project';

      const { validateEnv } = await import('../../lib/env');
      expect(() => validateEnv()).toThrow(/DB_HOST/);
    });

    it('throws when only DB_PASSWORD is missing', async () => {
      process.env.DB_HOST = 'localhost';
      process.env.DB_USER = 'testuser';
      delete process.env.DB_PASSWORD;
      process.env.DB_NAME = 'testdb';
      process.env.FIREBASE_PROJECT_ID = 'test-project';

      const { validateEnv } = await import('../../lib/env');
      expect(() => validateEnv()).toThrow(/DB_PASSWORD/);
    });

    it('throws when neither FIREBASE_PROJECT_ID nor GOOGLE_APPLICATION_CREDENTIALS set', async () => {
      process.env.DB_HOST = 'localhost';
      process.env.DB_USER = 'testuser';
      process.env.DB_PASSWORD = 'testpass';
      process.env.DB_NAME = 'testdb';
      delete process.env.FIREBASE_PROJECT_ID;
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS;

      const { validateEnv } = await import('../../lib/env');
      expect(() => validateEnv()).toThrow(/FIREBASE_PROJECT_ID.*GOOGLE_APPLICATION_CREDENTIALS|GOOGLE_APPLICATION_CREDENTIALS.*FIREBASE_PROJECT_ID/);
    });

    it('passes when all required vars present with FIREBASE_PROJECT_ID', async () => {
      process.env.DB_HOST = 'localhost';
      process.env.DB_USER = 'testuser';
      process.env.DB_PASSWORD = 'testpass';
      process.env.DB_NAME = 'testdb';
      process.env.FIREBASE_PROJECT_ID = 'test-project';

      const { validateEnv } = await import('../../lib/env');
      expect(() => validateEnv()).not.toThrow();
    });

    it('passes when all required vars present with GOOGLE_APPLICATION_CREDENTIALS instead', async () => {
      process.env.DB_HOST = 'localhost';
      process.env.DB_USER = 'testuser';
      process.env.DB_PASSWORD = 'testpass';
      process.env.DB_NAME = 'testdb';
      delete process.env.FIREBASE_PROJECT_ID;
      process.env.GOOGLE_APPLICATION_CREDENTIALS = '/path/to/serviceAccount.json';

      const { validateEnv } = await import('../../lib/env');
      expect(() => validateEnv()).not.toThrow();
    });

    it('JWT_SECRET missing does NOT cause failure (Firebase-only auth)', async () => {
      process.env.DB_HOST = 'localhost';
      process.env.DB_USER = 'testuser';
      process.env.DB_PASSWORD = 'testpass';
      process.env.DB_NAME = 'testdb';
      process.env.FIREBASE_PROJECT_ID = 'test-project';
      delete process.env.JWT_SECRET;

      const { validateEnv } = await import('../../lib/env');
      expect(() => validateEnv()).not.toThrow();
    });

    it('no hardcoded fallback values — empty string treated as missing', async () => {
      process.env.DB_HOST = '';
      process.env.DB_USER = '';
      process.env.DB_PASSWORD = '';
      process.env.DB_NAME = '';
      delete process.env.FIREBASE_PROJECT_ID;
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS;

      const { validateEnv } = await import('../../lib/env');
      try {
        validateEnv();
        expect.unreachable('Should have thrown');
      } catch (e: any) {
        expect(e.message).toContain('DB_HOST');
        expect(e.message).toContain('DB_USER');
        expect(e.message).toContain('DB_PASSWORD');
        expect(e.message).toContain('DB_NAME');
      }
    });

    it('multiple missing vars are listed in a single error message', async () => {
      delete process.env.DB_HOST;
      delete process.env.DB_USER;
      process.env.DB_PASSWORD = 'testpass';
      process.env.DB_NAME = 'testdb';
      process.env.FIREBASE_PROJECT_ID = 'test-project';

      const { validateEnv } = await import('../../lib/env');
      try {
        validateEnv();
        expect.unreachable('Should have thrown');
      } catch (e: any) {
        expect(e.message).toContain('DB_HOST');
        expect(e.message).toContain('DB_USER');
        // Should NOT mention vars that are present
        expect(e.message).not.toContain('DB_PASSWORD');
        expect(e.message).not.toContain('DB_NAME');
      }
    });
  });
});
