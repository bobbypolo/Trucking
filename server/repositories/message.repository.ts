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
  thread_id: string | null;
  sender_id: string;
  sender_name: string | null;
  text: string | null;
  timestamp: string;
  attachments: string | null;
  read_at: string | null;
}

/**
 * Database row shape for the `threads` table.
 */
export interface ThreadRow extends RowDataPacket {
  id: string;
  company_id: string;
  title: string | null;
  load_id: string | null;
  participant_ids: string | null;
  status: string;
  owner_id: string | null;
  record_links: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
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
  thread_id?: string | null;
}

/**
 * Input shape for creating a thread.
 */
export interface CreateThreadInput {
  title?: string | null;
  load_id?: string | null;
  participant_ids: string[];
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
        (id, company_id, load_id, thread_id, sender_id, sender_name, text, attachments)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        companyId,
        input.load_id,
        input.thread_id ?? null,
        input.sender_id,
        input.sender_name ?? null,
        input.text ?? null,
        input.attachments ? JSON.stringify(input.attachments) : null,
      ],
    );
    const created = await this.findById(id, companyId);
    if (!created) {
      throw new Error(`Failed to retrieve created message ${id}`);
    }
    return created;
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

  /**
   * Create a new thread scoped to the given tenant.
   */
  async createThread(
    input: CreateThreadInput,
    companyId: string,
  ): Promise<ThreadRow> {
    const id = uuidv4();
    await pool.query<ResultSetHeader>(
      `INSERT INTO threads
        (id, company_id, title, load_id, participant_ids)
       VALUES (?, ?, ?, ?, ?)`,
      [
        id,
        companyId,
        input.title ?? null,
        input.load_id ?? null,
        JSON.stringify(input.participant_ids),
      ],
    );
    const [rows] = await pool.query<ThreadRow[]>(
      "SELECT * FROM threads WHERE id = ? AND company_id = ?",
      [id, companyId],
    );
    return rows[0];
  },

  /**
   * Find all threads for a company, optionally filtered by load_id.
   * Tenant-scoped.
   */
  async findThreadsByCompany(
    companyId: string,
    loadId?: string,
  ): Promise<ThreadRow[]> {
    if (loadId) {
      const [rows] = await pool.query<ThreadRow[]>(
        "SELECT * FROM threads WHERE company_id = ? AND load_id = ? ORDER BY updated_at DESC",
        [companyId, loadId],
      );
      return rows;
    }
    const [rows] = await pool.query<ThreadRow[]>(
      "SELECT * FROM threads WHERE company_id = ? ORDER BY updated_at DESC",
      [companyId],
    );
    return rows;
  },

  /**
   * Find all messages for a given thread, tenant-scoped, ordered by created_at ASC.
   */
  async findByThread(
    threadId: string,
    companyId: string,
  ): Promise<MessageRow[]> {
    const [rows] = await pool.query<MessageRow[]>(
      "SELECT * FROM messages WHERE thread_id = ? AND company_id = ? ORDER BY created_at ASC",
      [threadId, companyId],
    );
    return rows;
  },

  /**
   * Mark a message as read by setting read_at. Returns the ISO timestamp or null if not found.
   * Tenant-scoped.
   */
  async markRead(id: string, companyId: string): Promise<string | null> {
    const now = new Date().toISOString().slice(0, 19).replace("T", " ");
    const [result] = await pool.query<ResultSetHeader>(
      "UPDATE messages SET read_at = ? WHERE id = ? AND company_id = ?",
      [now, id, companyId],
    );
    if (result.affectedRows === 0) {
      return null;
    }
    return now;
  },
};
