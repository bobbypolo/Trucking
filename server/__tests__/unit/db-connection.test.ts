/**
 * Unit tests for db.ts Cloud SQL socket support.
 *
 * Tests R-P1-01, R-P1-02, R-P1-04
 *
 * These tests verify the pool configuration logic without opening
 * a real database connection by mocking mysql2/promise.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We capture the config passed to createPool so we can assert on it.
let capturedConfig: Record<string, unknown> = {};

vi.mock('mysql2/promise', () => ({
  default: {
    createPool: vi.fn((config: Record<string, unknown>) => {
      capturedConfig = config;
      return {
        end: vi.fn(),
        query: vi.fn(),
        getConnection: vi.fn(),
      };
    }),
  },
}));

// Helper: reset module registry so db.ts re-evaluates with new env vars.
async function loadDb(env: Record<string, string | undefined>) {
  // Save original env
  const saved: Record<string, string | undefined> = {};
  for (const k of Object.keys(env)) {
    saved[k] = process.env[k];
    if (env[k] === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = env[k];
    }
  }

  // Force re-import of db module
  vi.resetModules();
  const mod = await import('../../db.js');

  // Restore env
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = v;
    }
  }

  return mod;
}

describe('db.ts — Cloud SQL socket support', () => {
  beforeEach(() => {
    capturedConfig = {};
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('uses socketPath when DB_SOCKET_PATH is set (Cloud SQL Unix socket mode)', async () => {
    await loadDb({
      DB_SOCKET_PATH: '/cloudsql/project:region:instance',
      DB_HOST: undefined,
      DB_PORT: undefined,
      DB_USER: 'user',
      DB_PASSWORD: 'pass',
      DB_NAME: 'db',
    });

    expect(capturedConfig.socketPath).toBe('/cloudsql/project:region:instance');
    expect(capturedConfig.host).toBeUndefined();
  });

  it('uses host+port when DB_SOCKET_PATH is not set (TCP mode)', async () => {
    await loadDb({
      DB_SOCKET_PATH: undefined,
      DB_HOST: '127.0.0.1',
      DB_PORT: '3306',
      DB_USER: 'user',
      DB_PASSWORD: 'pass',
      DB_NAME: 'db',
    });

    expect(capturedConfig.host).toBe('127.0.0.1');
    expect(capturedConfig.socketPath).toBeUndefined();
  });

  it('does not overload DB_HOST with socket path — uses separate DB_SOCKET_PATH env var', async () => {
    // This test confirms the separation of concerns:
    // DB_SOCKET_PATH is distinct from DB_HOST (no overloading).
    await loadDb({
      DB_SOCKET_PATH: '/cloudsql/project:region:instance',
      DB_HOST: '127.0.0.1',  // Both set — socket path should win
      DB_USER: 'user',
      DB_PASSWORD: 'pass',
      DB_NAME: 'db',
    });

    // socketPath takes precedence; host must be omitted from config
    expect(capturedConfig.socketPath).toBe('/cloudsql/project:region:instance');
    expect(capturedConfig.host).toBeUndefined();
  });
});
