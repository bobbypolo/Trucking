import { v4 as uuidv4 } from "uuid";
import pool from "../db";
import type { RowDataPacket } from "mysql2/promise";
import { buildSafeUpdate } from "../lib/safe-update";

const LEAD_UPDATABLE_COLUMNS = [
  "status",
  "source",
  "contact_name",
  "contact_email",
  "contact_phone",
  "company_name",
  "notes",
  "estimated_value",
  "lane",
  "equipment_needed",
] as const;

export const leadRepository = {
  async findByCompany(companyId: string, page = 1, limit = 50) {
    const offset = (page - 1) * limit;
    const [rows] = await pool.query(
      "SELECT * FROM leads WHERE company_id = ? AND archived_at IS NULL ORDER BY created_at DESC LIMIT ? OFFSET ?",
      [companyId, limit, offset],
    );
    return rows as RowDataPacket[];
  },

  async findById(id: string) {
    const [rows] = await pool.query("SELECT * FROM leads WHERE id = ?", [id]);
    return (rows as RowDataPacket[])[0] || null;
  },

  async create(data: Record<string, unknown>, companyId: string, userId: string) {
    const id = data.id || uuidv4();
    await pool.query(
      `INSERT INTO leads (id, company_id, status, source, contact_name, contact_email,
        contact_phone, company_name, notes, estimated_value, lane, equipment_needed,
        created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        companyId,
        data.status || "New",
        data.source,
        data.contact_name,
        data.contact_email,
        data.contact_phone,
        data.company_name,
        data.notes,
        data.estimated_value,
        data.lane,
        data.equipment_needed,
        userId,
        userId,
      ],
    );
    return this.findById(id);
  },

  async update(id: string, data: Record<string, unknown>, userId: string) {
    const result = buildSafeUpdate(
      data,
      LEAD_UPDATABLE_COLUMNS,
      ["updated_by = ?"],
      [userId],
    );
    if (!result) return this.findById(id);

    await pool.query(`UPDATE leads SET ${result.setClause} WHERE id = ?`, [
      ...result.values,
      id,
    ]);
    return this.findById(id);
  },

  async hardDelete(id: string) {
    await pool.query("DELETE FROM leads WHERE id = ?", [id]);
  },

  async archive(id: string, userId: string) {
    await pool.query(
      "UPDATE leads SET archived_at = NOW(), updated_by = ? WHERE id = ?",
      [userId, id],
    );
  },
};
