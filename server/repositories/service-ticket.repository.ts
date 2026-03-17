import { v4 as uuidv4 } from "uuid";
import pool from "../db";
import { buildSafeUpdate } from "../lib/safe-update";

const SERVICE_TICKET_UPDATABLE_COLUMNS = [
  "type",
  "status",
  "vendor",
  "cost",
  "equipment_id",
  "description",
] as const;

export const serviceTicketRepository = {
  async findByCompany(companyId: string, page = 1, limit = 50) {
    const offset = (page - 1) * limit;
    const [rows] = await pool.query(
      "SELECT * FROM service_tickets WHERE company_id = ? AND archived_at IS NULL ORDER BY created_at DESC LIMIT ? OFFSET ?",
      [companyId, limit, offset],
    );
    return rows as any[];
  },

  async findById(id: string) {
    const [rows] = await pool.query(
      "SELECT * FROM service_tickets WHERE id = ?",
      [id],
    );
    return (rows as any[])[0] || null;
  },

  async create(data: any, companyId: string, userId: string) {
    const id = data.id || uuidv4();
    await pool.query(
      `INSERT INTO service_tickets (id, company_id, type, status, vendor,
        cost, equipment_id, description, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        companyId,
        data.type,
        data.status,
        data.vendor,
        data.cost,
        data.equipment_id,
        data.description,
        userId,
        userId,
      ],
    );
    return this.findById(id);
  },

  async update(id: string, data: any, userId: string) {
    const result = buildSafeUpdate(
      data,
      SERVICE_TICKET_UPDATABLE_COLUMNS,
      ["updated_by = ?"],
      [userId],
    );
    if (!result) return this.findById(id);

    await pool.query(
      `UPDATE service_tickets SET ${result.setClause} WHERE id = ?`,
      [...result.values, id],
    );
    return this.findById(id);
  },

  async archive(id: string, userId: string) {
    await pool.query(
      "UPDATE service_tickets SET archived_at = NOW(), updated_by = ? WHERE id = ?",
      [userId, id],
    );
  },
};
