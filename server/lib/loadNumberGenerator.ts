import { Pool } from "mysql2/promise";
import { v4 as uuidv4 } from "uuid";

/**
 * Generates the next load number for a company.
 * Queries the most recent load number, parses the numeric suffix, and increments.
 * Falls back to DRAFT-{8-char uuid hex} if no existing loads or parse fails.
 */
export async function generateNextLoadNumber(
  companyId: string,
  pool: Pool,
): Promise<string> {
  try {
    const [rows]: any = await pool.query(
      "SELECT load_number FROM loads WHERE company_id = ? ORDER BY created_at DESC LIMIT 1",
      [companyId],
    );

    if (!Array.isArray(rows) || rows.length === 0) {
      return `DRAFT-${uuidv4().replace(/-/g, "").slice(0, 8)}`;
    }

    const lastNumber: string = rows[0].load_number ?? "";
    // Match anything ending in a purely numeric suffix, e.g. LP-0001 → prefix=LP-, suffix=0001
    const match = lastNumber.match(/^(.*-)(\d+)$/);
    if (!match) {
      return `DRAFT-${uuidv4().replace(/-/g, "").slice(0, 8)}`;
    }

    const prefix = match[1];
    const numericSuffix = match[2];
    const nextNum = parseInt(numericSuffix, 10) + 1;
    const paddedNum = String(nextNum).padStart(numericSuffix.length, "0");
    return `${prefix}${paddedNum}`;
  } catch {
    return `DRAFT-${uuidv4().replace(/-/g, "").slice(0, 8)}`;
  }
}
