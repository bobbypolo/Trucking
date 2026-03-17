import { v4 as uuidv4 } from "uuid";
import pool from "../db";
import { buildSafeUpdate } from "../lib/safe-update";

const KCI_REQUEST_UPDATABLE_COLUMNS = [
  "type",
  "status",
  "priority",
  "requested_amount",
  "approved_amount",
  "currency",
  "load_id",
  "driver_id",
  "source",
  "requires_docs",
  "open_record_id",
  "requested_at",
  "due_at",
  "approved_by",
  "approved_at",
  "denied_by",
  "denied_at",
  "denial_reason",
  "decision_log",
  "links",
] as const;

export const kciRequestRepository = {
  async findByCompany(companyId: string, page = 1, limit = 50) {
    const offset = (page - 1) * limit;
    const [rows] = await pool.query(
      "SELECT * FROM kci_requests WHERE company_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
      [companyId, limit, offset],
    );
    return rows as any[];
  },

  async findById(id: string) {
    const [rows] = await pool.query("SELECT * FROM kci_requests WHERE id = ?", [
      id,
    ]);
    return (rows as any[])[0] || null;
  },

  async create(data: any, companyId: string, userId: string) {
    const id = data.id || uuidv4();
    await pool.query(
      `INSERT INTO kci_requests (id, company_id, type, status, priority,
        requested_amount, approved_amount, currency, load_id, driver_id,
        source, requires_docs, open_record_id, requested_at, due_at,
        decision_log, links, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        companyId,
        data.type,
        data.status,
        data.priority,
        data.requested_amount,
        data.approved_amount,
        data.currency || "USD",
        data.load_id,
        data.driver_id,
        data.source,
        data.requires_docs ?? null,
        data.open_record_id,
        data.requested_at,
        data.due_at,
        data.decision_log ? JSON.stringify(data.decision_log) : null,
        data.links ? JSON.stringify(data.links) : null,
        userId,
        userId,
      ],
    );
    return this.findById(id);
  },

  async update(id: string, data: any, userId: string) {
    // Pre-serialize JSON fields before passing to buildSafeUpdate
    const safeCopy = { ...data };
    for (const key of ["decision_log", "links"] as const) {
      if (safeCopy[key] !== undefined)
        safeCopy[key] = JSON.stringify(safeCopy[key]);
    }

    const result = buildSafeUpdate(
      safeCopy,
      KCI_REQUEST_UPDATABLE_COLUMNS,
      ["updated_by = ?"],
      [userId],
    );
    if (!result) return this.findById(id);

    await pool.query(
      `UPDATE kci_requests SET ${result.setClause} WHERE id = ?`,
      [...result.values, id],
    );
    return this.findById(id);
  },
};
