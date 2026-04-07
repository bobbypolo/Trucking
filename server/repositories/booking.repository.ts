import { v4 as uuidv4 } from "uuid";
import pool from "../db";
import type { RowDataPacket } from "mysql2/promise";
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

/**
 * Shape of the load payload created alongside a booking.
 * Contains only operational truth — no settlement or financial amounts.
 */
export interface BookingLoadInput {
  load_number: string;
  customer_id?: string | null;
  pickup_date?: string | null;
  delivery_date?: string | null;
  freight_type?: string | null;
  commodity?: string | null;
  weight?: number | null;
  carrier_rate?: number;
  pickup_city?: string | null;
  pickup_state?: string | null;
  pickup_facility?: string | null;
  dropoff_city?: string | null;
  dropoff_state?: string | null;
  dropoff_facility?: string | null;
}

export const bookingRepository = {
  async findByCompany(companyId: string, page = 1, limit = 50) {
    const offset = (page - 1) * limit;
    const [rows] = await pool.query(
      "SELECT * FROM bookings WHERE company_id = ? AND archived_at IS NULL ORDER BY created_at DESC LIMIT ? OFFSET ?",
      [companyId, limit, offset],
    );
    return rows as RowDataPacket[];
  },

  async findById(id: string) {
    const [rows] = await pool.query("SELECT * FROM bookings WHERE id = ?", [
      id,
    ]);
    return (rows as RowDataPacket[])[0] || null;
  },

  /**
   * Create a booking record (without auto-creating a load).
   * Used only when load creation is handled externally or not needed.
   */
  async create(data: Record<string, unknown>, companyId: string, userId: string) {
    const id = (data.id as string | undefined) || uuidv4();
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

  /**
   * Atomically create a booking AND its canonical operational load in a single
   * database transaction. If load creation fails, the booking is rolled back.
   *
   * The created load receives only operational truth (pickup/delivery legs,
   * customer, commodity, weight). Estimated rates from the quote are stored as
   * carrier_rate on the load for reference but driver_pay is always 0
   * (never auto-populated from quote estimates).
   *
   * @returns The created booking record with load_id populated.
   */
  async createWithLoad(
    data: Record<string, unknown>,
    loadInput: BookingLoadInput,
    companyId: string,
    userId: string,
  ) {
    const bookingId = (data.id as string | undefined) || uuidv4();
    const loadId = uuidv4();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // 1. Insert the canonical operational load
      await connection.query(
        `INSERT INTO loads (id, company_id, customer_id, driver_id, dispatcher_id,
                  load_number, status, carrier_rate, driver_pay, pickup_date,
                  freight_type, commodity, weight, container_number, chassis_number,
                  bol_number, notification_emails, contract_id, gps_history, pod_urls,
                  customer_user_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          loadId,
          companyId,
          loadInput.customer_id ?? data.customer_id ?? null,
          null, // driver_id — unassigned at booking time
          null, // dispatcher_id — unassigned at booking time
          loadInput.load_number,
          "draft", // canonical initial status
          loadInput.carrier_rate ?? 0,
          0, // driver_pay — NEVER auto-populated from quote estimates
          loadInput.pickup_date ?? data.pickup_date ?? null,
          loadInput.freight_type ?? null,
          loadInput.commodity ?? null,
          loadInput.weight ?? null,
          null, // container_number
          null, // chassis_number
          null, // bol_number
          JSON.stringify([]),
          null, // contract_id
          JSON.stringify([]),
          JSON.stringify([]),
          null, // customer_user_id
        ],
      );

      // 2. Insert pickup leg
      const pickupLegId = uuidv4();
      await connection.query(
        `INSERT INTO load_legs (id, load_id, type, facility_name, city, state, date,
                  appointment_time, completed, sequence_order, latitude, longitude)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          pickupLegId,
          loadId,
          "Pickup",
          loadInput.pickup_facility ?? null,
          loadInput.pickup_city ?? null,
          loadInput.pickup_state ?? null,
          loadInput.pickup_date ?? data.pickup_date ?? null,
          null,
          false,
          0,
          null,
          null,
        ],
      );

      // 3. Insert delivery leg
      const deliveryLegId = uuidv4();
      await connection.query(
        `INSERT INTO load_legs (id, load_id, type, facility_name, city, state, date,
                  appointment_time, completed, sequence_order, latitude, longitude)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          deliveryLegId,
          loadId,
          "Dropoff",
          loadInput.dropoff_facility ?? null,
          loadInput.dropoff_city ?? null,
          loadInput.dropoff_state ?? null,
          loadInput.delivery_date ?? data.delivery_date ?? null,
          null,
          false,
          1,
          null,
          null,
        ],
      );

      // 4. Insert booking with load_id already linked
      await connection.query(
        `INSERT INTO bookings (id, company_id, quote_id, customer_id, status,
          pickup_date, delivery_date, load_id, notes, created_by, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          bookingId,
          companyId,
          data.quote_id,
          data.customer_id,
          data.status || "Pending",
          data.pickup_date,
          data.delivery_date,
          loadId, // load_id populated atomically
          data.notes,
          userId,
          userId,
        ],
      );

      await connection.commit();

      // Return the created booking (with load_id populated)
      return this.findById(bookingId);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  async update(id: string, data: Record<string, unknown>, userId: string) {
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
