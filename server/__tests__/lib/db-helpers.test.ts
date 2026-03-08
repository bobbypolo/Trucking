import { describe, it, expect, vi, beforeEach } from 'vitest';

// Tests R-P2-01-AC2

// Mock pool before importing db-helpers
const mockQuery = vi.fn();
const mockExecute = vi.fn();
const mockBeginTransaction = vi.fn();
const mockCommit = vi.fn();
const mockRollback = vi.fn();
const mockRelease = vi.fn();
const mockGetConnection = vi.fn();

const mockConnection = {
    beginTransaction: mockBeginTransaction,
    commit: mockCommit,
    rollback: mockRollback,
    release: mockRelease,
    query: mockQuery,
    execute: mockExecute,
};

const mockPool = {
    query: mockQuery,
    execute: mockExecute,
    getConnection: mockGetConnection,
};

vi.mock('../../db', () => ({
    default: {
        query: vi.fn(),
        execute: vi.fn(),
        getConnection: vi.fn(),
    },
}));

import { withTransaction, query, execute } from '../../lib/db-helpers';

describe('R-P2-01: db-helpers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetConnection.mockResolvedValue(mockConnection);
        mockBeginTransaction.mockResolvedValue(undefined);
        mockCommit.mockResolvedValue(undefined);
        mockRollback.mockResolvedValue(undefined);
        mockRelease.mockReturnValue(undefined);
    });

    describe('withTransaction', () => {
        it('commits on success and returns result', async () => {
            const expectedResult = { id: 'load-1' };
            const fn = vi.fn().mockResolvedValue(expectedResult);

            const result = await withTransaction(fn, mockPool as any);

            expect(mockGetConnection).toHaveBeenCalledOnce();
            expect(mockBeginTransaction).toHaveBeenCalledOnce();
            expect(fn).toHaveBeenCalledWith(mockConnection);
            expect(mockCommit).toHaveBeenCalledOnce();
            expect(mockRollback).not.toHaveBeenCalled();
            expect(mockRelease).toHaveBeenCalledOnce();
            expect(result).toEqual(expectedResult);
        });

        it('rolls back on error and re-throws', async () => {
            const error = new Error('DB failure');
            const fn = vi.fn().mockRejectedValue(error);

            await expect(withTransaction(fn, mockPool as any)).rejects.toThrow('DB failure');

            expect(mockBeginTransaction).toHaveBeenCalledOnce();
            expect(mockRollback).toHaveBeenCalledOnce();
            expect(mockCommit).not.toHaveBeenCalled();
            expect(mockRelease).toHaveBeenCalledOnce();
        });

        it('always releases connection even on rollback error', async () => {
            const fn = vi.fn().mockRejectedValue(new Error('fn error'));
            mockRollback.mockRejectedValue(new Error('rollback error'));

            await expect(withTransaction(fn, mockPool as any)).rejects.toThrow('rollback error');

            expect(mockRelease).toHaveBeenCalledOnce();
        });
    });

    describe('query helper', () => {
        it('returns typed rows from parameterized query', async () => {
            const rows = [{ id: '1', name: 'Load A' }];
            mockQuery.mockResolvedValue([rows, []]);

            const result = await query('SELECT * FROM loads WHERE company_id = ?', ['comp-1'], mockPool as any);

            expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM loads WHERE company_id = ?', ['comp-1']);
            expect(result).toEqual(rows);
        });

        it('returns empty array when no rows match', async () => {
            mockQuery.mockResolvedValue([[], []]);

            const result = await query('SELECT * FROM loads WHERE id = ?', ['nonexistent'], mockPool as any);

            expect(result).toEqual([]);
        });
    });

    describe('execute helper', () => {
        it('returns ResultSetHeader from parameterized statement', async () => {
            const header = { affectedRows: 1, insertId: 0 };
            mockExecute.mockResolvedValue([header, []]);

            const result = await execute(
                'INSERT INTO loads (id, company_id) VALUES (?, ?)',
                ['load-1', 'comp-1'],
                mockPool as any,
            );

            expect(mockExecute).toHaveBeenCalledWith(
                'INSERT INTO loads (id, company_id) VALUES (?, ?)',
                ['load-1', 'comp-1'],
            );
            expect(result).toEqual(header);
        });
    });
});
