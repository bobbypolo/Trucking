import { v4 as uuidv4 } from "uuid";
import pool from "../db";

export const taskRepository = {
  async findByCompany(companyId: string, page = 1, limit = 50) {
    const offset = (page - 1) * limit;
    const [rows] = await pool.query(
      "SELECT * FROM operational_tasks WHERE company_id = ? AND archived_at IS NULL ORDER BY created_at DESC LIMIT ? OFFSET ?",
      [companyId, limit, offset],
    );
    return rows as any[];
  },

  async findById(id: string) {
    const [rows] = await pool.query(
      "SELECT * FROM operational_tasks WHERE id = ?",
      [id],
    );
    return (rows as any[])[0] || null;
  },

  async create(data: any, companyId: string, userId: string) {
    const id = data.id || uuidv4();
    await pool.query(
      `INSERT INTO operational_tasks (id, company_id, type, title, description, status,
        priority, assignee_id, assigned_to, due_date, links,
        created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        companyId,
        data.type,
        data.title,
        data.description,
        data.status || "OPEN",
        data.priority || "MEDIUM",
        data.assignee_id,
        data.assigned_to,
        data.due_date,
        data.links ? JSON.stringify(data.links) : null,
        userId,
        userId,
      ],
    );
    return this.findById(id);
  },

  async update(id: string, data: any, userId: string) {
    const fields: string[] = [];
    const values: any[] = [];

    for (const [key, value] of Object.entries(data)) {
      if (key !== "id" && key !== "company_id" && value !== undefined) {
        fields.push(`${key} = ?`);
        values.push(key === "links" ? JSON.stringify(value) : value);
      }
    }

    if (fields.length === 0) return this.findById(id);

    fields.push("updated_by = ?");
    values.push(userId);
    values.push(id);

    await pool.query(
      `UPDATE operational_tasks SET ${fields.join(", ")} WHERE id = ?`,
      values,
    );
    return this.findById(id);
  },

  async archive(id: string, userId: string) {
    await pool.query(
      "UPDATE operational_tasks SET archived_at = NOW(), updated_by = ? WHERE id = ?",
      [userId, id],
    );
  },
};

export const workItemRepository = {
  async findByCompany(companyId: string, page = 1, limit = 50) {
    const offset = (page - 1) * limit;
    const [rows] = await pool.query(
      "SELECT * FROM work_items WHERE company_id = ? AND archived_at IS NULL ORDER BY created_at DESC LIMIT ? OFFSET ?",
      [companyId, limit, offset],
    );
    return rows as any[];
  },

  async findById(id: string) {
    const [rows] = await pool.query("SELECT * FROM work_items WHERE id = ?", [
      id,
    ]);
    return (rows as any[])[0] || null;
  },

  async create(data: any, companyId: string, userId: string) {
    const id = data.id || uuidv4();
    await pool.query(
      `INSERT INTO work_items (id, company_id, type, label, description, priority,
        status, sla_deadline, assignee_id, entity_type, entity_id,
        created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        companyId,
        data.type,
        data.label,
        data.description,
        data.priority,
        data.status,
        data.sla_deadline,
        data.assignee_id,
        data.entity_type,
        data.entity_id,
        userId,
        userId,
      ],
    );
    return this.findById(id);
  },

  async update(id: string, data: any, userId: string) {
    const fields: string[] = [];
    const values: any[] = [];

    for (const [key, value] of Object.entries(data)) {
      if (key !== "id" && key !== "company_id" && value !== undefined) {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (fields.length === 0) return this.findById(id);

    fields.push("updated_by = ?");
    values.push(userId);
    values.push(id);

    await pool.query(
      `UPDATE work_items SET ${fields.join(", ")} WHERE id = ?`,
      values,
    );
    return this.findById(id);
  },

  async archive(id: string, userId: string) {
    await pool.query(
      "UPDATE work_items SET archived_at = NOW(), updated_by = ? WHERE id = ?",
      [userId, id],
    );
  },
};
