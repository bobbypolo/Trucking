import pool from '../db';
import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

/**
 * Execute a callback within a database transaction.
 * Automatically commits on success or rolls back on error.
 * The connection is always released back to the pool.
 */
export async function withTransaction<T>(
    fn: (connection: PoolConnection) => Promise<T>,
    connectionPool: Pool = pool,
): Promise<T> {
    const connection = await connectionPool.getConnection();
    try {
        await connection.beginTransaction();
        const result = await fn(connection);
        await connection.commit();
        return result;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

/**
 * Type-safe query helper that returns typed rows.
 * Uses parameterized queries exclusively.
 */
export async function query<T extends RowDataPacket>(
    sql: string,
    params: unknown[] = [],
    connectionPool: Pool = pool,
): Promise<T[]> {
    const [rows] = await connectionPool.query<T[]>(sql, params);
    return rows;
}

/**
 * Execute an INSERT/UPDATE/DELETE and return the result header.
 * Uses parameterized queries exclusively.
 */
export async function execute(
    sql: string,
    params: unknown[] = [],
    connectionPool: Pool = pool,
): Promise<ResultSetHeader> {
    const [result] = await connectionPool.execute<ResultSetHeader>(sql, params);
    return result;
}

export type { PoolConnection, ResultSetHeader, RowDataPacket };
