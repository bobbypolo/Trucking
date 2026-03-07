import pool from "../db";
import type { RowDataPacket } from "mysql2/promise";

/**
 * Database row shape for the `dispatch_events` table.
 */
export interface DispatchEventRow extends RowDataPacket {
  id: string;
  load_id: string;
  dispatcher_id: string;
  actor_id: string;
  event_type: string;
  prior_state: string | null;
  next_state: string | null;
  correlation_id: string | null;
  message: string | null;
  payload: string | null;
  created_at: string;
}

/**
 * Input shape for creating a dispatch event.
 */
export interface CreateDispatchEventInput {
  id: string;
  load_id: string;
  dispatcher_id: string;
  actor_id: string;
  event_type: string;
  prior_state?: string | null;
  next_state?: string | null;
  correlation_id?: string | null;
  message?: string | null;
  payload?: Record<string, unknown> | null;
}

/**
 * Dispatch Event Repository — append-only event store.
 *
 * This repository intentionally exposes NO update or delete methods.
 * Events are immutable once created, forming an append-only audit trail.
 *
 * All read queries are tenant-scoped via JOIN to the loads table
 * to ensure tenant isolation.
 *
 * @story R-P2-04
 */
export const dispatchEventRepository = {
  /**
   * Create a new dispatch event (INSERT only — append-only).
   *
   * @param input - Event data including actor_id, prior_state, next_state, correlation_id
   */
  async create(input: CreateDispatchEventInput): Promise<void> {
    await pool.execute(
      `INSERT INTO dispatch_events
        (id, load_id, dispatcher_id, actor_id, event_type, prior_state, next_state, correlation_id, message, payload)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.load_id,
        input.dispatcher_id,
        input.actor_id,
        input.event_type,
        input.prior_state ?? null,
        input.next_state ?? null,
        input.correlation_id ?? null,
        input.message ?? null,
        JSON.stringify(input.payload ?? {}),
      ],
    );
  },

  /**
   * Find all dispatch events for a load, scoped to the given tenant.
   * Returns events in chronological order (oldest first).
   *
   * @param loadId - The load to fetch events for
   * @param companyId - Tenant ID for isolation (verified via JOIN to loads table)
   * @returns Array of dispatch event rows in chronological order
   */
  async findByLoadId(
    loadId: string,
    companyId: string,
  ): Promise<DispatchEventRow[]> {
    const [rows] = await pool.query<DispatchEventRow[]>(
      `SELECT de.*
       FROM dispatch_events de
       INNER JOIN loads l ON de.load_id = l.id
       WHERE de.load_id = ? AND l.company_id = ?
       ORDER BY de.created_at ASC`,
      [loadId, companyId],
    );
    return rows;
  },
};
