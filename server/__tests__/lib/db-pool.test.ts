import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock mysql2/promise before importing db.ts
vi.mock('mysql2/promise', () => {
  const mockPool = {
    end: vi.fn().mockResolvedValue(undefined),
    query: vi.fn(),
    getConnection: vi.fn(),
  };
  return {
    default: {
      createPool: vi.fn().mockReturnValue(mockPool),
    },
    createPool: vi.fn().mockReturnValue(mockPool),
  };
});

vi.unmock('../../db');

describe('db-pool', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('pool config has connectionLimit: 25', async () => {
    const mysql = await import('mysql2/promise');
    // Re-import db to trigger createPool with mocked mysql
    await import('../../db');
    const createPool = (mysql as any).default?.createPool || (mysql as any).createPool;
    expect(createPool).toHaveBeenCalled();
    const config = createPool.mock.calls[0][0];
    expect(config.connectionLimit).toBe(25);
  });

  it('pool config has queueLimit: 100', async () => {
    const mysql = await import('mysql2/promise');
    await import('../../db');
    const createPool = (mysql as any).default?.createPool || (mysql as any).createPool;
    const config = createPool.mock.calls[0][0];
    expect(config.queueLimit).toBe(100);
  });

  it('pool config has enableKeepAlive: true', async () => {
    const mysql = await import('mysql2/promise');
    await import('../../db');
    const createPool = (mysql as any).default?.createPool || (mysql as any).createPool;
    const config = createPool.mock.calls[0][0];
    expect(config.enableKeepAlive).toBe(true);
  });

  it('closePool calls pool.end()', async () => {
    const mysql = await import('mysql2/promise');
    const { closePool } = await import('../../db');
    const createPool = (mysql as any).default?.createPool || (mysql as any).createPool;
    const mockPool = createPool.mock.results[0].value;
    await closePool();
    expect(mockPool.end).toHaveBeenCalledOnce();
  });

  it('closePool resolves without throwing on success', async () => {
    await import('../../db');
    const { closePool } = await import('../../db');
    await expect(closePool()).resolves.toBeUndefined();
  });
});
