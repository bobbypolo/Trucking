import { v4 as uuidv4 } from "uuid";
import pool from "../db";
import type {
  RowDataPacket,
  ResultSetHeader,
  PoolConnection,
} from "mysql2/promise";
import { DocumentStatus } from "../services/document-state-machine";

/**
 * Database row shape for the `documents` table.
 */
export interface DocumentRow extends RowDataPacket {
  id: string;
  company_id: string;
  load_id: string | null;
  original_filename: string;
  sanitized_filename: string;
  mime_type: string;
  file_size_bytes: number;
  storage_path: string;
  document_type: string;
  status: string;
  description: string | null;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
  filename?: string;
  type?: string;
}

/**
 * Input shape for creating a document metadata record.
 */
export interface CreateDocumentInput {
  id?: string;
  company_id: string;
  load_id?: string | null;
  original_filename: string;
  sanitized_filename: string;
  mime_type: string;
  file_size_bytes: number;
  storage_path: string;
  document_type: string;
  status: string;
  description?: string | null;
  uploaded_by?: string | null;
}

/**
 * Document Repository — tenant-scoped data access for document metadata in MySQL.
 *
 * Every query uses parameterized statements and includes company_id
 * for tenant isolation.
 */
export const documentRepository = {
  /**
   * Create a document metadata row. Can use an existing connection for
   * transactional operations.
   */
  async create(
    input: CreateDocumentInput,
    connection?: PoolConnection,
  ): Promise<DocumentRow> {
    const conn = connection || pool;
    const docId = input.id || uuidv4();

    await conn.query(
      `INSERT INTO documents (id, company_id, load_id, original_filename, sanitized_filename,
         mime_type, file_size_bytes, storage_path, document_type, status, description, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        docId,
        input.company_id,
        input.load_id ?? null,
        input.original_filename,
        input.sanitized_filename,
        input.mime_type,
        input.file_size_bytes,
        input.storage_path,
        input.document_type,
        input.status,
        input.description ?? null,
        input.uploaded_by ?? null,
      ],
    );

    return {
      id: docId,
      company_id: input.company_id,
      load_id: input.load_id ?? null,
      original_filename: input.original_filename,
      sanitized_filename: input.sanitized_filename,
      mime_type: input.mime_type,
      file_size_bytes: input.file_size_bytes,
      storage_path: input.storage_path,
      document_type: input.document_type,
      status: input.status,
      description: input.description ?? null,
      uploaded_by: input.uploaded_by ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as DocumentRow;
  },

  /**
   * Find a document by ID, scoped to the given tenant.
   * Returns null if not found or belongs to a different tenant.
   */
  async findById(id: string, companyId: string): Promise<DocumentRow | null> {
    const [rows] = await pool.query<DocumentRow[]>(
      "SELECT * FROM documents WHERE id = ? AND company_id = ?",
      [id, companyId],
    );
    if (rows.length === 0) return null;
    rows[0].filename = rows[0].original_filename; // R-P2-12
    rows[0].type = rows[0].document_type; // R-P2-12
    return rows[0];
  },

  /**
   * Find all documents belonging to a company.
   * Supports all attachment-key filters for filtered views.
   */
  async findByCompany(
    companyId: string,
    filters?: {
      load_id?: string;
      driver_id?: string;
      truck_id?: string;
      trailer_id?: string;
      vendor_id?: string;
      customer_id?: string;
      status?: string;
      document_type?: string;
      search?: string;
    },
  ): Promise<DocumentRow[]> {
    let sql = "SELECT * FROM documents WHERE company_id = ?";
    const params: unknown[] = [companyId];

    if (filters?.load_id) {
      sql += " AND load_id = ?";
      params.push(filters.load_id);
    }
    if (filters?.driver_id) {
      sql += " AND driver_id = ?";
      params.push(filters.driver_id);
    }
    if (filters?.truck_id) {
      sql += " AND truck_id = ?";
      params.push(filters.truck_id);
    }
    if (filters?.trailer_id) {
      sql += " AND trailer_id = ?";
      params.push(filters.trailer_id);
    }
    if (filters?.vendor_id) {
      sql += " AND vendor_id = ?";
      params.push(filters.vendor_id);
    }
    if (filters?.customer_id) {
      sql += " AND customer_id = ?";
      params.push(filters.customer_id);
    }
    if (filters?.status) {
      sql += " AND status = ?";
      params.push(filters.status);
    }
    if (filters?.document_type) {
      sql += " AND document_type = ?";
      params.push(filters.document_type);
    }
    if (filters?.search) {
      sql += " AND (original_filename LIKE ? OR sanitized_filename LIKE ?)";
      const searchPattern = `%${filters.search}%`;
      params.push(searchPattern, searchPattern);
    }

    sql += " ORDER BY created_at DESC";

    const [rows] = await pool.query<DocumentRow[]>(sql, params);
    for (const r of rows) {
      r.filename = r.original_filename;
      r.type = r.document_type;
    } // R-P2-12
    return rows;
  },

  /**
   * Update a document's status and/or lock state.
   * Used by PATCH /api/documents/:id for status/lock management.
   */
  async updateStatusAndLock(
    id: string,
    companyId: string,
    updates: { status?: string; is_locked?: boolean },
  ): Promise<DocumentRow | null> {
    const setClauses: string[] = [];
    const params: unknown[] = [];

    if (updates.status !== undefined) {
      setClauses.push("status = ?");
      params.push(updates.status);
    }
    if (updates.is_locked !== undefined) {
      setClauses.push("is_locked = ?");
      params.push(updates.is_locked ? 1 : 0);
    }

    if (setClauses.length === 0) {
      return this.findById(id, companyId);
    }

    setClauses.push("updated_at = NOW()");
    params.push(id, companyId);

    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE documents SET ${setClauses.join(", ")} WHERE id = ? AND company_id = ?`,
      params,
    );

    if (result.affectedRows === 0) {
      return null;
    }

    return this.findById(id, companyId);
  },

  /**
   * Update a document's status, scoped to the given tenant.
   * Returns null if the document does not exist or belongs to a different tenant.
   */
  async updateStatus(
    id: string,
    status: DocumentStatus,
    companyId: string,
    connection?: PoolConnection,
  ): Promise<DocumentRow | null> {
    const conn = connection || pool;
    const [result] = await conn.query<ResultSetHeader>(
      "UPDATE documents SET status = ?, updated_at = NOW() WHERE id = ? AND company_id = ?",
      [status, id, companyId],
    );

    if (result.affectedRows === 0) {
      return null;
    }

    // If using pool (not transaction connection), fetch updated row
    if (!connection) {
      return this.findById(id, companyId);
    }

    // For transaction connections, return a synthetic row
    return { id, status, company_id: companyId } as unknown as DocumentRow;
  },

  /**
   * Delete a document metadata row. Used in compensating cleanup.
   */
  async deleteById(id: string, companyId: string): Promise<boolean> {
    const [result] = await pool.query<ResultSetHeader>(
      "DELETE FROM documents WHERE id = ? AND company_id = ?",
      [id, companyId],
    );
    return result.affectedRows > 0;
  },
};
