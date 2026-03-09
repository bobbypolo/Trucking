import { v4 as uuidv4 } from "uuid";
import pool from "../db";
import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";

/**
 * Database row shape for the `call_sessions` table.
 */
export interface CallSessionRow extends RowDataPacket {
  id: string;
  company_id: string;
  start_time: string;
  end_time: string | null;
  duration_seconds: number;
  status: string;
  assigned_to: string | null;
  team: string | null;
  last_activity_at: string;
  notes: string | null;
  participants: string | null;
  links: string | null;
  created_at: string;
}

/**
 * Input shape for creating a call session.
 */
export interface CreateCallSessionInput {
  start_time?: string;
  end_time?: string | null;
  duration_seconds?: number;
  status?: string;
  assigned_to?: string | null;
  team?: string | null;
  notes?: string | null;
  participants?: unknown[] | null;
  links?: unknown[] | null;
}

/**
 * Call Session Repository — tenant-scoped data access for call_sessions table.
 *
 * Every query uses parameterized statements and includes company_id
 * for tenant isolation.
 */
export const callSessionRepository = {
  /**
   * Find all call sessions for a company. Tenant-scoped.
   */
  async findByCompany(companyId: string): Promise<CallSessionRow[]> {
    const [rows] = await pool.query<CallSessionRow[]>(
      "SELECT * FROM call_sessions WHERE company_id = ? ORDER BY start_time DESC",
      [companyId],
    );
    return rows;
  },

  /**
   * Find a single call session by ID, scoped to the given tenant.
   * Returns null if not found or belongs to a different tenant.
   */
  async findById(
    id: string,
    companyId: string,
  ): Promise<CallSessionRow | null> {
    const [rows] = await pool.query<CallSessionRow[]>(
      "SELECT * FROM call_sessions WHERE id = ? AND company_id = ?",
      [id, companyId],
    );
    return rows.length > 0 ? rows[0] : null;
  },

  /**
   * Create a new call session scoped to the given tenant.
   */
  async create(
    input: CreateCallSessionInput,
    companyId: string,
  ): Promise<CallSessionRow> {
    const id = uuidv4();
    const now = new Date().toISOString();
    await pool.query<ResultSetHeader>(
      `INSERT INTO call_sessions
        (id, company_id, start_time, end_time, duration_seconds, status,
         assigned_to, team, last_activity_at, notes, participants, links)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        companyId,
        input.start_time ?? now,
        input.end_time ?? null,
        input.duration_seconds ?? 0,
        input.status ?? "active",
        input.assigned_to ?? null,
        input.team ?? null,
        now,
        input.notes ?? null,
        input.participants ? JSON.stringify(input.participants) : null,
        input.links ? JSON.stringify(input.links) : null,
      ],
    );
    return (await this.findById(id, companyId)) as CallSessionRow;
  },

  /**
   * Update a call session scoped to the given tenant.
   * Returns null if not found or wrong tenant.
   */
  async update(
    id: string,
    data: Partial<Omit<CallSessionRow, "id" | "company_id" | "created_at">>,
    companyId: string,
  ): Promise<CallSessionRow | null> {
    const allowedFields = [
      "start_time",
      "end_time",
      "duration_seconds",
      "status",
      "assigned_to",
      "team",
      "last_activity_at",
      "notes",
      "participants",
      "links",
    ];

    const setClauses: string[] = [];
    const values: unknown[] = [];

    for (const field of allowedFields) {
      if (field in data) {
        setClauses.push(`${field} = ?`);
        const val = (data as Record<string, unknown>)[field];
        if (Array.isArray(val) || (val !== null && typeof val === "object")) {
          values.push(JSON.stringify(val));
        } else {
          values.push(val ?? null);
        }
      }
    }

    if (setClauses.length === 0) {
      return this.findById(id, companyId);
    }

    values.push(id, companyId);
    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE call_sessions SET ${setClauses.join(", ")} WHERE id = ? AND company_id = ?`,
      values,
    );

    if (result.affectedRows === 0) {
      return null;
    }

    return this.findById(id, companyId);
  },

  /**
   * Delete a call session scoped to the given tenant.
   * Returns true if deleted, false if not found.
   */
  async delete(id: string, companyId: string): Promise<boolean> {
    const [result] = await pool.query<ResultSetHeader>(
      "DELETE FROM call_sessions WHERE id = ? AND company_id = ?",
      [id, companyId],
    );
    return result.affectedRows > 0;
  },
};
