import pool from "../db";
import { createChildLogger } from "../lib/logger";

export interface ExpiringCert {
  driverId: string;
  certType: string;
  expiryDate: Date;
  daysRemaining: number;
}

/**
 * Queries compliance_records for certificates expiring within `daysAhead` days
 * for a given company. Joins with users to scope by company_id.
 *
 * @param companyId - The tenant's company ID
 * @param daysAhead - Number of days to look ahead (default: 30)
 * @returns Array of expiring certificate records
 */
export async function checkExpiring(
  companyId: string,
  daysAhead: number = 30,
): Promise<ExpiringCert[]> {
  const log = createChildLogger({ service: "cert-expiry-checker" });

  const sql = `
    SELECT
      cr.user_id,
      cr.type,
      cr.expiry_date,
      DATEDIFF(cr.expiry_date, CURDATE()) AS days_remaining
    FROM compliance_records cr
    JOIN users u ON cr.user_id = u.id
    WHERE u.company_id = ?
      AND cr.expiry_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
    ORDER BY cr.expiry_date ASC
  `;

  const [rows] = await pool.query(sql, [companyId, daysAhead]);
  const records = rows as Array<{
    user_id: string;
    type: string;
    expiry_date: Date;
    days_remaining: number;
  }>;

  const result: ExpiringCert[] = records.map((row) => ({
    driverId: row.user_id,
    certType: row.type,
    expiryDate: row.expiry_date instanceof Date ? row.expiry_date : new Date(row.expiry_date),
    daysRemaining: row.days_remaining,
  }));

  log.info(
    { companyId, daysAhead, count: result.length },
    "Cert expiry check completed",
  );

  return result;
}
