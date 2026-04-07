import { v4 as uuidv4 } from "uuid";
import pool from "../db";
import type { RowDataPacket } from "mysql2/promise";
import { buildSafeUpdate } from "../lib/safe-update";

const CRISIS_ACTION_UPDATABLE_COLUMNS = [
  "type",
  "status",
  "incident_id",
  "load_id",
  "operator_id",
  "location",
  "timeline",
  "description",
] as const;

export const crisisActionRepository = {
  async findByCompany(companyId: string, page = 1, limit = 50) {
    const offset = (page - 1) * limit;
    const [rows] = await pool.query(
      "SELECT * FROM crisis_actions WHERE company_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
      [companyId, limit, offset],
    );
    return rows as RowDataPacket[];
  },

  async findById(id: string) {
    const [rows] = await pool.query(
      "SELECT * FROM crisis_actions WHERE id = ?",
      [id],
    );
    return (rows as RowDataPacket[])[0] || null;
  },

  async create(data: Record<string, unknown>, companyId: string, userId: string) {
    const id = data.id || uuidv4();
    await pool.query(
      `INSERT INTO crisis_actions (id, company_id, type, status, incident_id,
        load_id, operator_id, location, timeline, description,
        created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        companyId,
        data.type,
        data.status,
        data.incident_id,
        data.load_id,
        data.operator_id,
        data.location ? JSON.stringify(data.location) : null,
        data.timeline ? JSON.stringify(data.timeline) : null,
        data.description,
        userId,
        userId,
      ],
    );
    return this.findById(id);
  },

  async update(id: string, data: Record<string, unknown>, userId: string) {
    // Pre-serialize JSON fields before passing to buildSafeUpdate
    const safeCopy = { ...data };
    for (const key of ["location", "timeline"] as const) {
      if (safeCopy[key] !== undefined)
        safeCopy[key] = JSON.stringify(safeCopy[key]);
    }

    const result = buildSafeUpdate(
      safeCopy,
      CRISIS_ACTION_UPDATABLE_COLUMNS,
      ["updated_by = ?"],
      [userId],
    );
    if (!result) return this.findById(id);

    await pool.query(
      `UPDATE crisis_actions SET ${result.setClause} WHERE id = ?`,
      [...result.values, id],
    );
    return this.findById(id);
  },
};
