import pool from "../db";
import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";

/**
 * Database row shape for the `equipment` table.
 */
export interface EquipmentRow extends RowDataPacket {
  id: string;
  company_id: string;
  unit_number: string;
  type: string;
  status: string;
  ownership_type: string | null;
  provider_name: string | null;
  daily_cost: number | null;
  maintenance_history: string | null;
  version: number;
  assigned_load_id: string | null;
}

/**
 * Equipment Repository — tenant-scoped data access for equipment.
 *
 * Every query uses parameterized statements and includes company_id
 * for tenant isolation. Equipment assignment uses optimistic locking
 * via the version column.
 */
export const equipmentRepository = {
  /**
   * Find equipment by ID, scoped to the given tenant.
   * Returns null if equipment does not exist or belongs to a different tenant.
   */
  async findById(id: string, companyId: string): Promise<EquipmentRow | null> {
    const [rows] = await pool.query<EquipmentRow[]>(
      "SELECT * FROM equipment WHERE id = ? AND company_id = ?",
      [id, companyId],
    );
    return rows.length > 0 ? rows[0] : null;
  },

  /**
   * Find all equipment belonging to a company. Tenant-scoped.
   */
  async findByCompany(companyId: string): Promise<EquipmentRow[]> {
    const [rows] = await pool.query<EquipmentRow[]>(
      "SELECT * FROM equipment WHERE company_id = ? ORDER BY unit_number ASC",
      [companyId],
    );
    return rows;
  },

  /**
   * Assign equipment to a load with optimistic locking.
   *
   * Uses version check in WHERE clause:
   *   UPDATE equipment SET assigned_load_id = ?, version = version + 1
   *   WHERE id = ? AND company_id = ? AND version = ?
   *
   * Returns null if 0 rows affected (version mismatch or wrong tenant).
   */
  async assignToLoad(
    equipmentId: string,
    loadId: string,
    companyId: string,
    expectedVersion: number,
  ): Promise<EquipmentRow | null> {
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE equipment
       SET assigned_load_id = ?, version = version + 1
       WHERE id = ? AND company_id = ? AND version = ?`,
      [loadId, equipmentId, companyId, expectedVersion],
    );

    if (result.affectedRows === 0) {
      return null;
    }

    return this.findById(equipmentId, companyId);
  },

  /**
   * Clear equipment assignment (unassign from load) with optimistic locking.
   *
   * Returns null if 0 rows affected (version mismatch or wrong tenant).
   */
  async unassignFromLoad(
    equipmentId: string,
    companyId: string,
    expectedVersion: number,
  ): Promise<EquipmentRow | null> {
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE equipment
       SET assigned_load_id = NULL, version = version + 1
       WHERE id = ? AND company_id = ? AND version = ?`,
      [equipmentId, companyId, expectedVersion],
    );

    if (result.affectedRows === 0) {
      return null;
    }

    return this.findById(equipmentId, companyId);
  },
};
