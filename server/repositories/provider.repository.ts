import { v4 as uuidv4 } from "uuid";
import pool from "../db";

export const providerRepository = {
  async findByCompany(companyId: string, page = 1, limit = 50) {
    const offset = (page - 1) * limit;
    const [rows] = await pool.query(
      "SELECT * FROM providers WHERE company_id = ? AND archived_at IS NULL ORDER BY created_at DESC LIMIT ? OFFSET ?",
      [companyId, limit, offset],
    );
    return rows as any[];
  },

  async findById(id: string) {
    const [rows] = await pool.query("SELECT * FROM providers WHERE id = ?", [
      id,
    ]);
    return (rows as any[])[0] || null;
  },

  async create(data: any, companyId: string, userId: string) {
    const id = data.id || uuidv4();
    await pool.query(
      `INSERT INTO providers (id, company_id, name, type, status, phone, email,
        coverage, capabilities, contacts, after_hours_contacts, is_247, notes,
        created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        companyId,
        data.name,
        data.type,
        data.status,
        data.phone,
        data.email,
        data.coverage ? JSON.stringify(data.coverage) : null,
        data.capabilities ? JSON.stringify(data.capabilities) : null,
        data.contacts ? JSON.stringify(data.contacts) : null,
        data.after_hours_contacts
          ? JSON.stringify(data.after_hours_contacts)
          : null,
        data.is_247 ?? null,
        data.notes,
        userId,
        userId,
      ],
    );
    return this.findById(id);
  },

  async update(id: string, data: any, userId: string) {
    const fields: string[] = [];
    const values: any[] = [];

    const jsonFields = [
      "coverage",
      "capabilities",
      "contacts",
      "after_hours_contacts",
    ];

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
      `UPDATE providers SET ${fields.join(", ")} WHERE id = ?`,
      values,
    );
    return this.findById(id);
  },

  async archive(id: string, userId: string) {
    await pool.query(
      "UPDATE providers SET archived_at = NOW(), updated_by = ? WHERE id = ?",
      [userId, id],
    );
  },
};
