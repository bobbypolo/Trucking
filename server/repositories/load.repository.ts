import { v4 as uuidv4 } from "uuid";
import pool from "../db";
import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";

/**
 * Database row shape for the `loads` table.
 */
export interface LoadRow extends RowDataPacket {
  id: string;
  company_id: string;
  customer_id: string | null;
  driver_id: string | null;
  dispatcher_id: string | null;
  load_number: string;
  status: string;
  carrier_rate: number;
  driver_pay: number;
  pickup_date: string | null;
  freight_type: string | null;
  commodity: string | null;
  weight: number | null;
  container_number: string | null;
  container_size: string | null;
  chassis_number: string | null;
  chassis_provider: string | null;
  bol_number: string | null;
  notification_emails: string | null;
  contract_id: string | null;
  gps_history: string | null;
  pod_urls: string | null;
  customer_user_id: string | null;
  created_at: string;
}

/**
 * Input shape for creating a load (subset of LoadRow, id auto-generated).
 */
export interface CreateLoadInput {
  company_id?: string;
  customer_id?: string | null;
  driver_id?: string | null;
  dispatcher_id?: string | null;
  load_number: string;
  status: string;
  carrier_rate?: number;
  driver_pay?: number;
  pickup_date?: string | null;
  freight_type?: string | null;
  commodity?: string | null;
  weight?: number | null;
  container_number?: string | null;
  chassis_number?: string | null;
  bol_number?: string | null;
  notification_emails?: string[];
  contract_id?: string | null;
  gps_history?: unknown[];
  pod_urls?: string[];
  customer_user_id?: string | null;
}

/**
 * Input shape for creating a stop (load_leg).
 */
export interface CreateStopInput {
  id?: string;
  type: "Pickup" | "Dropoff" | "Fuel" | "Rest";
  facility_name?: string | null;
  city?: string | null;
  state?: string | null;
  date?: string | null;
  appointment_time?: string | null;
  completed?: boolean;
  latitude?: number | null;
  longitude?: number | null;
}

/**
 * Load Repository — tenant-scoped data access for loads and their stops.
 *
 * Every query uses parameterized statements and includes company_id
 * for tenant isolation.
 */
export const loadRepository = {
  /**
   * Find all loads belonging to a company. Tenant-scoped.
   */
  async findByCompany(companyId: string): Promise<LoadRow[]> {
    const [rows] = await pool.query<LoadRow[]>(
      "SELECT * FROM loads WHERE company_id = ? ORDER BY created_at DESC",
      [companyId],
    );
    return rows;
  },

  /**
   * Find a single load by ID, scoped to the given tenant.
   * Returns null if the load does not exist or belongs to a different tenant.
   */
  async findById(id: string, companyId: string): Promise<LoadRow | null> {
    const [rows] = await pool.query<LoadRow[]>(
      "SELECT * FROM loads WHERE id = ? AND company_id = ?",
      [id, companyId],
    );
    return rows.length > 0 ? rows[0] : null;
  },

  /**
   * Atomically create a load and its stops within a single transaction.
   * All queries use parameterized statements.
   */
  async create(
    input: CreateLoadInput,
    stops: CreateStopInput[],
    companyId: string,
  ): Promise<LoadRow> {
    const loadId = uuidv4();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // Insert load
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
          input.customer_id ?? null,
          input.driver_id ?? null,
          input.dispatcher_id ?? null,
          input.load_number,
          input.status,
          input.carrier_rate ?? 0,
          input.driver_pay ?? 0,
          input.pickup_date ?? null,
          input.freight_type ?? null,
          input.commodity ?? null,
          input.weight ?? null,
          input.container_number ?? null,
          input.chassis_number ?? null,
          input.bol_number ?? null,
          JSON.stringify(input.notification_emails ?? []),
          input.contract_id ?? null,
          JSON.stringify(input.gps_history ?? []),
          JSON.stringify(input.pod_urls ?? []),
          input.customer_user_id ?? null,
        ],
      );

      // Insert stops
      for (let i = 0; i < stops.length; i++) {
        const stop = stops[i];
        const stopId = stop.id ?? uuidv4();
        await connection.query(
          `INSERT INTO load_legs (id, load_id, type, facility_name, city, state, date, appointment_time, completed, sequence_order, latitude, longitude)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            stopId,
            loadId,
            stop.type,
            stop.facility_name ?? null,
            stop.city ?? null,
            stop.state ?? null,
            stop.date ?? null,
            stop.appointment_time ?? null,
            stop.completed ?? false,
            i,
            stop.latitude ?? null,
            stop.longitude ?? null,
          ],
        );
      }

      await connection.commit();

      // Return the created load
      return {
        id: loadId,
        company_id: companyId,
        customer_id: input.customer_id ?? null,
        driver_id: input.driver_id ?? null,
        dispatcher_id: input.dispatcher_id ?? null,
        load_number: input.load_number,
        status: input.status,
        carrier_rate: input.carrier_rate ?? 0,
        driver_pay: input.driver_pay ?? 0,
        pickup_date: input.pickup_date ?? null,
        freight_type: input.freight_type ?? null,
        commodity: input.commodity ?? null,
        weight: input.weight ?? null,
        container_number: input.container_number ?? null,
        container_size: null,
        chassis_number: input.chassis_number ?? null,
        chassis_provider: null,
        bol_number: input.bol_number ?? null,
        notification_emails: JSON.stringify(input.notification_emails ?? []),
        contract_id: input.contract_id ?? null,
        gps_history: JSON.stringify(input.gps_history ?? []),
        pod_urls: JSON.stringify(input.pod_urls ?? []),
        customer_user_id: input.customer_user_id ?? null,
        created_at: new Date().toISOString(),
      } as LoadRow;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  /**
   * Update a load's fields, scoped to the given tenant.
   * Returns null if the load does not exist or belongs to a different tenant.
   */
  async update(
    id: string,
    data: Record<string, unknown>,
    companyId: string,
  ): Promise<LoadRow | null> {
    // Build SET clause dynamically from provided fields
    const allowedFields = [
      "customer_id",
      "driver_id",
      "dispatcher_id",
      "load_number",
      "status",
      "carrier_rate",
      "driver_pay",
      "pickup_date",
      "freight_type",
      "commodity",
      "weight",
      "container_number",
      "container_size",
      "chassis_number",
      "chassis_provider",
      "bol_number",
      "notification_emails",
      "contract_id",
      "gps_history",
      "pod_urls",
      "customer_user_id",
    ];

    const setClauses: string[] = [];
    const values: unknown[] = [];

    for (const field of allowedFields) {
      if (field in data) {
        setClauses.push(`${field} = ?`);
        const val = data[field];
        // JSON-serialize array/object values
        if (Array.isArray(val) || (val !== null && typeof val === "object")) {
          values.push(JSON.stringify(val));
        } else {
          values.push(val);
        }
      }
    }

    if (setClauses.length === 0) {
      return this.findById(id, companyId);
    }

    // Always scope by id AND company_id
    values.push(id, companyId);

    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE loads SET ${setClauses.join(", ")} WHERE id = ? AND company_id = ?`,
      values,
    );

    if (result.affectedRows === 0) {
      return null;
    }

    return this.findById(id, companyId);
  },
};
