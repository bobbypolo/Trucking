import { v4 as uuidv4 } from "uuid";
import pool from "../db";
import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";

/**
 * Database row shape for the `work_items` table.
 */
export interface WorkItemRow extends RowDataPacket {
  id: string;
  company_id: string;
  type: string;
  priority: string;
  label: string;
  description: string | null;
  entity_id: string | null;
  entity_type: string | null;
  status: string;
  due_date: string | null;
  created_at: string;
}

/**
 * Input shape for creating a work item.
 */
export interface CreateWorkItemInput {
  type: string;
  priority?: string;
  label: string;
  description?: string | null;
  entity_id?: string | null;
  entity_type?: string | null;
  status?: string;
  due_date?: string | null;
}

/**
 * Work Item Repository — tenant-scoped data access for the work_items table.
 *
 * Every query uses parameterized statements and includes company_id
 * for tenant isolation.
 */
export const workItemRepository = {
  /**
   * Find all work items for a company. Tenant-scoped.
   */
  async findByCompany(companyId: string): Promise<WorkItemRow[]> {
    const [rows] = await pool.query<WorkItemRow[]>(
      "SELECT * FROM work_items WHERE company_id = ? ORDER BY created_at DESC",
      [companyId],
    );
    return rows;
  },

  /**
   * Find a single work item by ID, scoped to the given tenant.
   * Returns null if not found or belongs to a different tenant.
   */
  async findById(id: string, companyId: string): Promise<WorkItemRow | null> {
    const [rows] = await pool.query<WorkItemRow[]>(
      "SELECT * FROM work_items WHERE id = ? AND company_id = ?",
      [id, companyId],
    );
    return rows.length > 0 ? rows[0] : null;
  },

  /**
   * Create a new work item scoped to the given tenant.
   */
  async create(
    input: CreateWorkItemInput,
    companyId: string,
  ): Promise<WorkItemRow> {
    const id = uuidv4();
    await pool.query<ResultSetHeader>(
      `INSERT INTO work_items
        (id, company_id, type, priority, label, description,
         entity_id, entity_type, status, due_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        companyId,
        input.type,
        input.priority ?? "Medium",
        input.label,
        input.description ?? null,
        input.entity_id ?? null,
        input.entity_type ?? null,
        input.status ?? "Open",
        input.due_date ?? null,
      ],
    );
    return (await this.findById(id, companyId)) as WorkItemRow;
  },

  /**
   * Update a work item scoped to the given tenant.
   * Returns null if not found or wrong tenant.
   */
  async update(
    id: string,
    data: Partial<Omit<WorkItemRow, "id" | "company_id" | "created_at">>,
    companyId: string,
  ): Promise<WorkItemRow | null> {
    const allowedFields = [
      "type",
      "priority",
      "label",
      "description",
      "entity_id",
      "entity_type",
      "status",
      "due_date",
    ];

    const setClauses: string[] = [];
    const values: unknown[] = [];

    for (const field of allowedFields) {
      if (field in data) {
        setClauses.push(`${field} = ?`);
        values.push((data as Record<string, unknown>)[field] ?? null);
      }
    }

    if (setClauses.length === 0) {
      return this.findById(id, companyId);
    }

    values.push(id, companyId);
    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE work_items SET ${setClauses.join(", ")} WHERE id = ? AND company_id = ?`,
      values,
    );

    if (result.affectedRows === 0) {
      return null;
    }

    return this.findById(id, companyId);
  },

  /**
   * Delete a work item scoped to the given tenant.
   * Returns true if deleted, false if not found.
   */
  async delete(id: string, companyId: string): Promise<boolean> {
    const [result] = await pool.query<ResultSetHeader>(
      "DELETE FROM work_items WHERE id = ? AND company_id = ?",
      [id, companyId],
    );
    return result.affectedRows > 0;
  },
};
