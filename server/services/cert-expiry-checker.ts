import { v4 as uuidv4 } from "uuid";
import pool from "../db";
import { createChildLogger } from "../lib/logger";

export interface ExpiringCert {
  driverId: string;
  certType: string;
  expiryDate: Date;
  daysRemaining: number;
}

export interface ExpiryAlertResult {
  alertsCreated: number;
  expiringCerts: ExpiringCert[];
  jobIds: string[];
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
    expiryDate:
      row.expiry_date instanceof Date
        ? row.expiry_date
        : new Date(row.expiry_date),
    daysRemaining: row.days_remaining,
  }));

  log.info(
    { companyId, daysAhead, count: result.length },
    "Cert expiry check completed",
  );

  return result;
}

/**
 * Scans for expiring certificates and creates a notification job for each.
 * Each notification job is inserted into the notification_jobs table with
 * channel=email, status=PENDING, and a descriptive message.
 *
 * @param companyId - The tenant's company ID
 * @param daysAhead - Number of days to look ahead (default: 30)
 * @returns Summary of alerts created including job IDs
 */
export async function createExpiryAlerts(
  companyId: string,
  daysAhead: number = 30,
): Promise<ExpiryAlertResult> {
  const log = createChildLogger({ service: "cert-expiry-checker" });

  const expiringCerts = await checkExpiring(companyId, daysAhead);

  if (expiringCerts.length === 0) {
    log.info({ companyId }, "No expiring certs found — no alerts created");
    return { alertsCreated: 0, expiringCerts: [], jobIds: [] };
  }

  const jobIds: string[] = [];

  for (const cert of expiringCerts) {
    const jobId = uuidv4();
    const expiryStr = cert.expiryDate.toISOString().split("T")[0];
    const urgency =
      cert.daysRemaining <= 0
        ? "EXPIRED"
        : cert.daysRemaining <= 7
          ? "URGENT"
          : "WARNING";

    const message =
      cert.daysRemaining <= 0
        ? `Driver certificate ${cert.certType} for driver ${cert.driverId} expired on ${expiryStr}`
        : `Driver certificate ${cert.certType} for driver ${cert.driverId} expires on ${expiryStr} (${cert.daysRemaining} days remaining) [${urgency}]`;

    await pool.query(
      `INSERT INTO notification_jobs
         (id, company_id, message, channel, status, sent_by, sent_at, recipients)
       VALUES (?, ?, ?, 'email', 'PENDING', 'system', NOW(), '[]')`,
      [jobId, companyId, message],
    );

    jobIds.push(jobId);
  }

  log.info(
    { companyId, alertsCreated: jobIds.length },
    "Cert expiry alerts created",
  );

  return {
    alertsCreated: jobIds.length,
    expiringCerts,
    jobIds,
  };
}
