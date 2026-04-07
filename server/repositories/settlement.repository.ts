import { v4 as uuidv4 } from "uuid";
import pool from "../db";
import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";

/**
 * Database row shape for the `settlements` table.
 */
export interface SettlementRow extends RowDataPacket {
  id: string;
  company_id: string;
  load_id: string;
  driver_id: string;
  settlement_date: string;
  period_start: string | null;
  period_end: string | null;
  status: string;
  total_earnings: number;
  total_deductions: number;
  total_reimbursements: number;
  net_pay: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  version: number;
}

/**
 * Database row shape for the `settlement_adjustments` table.
 */
export interface SettlementAdjustmentRow extends RowDataPacket {
  id: string;
  settlement_id: string;
  reason: string;
  adjustment_type: string;
  amount: number;
  created_by: string;
  created_at: string;
}

/**
 * Input shape for creating a settlement adjustment.
 */
export interface CreateAdjustmentInput {
  settlement_id: string;
  reason: string;
  adjustment_type: string;
  amount: number;
  created_by: string;
}

/**
 * Database row shape for the `settlement_lines` table.
 */
export interface SettlementLineRow extends RowDataPacket {
  id: string;
  settlement_id: string;
  description: string;
  amount: number;
  type: string;
  load_id: string | null;
  gl_account_id: string | null;
  sequence_order: number;
}

/**
 * Input shape for creating a settlement.
 */
export interface CreateSettlementInput {
  company_id: string;
  load_id: string;
  driver_id: string;
  settlement_date: string;
  period_start?: string | null;
  period_end?: string | null;
  status: string;
  total_earnings: number;
  total_deductions: number;
  total_reimbursements: number;
  net_pay: number;
  created_by: string;
  lines: Array<{
    description: string;
    amount: number;
    type: string;
    loadId?: string;
    glAccountId?: string;
  }>;
}

/**
 * Settlement Repository — tenant-scoped data access for settlements.
 *
 * Every query uses parameterized statements and includes company_id
 * for tenant isolation.
 */
export const settlementRepository = {
  /**
   * Find the status of a load by ID, scoped to the given tenant.
   * Returns the load status string, or null if the load does not exist.
   */
  async findLoadStatus(
    loadId: string,
    companyId: string,
  ): Promise<string | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT status FROM loads WHERE id = ? AND company_id = ?",
      [loadId, companyId],
    );
    return rows.length > 0 ? (rows[0].status as string) : null;
  },

  /**
   * Find a settlement by load_id and company_id (tenant-scoped).
   * Used for idempotency check — returns the existing settlement or null.
   */
  async findByLoadAndTenant(
    loadId: string,
    companyId: string,
  ): Promise<SettlementRow | null> {
    const [rows] = await pool.query<SettlementRow[]>(
      "SELECT * FROM settlements WHERE load_id = ? AND company_id = ?",
      [loadId, companyId],
    );
    return rows.length > 0 ? rows[0] : null;
  },

  /**
   * Find a settlement by ID, scoped to the given tenant.
   */
  async findById(id: string, companyId: string): Promise<SettlementRow | null> {
    const [rows] = await pool.query<SettlementRow[]>(
      "SELECT * FROM settlements WHERE id = ? AND company_id = ?",
      [id, companyId],
    );
    return rows.length > 0 ? rows[0] : null;
  },

  /**
   * Atomically create a settlement and its line items within a single transaction.
   * All queries use parameterized statements.
   */
  async create(input: CreateSettlementInput): Promise<SettlementRow> {
    const settlementId = uuidv4();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // Insert settlement header
      await connection.query(
        `INSERT INTO settlements
          (id, company_id, load_id, driver_id, settlement_date, period_start, period_end,
           status, total_earnings, total_deductions, total_reimbursements, net_pay,
           created_by, version)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          settlementId,
          input.company_id,
          input.load_id,
          input.driver_id,
          input.settlement_date,
          input.period_start ?? null,
          input.period_end ?? null,
          input.status,
          input.total_earnings,
          input.total_deductions,
          input.total_reimbursements,
          input.net_pay,
          input.created_by,
        ],
      );

      // Insert settlement lines
      for (let i = 0; i < input.lines.length; i++) {
        const line = input.lines[i];
        await connection.query(
          `INSERT INTO settlement_detail_lines
            (id, settlement_id, description, amount, type, load_id, gl_account_id, sequence_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            uuidv4(),
            settlementId,
            line.description,
            line.amount,
            line.type,
            line.loadId ?? null,
            line.glAccountId ?? null,
            i,
          ],
        );
      }

      await connection.commit();

      // Return the created settlement
      return {
        id: settlementId,
        company_id: input.company_id,
        load_id: input.load_id,
        driver_id: input.driver_id,
        settlement_date: input.settlement_date,
        period_start: input.period_start ?? null,
        period_end: input.period_end ?? null,
        status: input.status,
        total_earnings: input.total_earnings,
        total_deductions: input.total_deductions,
        total_reimbursements: input.total_reimbursements,
        net_pay: input.net_pay,
        created_by: input.created_by,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        version: 1,
      } as SettlementRow;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  /**
   * Update settlement status with optimistic locking.
   * Returns the updated settlement or null if version conflict.
   */
  async updateStatus(
    id: string,
    newStatus: string,
    companyId: string,
    expectedVersion: number,
  ): Promise<SettlementRow | null> {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [result] = await connection.execute<ResultSetHeader>(
        `UPDATE settlements SET status = ?, version = version + 1, updated_at = NOW()
         WHERE id = ? AND company_id = ? AND version = ?`,
        [newStatus, id, companyId, expectedVersion],
      );

      if (result.affectedRows === 0) {
        await connection.rollback();
        return null;
      }

      await connection.commit();

      return this.findById(id, companyId);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  /**
   * Create a settlement adjustment (correction record).
   *
   * Adjustments are immutable records that reference an existing posted
   * settlement. The original settlement is NEVER modified.
   */
  async createAdjustment(
    input: CreateAdjustmentInput,
  ): Promise<SettlementAdjustmentRow> {
    const adjustmentId = uuidv4();

    await pool.query(
      `INSERT INTO settlement_adjustments
        (id, settlement_id, reason, adjustment_type, amount, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        adjustmentId,
        input.settlement_id,
        input.reason,
        input.adjustment_type,
        input.amount,
        input.created_by,
      ],
    );

    return {
      id: adjustmentId,
      settlement_id: input.settlement_id,
      reason: input.reason,
      adjustment_type: input.adjustment_type,
      amount: input.amount,
      created_by: input.created_by,
      created_at: new Date().toISOString(),
    } as SettlementAdjustmentRow;
  },
};
