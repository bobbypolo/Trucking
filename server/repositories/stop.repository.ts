import pool from "../db";
import type { RowDataPacket } from "mysql2/promise";

/**
 * Database row shape for the `load_legs` (stops) table.
 */
export interface StopRow extends RowDataPacket {
  id: string;
  load_id: string;
  type: "Pickup" | "Dropoff" | "Fuel" | "Rest";
  facility_name: string | null;
  city: string | null;
  state: string | null;
  date: string | null;
  appointment_time: string | null;
  completed: boolean;
  sequence_order: number;
  latitude: number | null;
  longitude: number | null;
}

/**
 * Stop Repository — tenant-scoped data access for load stops (load_legs).
 *
 * Tenant isolation is enforced by joining against the loads table
 * to verify company_id ownership. All queries use parameterized statements.
 */
export const stopRepository = {
  /**
   * Find all stops for a load, scoped to the given tenant.
   * Uses a JOIN to verify load ownership by company_id.
   * Returns stops ordered by sequence_order.
   */
  async findByLoadId(loadId: string, companyId: string): Promise<StopRow[]> {
    const [rows] = await pool.query<StopRow[]>(
      `SELECT ll.* FROM load_legs ll
            INNER JOIN loads l ON ll.load_id = l.id
            WHERE ll.load_id = ? AND l.company_id = ?
            ORDER BY ll.sequence_order ASC`,
      [loadId, companyId],
    );
    return rows;
  },

  /**
   * Delete all stops for a load, scoped to the given tenant.
   * Uses a subquery to verify load ownership by company_id.
   */
  async deleteByLoadId(loadId: string, companyId: string): Promise<void> {
    await pool.query(
      `DELETE ll FROM load_legs ll
            INNER JOIN loads l ON ll.load_id = l.id
            WHERE ll.load_id = ? AND l.company_id = ?`,
      [loadId, companyId],
    );
  },
};
