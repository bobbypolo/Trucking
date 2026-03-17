import { v4 as uuidv4 } from "uuid";
import pool from "../db";

export const quoteRepository = {
  async findByCompany(companyId: string, page = 1, limit = 50) {
    const offset = (page - 1) * limit;
    const [rows] = await pool.query(
      "SELECT * FROM quotes WHERE company_id = ? AND archived_at IS NULL ORDER BY created_at DESC LIMIT ? OFFSET ?",
      [companyId, limit, offset],
    );
    return rows as any[];
  },

  async findById(id: string) {
    const [rows] = await pool.query("SELECT * FROM quotes WHERE id = ?", [id]);
    return (rows as any[])[0] || null;
  },

  async create(data: any, companyId: string, userId: string) {
    const id = data.id || uuidv4();
    await pool.query(
      `INSERT INTO quotes (id, company_id, status, pickup_city, pickup_state, pickup_facility,
        dropoff_city, dropoff_state, dropoff_facility, equipment_type,
        linehaul, fuel_surcharge, total_rate, customer_id, broker_id,
        valid_until, notes, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        companyId,
        data.status || "Draft",
        data.pickup_city,
        data.pickup_state,
        data.pickup_facility,
        data.dropoff_city,
        data.dropoff_state,
        data.dropoff_facility,
        data.equipment_type,
        data.linehaul,
        data.fuel_surcharge,
        data.total_rate,
        data.customer_id,
        data.broker_id,
        data.valid_until,
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
      `UPDATE quotes SET ${fields.join(", ")} WHERE id = ?`,
      values,
    );
    return this.findById(id);
  },

  async archive(id: string, userId: string) {
    await pool.query(
      "UPDATE quotes SET archived_at = NOW(), updated_by = ? WHERE id = ?",
      [userId, id],
    );
  },
};
