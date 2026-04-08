import { v4 as uuidv4 } from "uuid";
import pool from "../db";
import type { RowDataPacket, ResultSetHeader, PoolConnection } from "mysql2/promise";

/**
 * Database row shape for the `ocr_results` table.
 */
export interface OcrResultRow extends RowDataPacket {
  id: string;
  document_id: string;
  company_id: string;
  status: string;
  fields: string; // JSON string of OcrFieldResult[]
  raw_text: string | null;
  error_reason: string | null;
  processing_duration_ms: number | null;
  created_at: string;
  updated_at: string;
}

/**
 * Input shape for creating an OCR result record.
 */
export interface CreateOcrResultInput {
  id?: string;
  document_id: string;
  company_id: string;
  status: string;
  fields: Array<{
    field_name: string;
    extracted_value: string;
    confidence: number;
  }>;
  raw_text?: string | null;
  error_reason?: string | null;
  processing_duration_ms?: number | null;
}

/**
 * OCR Result Repository — tenant-scoped data access for OCR extraction results.
 *
 * Every query uses parameterized statements and includes company_id
 * for tenant isolation.
 */
export const ocrRepository = {
  /**
   * Create an OCR result record.
   */
  async create(
    input: CreateOcrResultInput,
    connection?: PoolConnection,
  ): Promise<OcrResultRow> {
    const conn = connection || pool;
    const ocrId = input.id || uuidv4();

    const fieldsJson = JSON.stringify(input.fields);

    await conn.query(
      `INSERT INTO ocr_results (id, document_id, company_id, status, fields, raw_text, error_reason, processing_duration_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        ocrId,
        input.document_id,
        input.company_id,
        input.status,
        fieldsJson,
        input.raw_text ?? null,
        input.error_reason ?? null,
        input.processing_duration_ms ?? null,
      ],
    );

    return {
      id: ocrId,
      document_id: input.document_id,
      company_id: input.company_id,
      status: input.status,
      fields: fieldsJson,
      raw_text: input.raw_text ?? null,
      error_reason: input.error_reason ?? null,
      processing_duration_ms: input.processing_duration_ms ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as OcrResultRow;
  },

  /**
   * Find an OCR result by ID, scoped to tenant.
   */
  async findById(id: string, companyId: string): Promise<OcrResultRow | null> {
    const [rows] = await pool.query<OcrResultRow[]>(
      "SELECT * FROM ocr_results WHERE id = ? AND company_id = ?",
      [id, companyId],
    );
    return rows.length > 0 ? rows[0] : null;
  },

  /**
   * Find OCR result by document ID, scoped to tenant.
   * Returns the most recent OCR result for the document.
   */
  async findByDocumentId(
    documentId: string,
    companyId: string,
  ): Promise<OcrResultRow | null> {
    const [rows] = await pool.query<OcrResultRow[]>(
      "SELECT * FROM ocr_results WHERE document_id = ? AND company_id = ? ORDER BY created_at DESC LIMIT 1",
      [documentId, companyId],
    );
    return rows.length > 0 ? rows[0] : null;
  },

  /**
   * Update the status of an OCR result.
   */
  async updateStatus(
    id: string,
    status: string,
    companyId: string,
    connection?: PoolConnection,
  ): Promise<OcrResultRow | null> {
    const conn = connection || pool;
    const [result] = await conn.query<ResultSetHeader>(
      "UPDATE ocr_results SET status = ?, updated_at = NOW() WHERE id = ? AND company_id = ?",
      [status, id, companyId],
    );

    if (result.affectedRows === 0) {
      return null;
    }

    if (!connection) {
      return this.findById(id, companyId);
    }

    return { id, status, company_id: companyId } as unknown as OcrResultRow;
  },
};
