import { v4 as uuidv4 } from "uuid";
import pool from "../db";

export const crisisActionRepository = {
  async findByCompany(companyId: string, page = 1, limit = 50) {
    const offset = (page - 1) * limit;
    const [rows] = await pool.query(
      "SELECT * FROM crisis_actions WHERE company_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
      [companyId, limit, offset],
    );
    return rows as any[];
  },

  async findById(id: string) {
    const [rows] = await pool.query(
      "SELECT * FROM crisis_actions WHERE id = ?",
      [id],
    );
    return (rows as any[])[0] || null;
  },

  async create(data: any, companyId: string, userId: string) {
    const id = data.id || uuidv4();
    await pool.query(
      `INSERT INTO crisis_actions (id, company_id, type, status, incident_id,
        load_id, operator_id, location, timeline, description,
        created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        companyId,
        data.type,
        data.status,
        data.incident_id,
        data.load_id,
        data.operator_id,
        data.location ? JSON.stringify(data.location) : null,
        data.timeline ? JSON.stringify(data.timeline) : null,
        data.description,
        userId,
        userId,
      ],
    );
    return this.findById(id);
  },

  async update(id: string, data: any, userId: string) {
    const fields: string[] = [];
    const values: any[] = [];

    const jsonFields = ["location", "timeline"];

    for (const [key, value] of Object.entries(data)) {
      if (key !== "id" && key !== "company_id" && value !== undefined) {
        fields.push(`${key} = ?`);
        values.push(jsonFields.includes(key) ? JSON.stringify(value) : value);
      }
    }

    if (fields.length === 0) return this.findById(id);

    fields.push("updated_by = ?");
    values.push(userId);
    values.push(id);

    await pool.query(
      `UPDATE crisis_actions SET ${fields.join(", ")} WHERE id = ?`,
      values,
    );
    return this.findById(id);
  },
};
