import pool from "../db";
import type { RowDataPacket } from "mysql2/promise";

/**
 * Database row shape for a driver (from the `users` table where role is driver-like).
 */
export interface DriverRow extends RowDataPacket {
  id: string;
  company_id: string;
  email: string;
  name: string;
  role: string;
  compliance_status: string;
  version: number;
}

/**
 * Driver Repository — tenant-scoped data access for drivers.
 *
 * Drivers are stored in the `users` table. Every query uses parameterized
 * statements and includes company_id for tenant isolation.
 */
export const driverRepository = {
  /**
   * Find a driver by ID, scoped to the given tenant.
   * Returns null if the driver does not exist or belongs to a different tenant.
   */
  async findById(id: string, companyId: string): Promise<DriverRow | null> {
    const [rows] = await pool.query<DriverRow[]>(
      "SELECT * FROM users WHERE id = ? AND company_id = ?",
      [id, companyId],
    );
    return rows.length > 0 ? rows[0] : null;
  },

  /**
   * Find all drivers belonging to a company. Tenant-scoped.
   */
  async findByCompany(companyId: string): Promise<DriverRow[]> {
    const [rows] = await pool.query<DriverRow[]>(
      `SELECT * FROM users WHERE company_id = ? AND role IN ('driver', 'owner_operator')
       ORDER BY name ASC`,
      [companyId],
    );
    return rows;
  },
};
