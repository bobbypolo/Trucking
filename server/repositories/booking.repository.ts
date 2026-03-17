import { v4 as uuidv4 } from "uuid";
import pool from "../db";
import { buildSafeUpdate } from "../lib/safe-update";

const BOOKING_UPDATABLE_COLUMNS = [
  "quote_id",
  "customer_id",
  "status",
  "pickup_date",
  "delivery_date",
  "load_id",
  "notes",
] as const;

export const bookingRepository = {
  async findByCompany(companyId: string, page = 1, limit = 50) {
    const offset = (page - 1) * limit;
    const [rows] = await pool.query(
      "SELECT * FROM bookings WHERE company_id = ? AND archived_at IS NULL ORDER BY created_at DESC LIMIT ? OFFSET ?",
      [companyId, limit, offset],
    );
    return rows as any[];
  },

  async findById(id: string) {
    const [rows] = await pool.query("SELECT * FROM bookings WHERE id = ?", [
      id,
    ]);
    return (rows as any[])[0] || null;
  },

  async create(data: any, companyId: string, userId: string) {
    const id = data.id || uuidv4();
    await pool.query(
      `INSERT INTO bookings (id, company_id, quote_id, customer_id, status,
        pickup_date, delivery_date, load_id, notes, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        companyId,
        data.quote_id,
        data.customer_id,
        data.status || "Pending",
        data.pickup_date,
        data.delivery_date,
        data.load_id,
        data.notes,
        userId,
        userId,
      ],
    );
    return this.findById(id);
  },

  async update(id: string, data: any, userId: string) {
    const result = buildSafeUpdate(
      data,
      BOOKING_UPDATABLE_COLUMNS,
      ["updated_by = ?"],
      [userId],
    );
    if (!result) return this.findById(id);

    await pool.query(`UPDATE bookings SET ${result.setClause} WHERE id = ?`, [
      ...result.values,
      id,
    ]);
    return this.findById(id);
  },

  async archive(id: string, userId: string) {
    await pool.query(
      "UPDATE bookings SET archived_at = NOW(), updated_by = ? WHERE id = ?",
      [userId, id],
    );
  },
};
