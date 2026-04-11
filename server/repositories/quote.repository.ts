import { v4 as uuidv4 } from "uuid";
import pool from "../db";
import type { RowDataPacket } from "mysql2/promise";
import { buildSafeUpdate } from "../lib/safe-update";

export type QuoteInput = Record<string, unknown>;

const QUOTE_UPDATABLE_COLUMNS = [
  "status",
  "pickup_city",
  "pickup_state",
  "pickup_facility",
  "dropoff_city",
  "dropoff_state",
  "dropoff_facility",
  "equipment_type",
  "linehaul",
  "fuel_surcharge",
  "total_rate",
  "customer_id",
  "broker_id",
  "valid_until",
  "notes",
  "version",
  "margin",
  "discount",
  "commission",
  "estimated_driver_pay",
  "company_cost_factor",
] as const;

export const quoteRepository = {
  async findByCompany(companyId: string, page = 1, limit = 50) {
    const offset = (page - 1) * limit;
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT * FROM quotes WHERE company_id = ? AND archived_at IS NULL ORDER BY created_at DESC LIMIT ? OFFSET ?",
      [companyId, limit, offset],
    );
    return rows;
  },

  async findById(id: string) {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT * FROM quotes WHERE id = ?",
      [id],
    );
    return rows[0] || null;
  },

  async create(data: QuoteInput, companyId: string, userId: string) {
    const id = (data.id as string | undefined) || uuidv4();
    await pool.query(
      `INSERT INTO quotes (id, company_id, status, pickup_city, pickup_state, pickup_facility,
        dropoff_city, dropoff_state, dropoff_facility, equipment_type,
        linehaul, fuel_surcharge, total_rate, customer_id, broker_id,
        valid_until, notes, margin, discount, commission,
        estimated_driver_pay, company_cost_factor, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        data.margin,
        data.discount,
        data.commission,
        data.estimated_driver_pay,
        data.company_cost_factor,
        userId,
        userId,
      ],
    );
    return this.findById(id);
  },

  async update(id: string, data: QuoteInput, userId: string) {
    const result = buildSafeUpdate(
      data,
      QUOTE_UPDATABLE_COLUMNS,
      ["updated_by = ?"],
      [userId],
    );
    if (!result) return this.findById(id);

    await pool.query(`UPDATE quotes SET ${result.setClause} WHERE id = ?`, [
      ...result.values,
      id,
    ]);
    return this.findById(id);
  },

  async archive(id: string, userId: string) {
    await pool.query(
      "UPDATE quotes SET archived_at = NOW(), updated_by = ? WHERE id = ?",
      [userId, id],
    );
  },
};
