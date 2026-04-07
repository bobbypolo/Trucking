import { v4 as uuidv4 } from "uuid";
import pool from "../db";
import type { RowDataPacket } from "mysql2/promise";
import { buildSafeUpdate } from "../lib/safe-update";

const CONTACT_UPDATABLE_COLUMNS = [
  "name",
  "email",
  "phone",
  "title",
  "type",
  "organization",
  "preferred_channel",
  "normalized_phone",
  "notes",
] as const;

export const contactRepository = {
  async findByCompany(companyId: string, page = 1, limit = 50) {
    const offset = (page - 1) * limit;
    const [rows] = await pool.query(
      "SELECT * FROM contacts WHERE company_id = ? AND archived_at IS NULL ORDER BY created_at DESC LIMIT ? OFFSET ?",
      [companyId, limit, offset],
    );
    return rows as RowDataPacket[];
  },

  async findById(id: string) {
    const [rows] = await pool.query("SELECT * FROM contacts WHERE id = ?", [
      id,
    ]);
    return (rows as RowDataPacket[])[0] || null;
  },

  async create(data: Record<string, unknown>, companyId: string, userId: string) {
    const id = (data.id as string | undefined) || uuidv4();
    await pool.query(
      `INSERT INTO contacts (id, company_id, name, email, phone, title, type,
        organization, preferred_channel, normalized_phone, notes,
        created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        companyId,
        data.name,
        data.email,
        data.phone,
        data.title,
        data.type,
        data.organization,
        data.preferred_channel,
        data.normalized_phone,
        data.notes,
        userId,
        userId,
      ],
    );
    return this.findById(id);
  },

  async update(id: string, data: Record<string, unknown>, userId: string) {
    const result = buildSafeUpdate(
      data,
      CONTACT_UPDATABLE_COLUMNS,
      ["updated_by = ?"],
      [userId],
    );
    if (!result) return this.findById(id);

    await pool.query(`UPDATE contacts SET ${result.setClause} WHERE id = ?`, [
      ...result.values,
      id,
    ]);
    return this.findById(id);
  },

  async archive(id: string, userId: string) {
    await pool.query(
      "UPDATE contacts SET archived_at = NOW(), updated_by = ? WHERE id = ?",
      [userId, id],
    );
  },
};
