import { v4 as uuidv4 } from "uuid";
import pool from "../db";
import { buildSafeUpdate } from "../lib/safe-update";

export type ProviderInput = Record<string, unknown>;

const PROVIDER_UPDATABLE_COLUMNS = [
  "name",
  "type",
  "status",
  "phone",
  "email",
  "coverage",
  "capabilities",
  "contacts",
  "after_hours_contacts",
  "is_247",
  "notes",
] as const;

export const providerRepository = {
  async findByCompany(companyId: string, page = 1, limit = 50) {
    const offset = (page - 1) * limit;
    const [rows] = await pool.query(
      "SELECT * FROM providers WHERE company_id = ? AND archived_at IS NULL ORDER BY created_at DESC LIMIT ? OFFSET ?",
      [companyId, limit, offset],
    );
    return rows as any[];
  },

  async findById(id: string) {
    const [rows] = await pool.query("SELECT * FROM providers WHERE id = ?", [
      id,
    ]);
    return (rows as any[])[0] || null;
  },

  async create(data: ProviderInput, companyId: string, userId: string) {
    const id = (data.id as string | undefined) || uuidv4();
    await pool.query(
      `INSERT INTO providers (id, company_id, name, type, status, phone, email,
        coverage, capabilities, contacts, after_hours_contacts, is_247, notes,
        created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        companyId,
        data.name,
        data.type,
        data.status,
        data.phone,
        data.email,
        data.coverage ? JSON.stringify(data.coverage) : null,
        data.capabilities ? JSON.stringify(data.capabilities) : null,
        data.contacts ? JSON.stringify(data.contacts) : null,
        data.after_hours_contacts
          ? JSON.stringify(data.after_hours_contacts)
          : null,
        data.is_247 ?? null,
        data.notes,
        userId,
        userId,
      ],
    );
    return this.findById(id);
  },

  async update(id: string, data: ProviderInput, userId: string) {
    // Pre-serialize JSON fields before passing to buildSafeUpdate
    const safeCopy = { ...data };
    for (const key of [
      "coverage",
      "capabilities",
      "contacts",
      "after_hours_contacts",
    ] as const) {
      if (safeCopy[key] !== undefined)
        safeCopy[key] = JSON.stringify(safeCopy[key]);
    }

    const result = buildSafeUpdate(
      safeCopy,
      PROVIDER_UPDATABLE_COLUMNS,
      ["updated_by = ?"],
      [userId],
    );
    if (!result) return this.findById(id);

    await pool.query(`UPDATE providers SET ${result.setClause} WHERE id = ?`, [
      ...result.values,
      id,
    ]);
    return this.findById(id);
  },

  async archive(id: string, userId: string) {
    await pool.query(
      "UPDATE providers SET archived_at = NOW(), updated_by = ? WHERE id = ?",
      [userId, id],
    );
  },
};
