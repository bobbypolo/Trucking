import { v4 as uuidv4 } from "uuid";
import pool from "../db";
import type { RowDataPacket } from "mysql2/promise";

/**
 * Repository for the `financial_objectives` table (STORY-010 Phase 10).
 * Wraps the minimal CRUD operations required by the /api/financial-objectives
 * route:
 *   - list objectives for a company, optionally filtered by quarter
 *   - create a quarterly objective
 */
export interface FinancialObjectiveRow extends RowDataPacket {
  id: string;
  company_id: string;
  quarter: string;
  revenue_target: number;
  expense_budget: number;
  profit_target: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateFinancialObjectiveData {
  quarter: string;
  revenue_target: number;
  expense_budget: number;
  profit_target: number;
  notes?: string;
}

export const financialObjectiveRepository = {
  async findById(id: string): Promise<FinancialObjectiveRow | null> {
    const [rows] = await pool.query<FinancialObjectiveRow[]>(
      "SELECT * FROM financial_objectives WHERE id = ?",
      [id],
    );
    return rows[0] || null;
  },

  async list(
    companyId: string,
    quarter?: string,
  ): Promise<FinancialObjectiveRow[]> {
    if (quarter) {
      const [rows] = await pool.query<FinancialObjectiveRow[]>(
        "SELECT * FROM financial_objectives WHERE company_id = ? AND quarter = ? ORDER BY quarter DESC, id ASC",
        [companyId, quarter],
      );
      return rows;
    }
    const [rows] = await pool.query<FinancialObjectiveRow[]>(
      "SELECT * FROM financial_objectives WHERE company_id = ? ORDER BY quarter DESC, id ASC",
      [companyId],
    );
    return rows;
  },

  async create(
    data: CreateFinancialObjectiveData,
    companyId: string,
  ): Promise<FinancialObjectiveRow | null> {
    const id = uuidv4();
    await pool.query(
      `INSERT INTO financial_objectives
        (id, company_id, quarter, revenue_target, expense_budget, profit_target, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        companyId,
        data.quarter,
        data.revenue_target,
        data.expense_budget,
        data.profit_target,
        data.notes ?? null,
      ],
    );
    return this.findById(id);
  },
};
