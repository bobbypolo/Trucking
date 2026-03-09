import { v4 as uuidv4 } from "uuid";
import pool from "../db";
import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";

/**
 * Database row shape for the `incidents` table.
 */
export interface IncidentRow extends RowDataPacket {
  id: string;
  company_id: string;
  load_id: string;
  type: string;
  severity: string;
  status: string;
  reported_at: string;
  sla_deadline: string | null;
  description: string | null;
  location_lat: number | null;
  location_lng: number | null;
  recovery_plan: string | null;
}

/**
 * Input shape for creating an incident.
 */
export interface CreateIncidentInput {
  load_id: string;
  type: string;
  severity?: string;
  status?: string;
  sla_deadline?: string | null;
  description?: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
  recovery_plan?: string | null;
}

/**
 * Incident Repository — tenant-scoped data access for the incidents table.
 *
 * Every query uses parameterized statements and includes company_id
 * for tenant isolation.
 */
export const incidentRepository = {
  /**
   * Find all incidents for a company. Tenant-scoped.
   */
  async findByCompany(companyId: string): Promise<IncidentRow[]> {
    const [rows] = await pool.query<IncidentRow[]>(
      "SELECT * FROM incidents WHERE company_id = ? ORDER BY reported_at DESC",
      [companyId],
    );
    return rows;
  },

  /**
   * Find a single incident by ID, scoped to the given tenant.
   * Returns null if not found or belongs to a different tenant.
   */
  async findById(id: string, companyId: string): Promise<IncidentRow | null> {
    const [rows] = await pool.query<IncidentRow[]>(
      "SELECT * FROM incidents WHERE id = ? AND company_id = ?",
      [id, companyId],
    );
    return rows.length > 0 ? rows[0] : null;
  },

  /**
   * Create a new incident scoped to the given tenant.
   */
  async create(
    input: CreateIncidentInput,
    companyId: string,
  ): Promise<IncidentRow> {
    const id = uuidv4();
    await pool.query<ResultSetHeader>(
      `INSERT INTO incidents
        (id, company_id, load_id, type, severity, status, sla_deadline,
         description, location_lat, location_lng, recovery_plan)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        companyId,
        input.load_id,
        input.type,
        input.severity ?? "Medium",
        input.status ?? "Open",
        input.sla_deadline ?? null,
        input.description ?? null,
        input.location_lat ?? null,
        input.location_lng ?? null,
        input.recovery_plan ?? null,
      ],
    );
    return (await this.findById(id, companyId)) as IncidentRow;
  },

  /**
   * Update an incident scoped to the given tenant.
   * Returns null if not found or wrong tenant.
   */
  async update(
    id: string,
    data: Partial<Omit<IncidentRow, "id" | "company_id">>,
    companyId: string,
  ): Promise<IncidentRow | null> {
    const allowedFields = [
      "type",
      "severity",
      "status",
      "sla_deadline",
      "description",
      "location_lat",
      "location_lng",
      "recovery_plan",
    ];

    const setClauses: string[] = [];
    const values: unknown[] = [];

    for (const field of allowedFields) {
      if (field in data) {
        setClauses.push(`${field} = ?`);
        values.push((data as Record<string, unknown>)[field] ?? null);
      }
    }

    if (setClauses.length === 0) {
      return this.findById(id, companyId);
    }

    values.push(id, companyId);
    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE incidents SET ${setClauses.join(", ")} WHERE id = ? AND company_id = ?`,
      values,
    );

    if (result.affectedRows === 0) {
      return null;
    }

    return this.findById(id, companyId);
  },

  /**
   * Delete an incident scoped to the given tenant.
   * Returns true if deleted, false if not found.
   */
  async delete(id: string, companyId: string): Promise<boolean> {
    const [result] = await pool.query<ResultSetHeader>(
      "DELETE FROM incidents WHERE id = ? AND company_id = ?",
      [id, companyId],
    );
    return result.affectedRows > 0;
  },
};
