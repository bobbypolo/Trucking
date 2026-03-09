import { v4 as uuidv4 } from "uuid";
import pool from "../db";
import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";

/**
 * Database row shape for the `messages` table.
 */
export interface MessageRow extends RowDataPacket {
  id: string;
  company_id: string;
  load_id: string;
  sender_id: string;
  sender_name: string | null;
  text: string | null;
  timestamp: string;
  attachments: string | null;
}

/**
 * Input shape for creating a message.
 */
export interface CreateMessageInput {
  load_id: string;
  sender_id: string;
  sender_name?: string | null;
  text?: string | null;
  attachments?: unknown[] | null;
}

/**
 * Message Repository — tenant-scoped data access for the messages table.
 *
 * Every query uses parameterized statements and includes company_id
 * for tenant isolation.
 */
export const messageRepository = {
  /**
   * Find all messages for a company, optionally filtered by load.
   * Tenant-scoped.
   */
  async findByCompany(
    companyId: string,
    loadId?: string,
  ): Promise<MessageRow[]> {
    if (loadId) {
      const [rows] = await pool.query<MessageRow[]>(
        "SELECT * FROM messages WHERE company_id = ? AND load_id = ? ORDER BY timestamp ASC",
        [companyId, loadId],
      );
      return rows;
    }
    const [rows] = await pool.query<MessageRow[]>(
      "SELECT * FROM messages WHERE company_id = ? ORDER BY timestamp DESC",
      [companyId],
    );
    return rows;
  },

  /**
   * Find a single message by ID, scoped to the given tenant.
   * Returns null if not found or belongs to a different tenant.
   */
  async findById(id: string, companyId: string): Promise<MessageRow | null> {
    const [rows] = await pool.query<MessageRow[]>(
      "SELECT * FROM messages WHERE id = ? AND company_id = ?",
      [id, companyId],
    );
    return rows.length > 0 ? rows[0] : null;
  },

  /**
   * Create a new message scoped to the given tenant.
   */
  async create(
    input: CreateMessageInput,
    companyId: string,
  ): Promise<MessageRow> {
    const id = uuidv4();
    await pool.query<ResultSetHeader>(
      `INSERT INTO messages
        (id, company_id, load_id, sender_id, sender_name, text, attachments)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        companyId,
        input.load_id,
        input.sender_id,
        input.sender_name ?? null,
        input.text ?? null,
        input.attachments ? JSON.stringify(input.attachments) : null,
      ],
    );
    return (await this.findById(id, companyId)) as MessageRow;
  },

  /**
   * Delete a message scoped to the given tenant.
   * Returns true if deleted, false if not found.
   */
  async delete(id: string, companyId: string): Promise<boolean> {
    const [result] = await pool.query<ResultSetHeader>(
      "DELETE FROM messages WHERE id = ? AND company_id = ?",
      [id, companyId],
    );
    return result.affectedRows > 0;
  },
};
