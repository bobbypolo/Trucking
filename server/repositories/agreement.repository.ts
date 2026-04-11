import { v4 as uuidv4 } from "uuid";
import pool from "../db";
import type { RowDataPacket } from "mysql2/promise";

/**
 * Repository for the `digital_agreements` table (STORY-009 Phase 9).
 * Wraps the minimal CRUD operations required by the agreements route:
 *   - create a DRAFT agreement snapshot of a rate confirmation
 *   - read an agreement by id
 *   - transition an agreement to SIGNED with signature data
 */
export interface AgreementRow extends RowDataPacket {
  id: string;
  company_id: string;
  load_id: string;
  rate_con_data: unknown;
  status: "DRAFT" | "SENT" | "SIGNED" | "VOIDED";
  signature_data: unknown;
  signed_at: string | null;
  created_at: string;
  updated_at: string;
}

export const agreementRepository = {
  async findById(id: string): Promise<AgreementRow | null> {
    const [rows] = await pool.query<AgreementRow[]>(
      "SELECT * FROM digital_agreements WHERE id = ?",
      [id],
    );
    return rows[0] || null;
  },

  async create(
    data: { load_id: string; rate_con_data?: unknown },
    companyId: string,
  ): Promise<AgreementRow | null> {
    const id = uuidv4();
    const rateConJson = data.rate_con_data
      ? JSON.stringify(data.rate_con_data)
      : null;
    await pool.query(
      `INSERT INTO digital_agreements
        (id, company_id, load_id, rate_con_data, status)
       VALUES (?, ?, ?, ?, 'DRAFT')`,
      [id, companyId, data.load_id, rateConJson],
    );
    return this.findById(id);
  },

  async sign(id: string, signatureData: unknown): Promise<AgreementRow | null> {
    const signatureJson = JSON.stringify(signatureData);
    await pool.query(
      `UPDATE digital_agreements
         SET status = 'SIGNED',
             signature_data = ?,
             signed_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [signatureJson, id],
    );
    return this.findById(id);
  },
};
